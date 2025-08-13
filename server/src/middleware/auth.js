import { verifyToken, getUserSession } from '../utils/auth.js';
import { getPrismaClient } from '../utils/database.js';
import sessionCacheService from '../services/sessionCacheService.js';

// Authentication middleware
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Access token is required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify token
        const decoded = verifyToken(token);

        // Try to get session from Redis cache first
        const sessionId = `${decoded.userId}_${token.slice(-10)}`; // Create session ID from user and token
        let sessionData = await sessionCacheService.getSession(sessionId);

        let user;
        if (sessionData) {
            // Use cached session data
            user = {
                id: sessionData.userId,
                email: sessionData.email,
                name: sessionData.name,
                role: sessionData.role,
                organizationId: sessionData.organizationId,
                isActive: true
            };

            // Update session activity
            await sessionCacheService.extendSession(sessionId);
        } else {
            // Fallback to database lookup
            const prisma = getPrismaClient();
            user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    organizationId: true,
                    isActive: true
                }
            });

            if (user && user.isActive) {
                // Cache the session for future requests
                await sessionCacheService.setSession(sessionId, {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    organizationId: user.organizationId,
                    token: token
                });
            }
        }

        if (!user || !user.isActive) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not found or inactive',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: error.message || 'Invalid token',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Optional authentication middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            const prisma = getPrismaClient();
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    organizationId: true,
                    isActive: true
                }
            });

            if (user && user.isActive) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
}

// Role-based authorization middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];

        if (!userRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions',
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();
    };
}

// Organization access middleware
function requireOrganization(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                timestamp: new Date().toISOString()
            }
        });
    }

    if (!req.user.organizationId) {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Organization membership required',
                timestamp: new Date().toISOString()
            }
        });
    }

    next();
}

export {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireOrganization
};