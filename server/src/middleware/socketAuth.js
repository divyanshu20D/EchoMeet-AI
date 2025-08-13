import { verifyToken } from '../utils/auth.js';
import { getPrismaClient } from '../utils/database.js';
import sessionService from '../services/sessionService.js';
import presenceService from '../services/presenceService.js';

// Socket.IO authentication middleware
function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = verifyToken(token);

        // Get user session from Redis
        sessionService.getSession(token)
            .then(async (session) => {
                if (!session || !session.userInfo) {
                    return next(new Error('Invalid or expired session'));
                }

                // Verify user is still active in database
                const prisma = getPrismaClient();
                const user = await prisma.user.findUnique({
                    where: { id: session.userId },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        role: true,
                        organizationId: true,
                        isActive: true
                    }
                });

                if (!user || !user.isActive) {
                    await sessionService.invalidateSession(token);
                    return next(new Error('User not found or inactive'));
                }

                // Attach user data to socket
                socket.userId = user.id;
                socket.user = user;
                socket.sessionToken = token;

                // Update session activity
                await sessionService.updateSessionActivity(token);

                // Set user online in presence service
                await presenceService.setUserOnline(user.id, user);
                await presenceService.updateUserActivity(user.id, socket.id);

                console.log(`🔌 Socket authenticated: ${user.name} (${socket.id})`);
                next();
            })
            .catch((error) => {
                console.error('Socket authentication error:', error);
                next(new Error('Authentication failed'));
            });

    } catch (error) {
        console.error('Socket auth middleware error:', error);
        next(new Error('Invalid authentication token'));
    }
}

// Optional socket authentication (doesn't fail if no token)
function optionalSocketAuth(socket, next) {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            // No token provided, continue without authentication
            socket.isAuthenticated = false;
            return next();
        }

        // Try to authenticate
        const decoded = verifyToken(token);

        sessionService.getSession(token)
            .then(async (session) => {
                if (session && session.userInfo) {
                    // Verify user is still active
                    const prisma = getPrismaClient();
                    const user = await prisma.user.findUnique({
                        where: { id: session.userId },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            avatar: true,
                            role: true,
                            organizationId: true,
                            isActive: true
                        }
                    });

                    if (user && user.isActive) {
                        socket.userId = user.id;
                        socket.user = user;
                        socket.sessionToken = token;
                        socket.isAuthenticated = true;

                        await sessionService.updateSessionActivity(token);
                        await presenceService.setUserOnline(user.id, user);
                        await presenceService.updateUserActivity(user.id, socket.id);

                        console.log(`🔌 Socket optionally authenticated: ${user.name} (${socket.id})`);
                    } else {
                        socket.isAuthenticated = false;
                    }
                } else {
                    socket.isAuthenticated = false;
                }

                next();
            })
            .catch((error) => {
                console.error('Optional socket auth error:', error);
                socket.isAuthenticated = false;
                next();
            });

    } catch (error) {
        console.error('Optional socket auth middleware error:', error);
        socket.isAuthenticated = false;
        next();
    }
}

// Role-based socket authorization
function requireSocketRole(roles) {
    return (socket, next) => {
        if (!socket.user) {
            return next(new Error('Authentication required'));
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(socket.user.role)) {
            return next(new Error('Insufficient permissions'));
        }

        next();
    };
}

// Meeting access authorization
function requireMeetingAccess(meetingId) {
    return async (socket, next) => {
        try {
            if (!socket.user) {
                return next(new Error('Authentication required'));
            }

            const prisma = getPrismaClient();

            // Check if user is host or participant of the meeting
            const meeting = await prisma.meeting.findUnique({
                where: { id: meetingId },
                include: {
                    participants: {
                        where: { userId: socket.user.id }
                    }
                }
            });

            if (!meeting) {
                return next(new Error('Meeting not found'));
            }

            // Check access: host, participant, or public meeting
            const isHost = meeting.hostId === socket.user.id;
            const isParticipant = meeting.participants.length > 0;
            const isPublic = meeting.settings?.isPublic;
            const sameOrganization = meeting.organizationId === socket.user.organizationId;

            if (isHost || isParticipant || isPublic || sameOrganization) {
                socket.meetingId = meetingId;
                socket.isHost = isHost;
                next();
            } else {
                next(new Error('Access denied to this meeting'));
            }

        } catch (error) {
            console.error('Meeting access check error:', error);
            next(new Error('Failed to verify meeting access'));
        }
    };
}

// Socket disconnect handler
function handleSocketDisconnect(socket) {
    return async () => {
        try {
            console.log(`🔌 Socket disconnected: ${socket.user?.name || 'Unknown'} (${socket.id})`);

            if (socket.user) {
                // Update presence service
                await presenceService.updateUserActivity(socket.user.id);

                // Check if user has other active sockets
                const userPresence = await presenceService.getUserPresence(socket.user.id);
                if (userPresence && userPresence.socketIds) {
                    const remainingSockets = userPresence.socketIds.filter(id => id !== socket.id);

                    if (remainingSockets.length === 0) {
                        // No other sockets, set user offline
                        await presenceService.setUserOffline(socket.user.id);
                    } else {
                        // Update socket list
                        userPresence.socketIds = remainingSockets;
                        await presenceService.updateUserActivity(socket.user.id);
                    }
                }
            }

        } catch (error) {
            console.error('Socket disconnect handler error:', error);
        }
    };
}

// Rate limiting for socket events
function socketRateLimit(maxEvents = 100, windowMs = 60000) {
    const clients = new Map();

    return (socket, next) => {
        const clientId = socket.userId || socket.id;
        const now = Date.now();

        if (!clients.has(clientId)) {
            clients.set(clientId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const client = clients.get(clientId);

        if (now > client.resetTime) {
            client.count = 1;
            client.resetTime = now + windowMs;
            return next();
        }

        if (client.count >= maxEvents) {
            return next(new Error('Rate limit exceeded'));
        }

        client.count++;
        next();
    };
}

// Validate socket event data
function validateSocketData(schema) {
    return (data, next) => {
        try {
            const validatedData = schema.parse(data);
            next(null, validatedData);
        } catch (error) {
            next(new Error(`Invalid data: ${error.message}`));
        }
    };
}

export {
    socketAuthMiddleware,
    optionalSocketAuth,
    requireSocketRole,
    requireMeetingAccess,
    handleSocketDisconnect,
    socketRateLimit,
    validateSocketData
};