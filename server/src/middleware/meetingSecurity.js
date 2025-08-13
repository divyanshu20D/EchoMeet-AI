import meetingSecurityService from '../services/meetingSecurityService.js';
import meetingCacheService from '../services/meetingCacheService.js';
import { z } from 'zod';

// Validation schemas
const passwordVerificationSchema = z.object({
    password: z.string().min(1, 'Password is required')
});

const securityInfoSchema = z.object({
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    location: z.object({
        country: z.string().optional(),
        city: z.string().optional()
    }).optional()
});

// Middleware to check if meeting requires password
async function requireMeetingPassword(req, res, next) {
    try {
        const { meetingId } = req.params;

        if (!meetingId) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_MEETING_ID',
                    message: 'Meeting ID is required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Get meeting details
        const meeting = await meetingCacheService.getMeeting(meetingId);

        if (!meeting) {
            return res.status(404).json({
                error: {
                    code: 'MEETING_NOT_FOUND',
                    message: 'Meeting not found',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check if meeting requires password
        if (!meeting.settings?.hasPassword) {
            return next(); // No password required, continue
        }

        // Check if password was provided
        const { password } = req.body;
        if (!password) {
            return res.status(401).json({
                error: {
                    code: 'PASSWORD_REQUIRED',
                    message: 'This meeting requires a password',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate password format
        try {
            passwordVerificationSchema.parse({ password });
        } catch (validationError) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_PASSWORD_FORMAT',
                    message: 'Invalid password format',
                    details: validationError.errors,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Get client security info
        const clientInfo = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            location: req.body.location
        };

        // Verify password
        try {
            await meetingSecurityService.verifyMeetingPassword(
                meetingId,
                password,
                req.user?.id,
                clientInfo
            );

            // Password verified, continue
            next();

        } catch (error) {
            return res.status(401).json({
                error: {
                    code: 'INVALID_PASSWORD',
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('Meeting password middleware error:', error);
        res.status(500).json({
            error: {
                code: 'SECURITY_CHECK_FAILED',
                message: 'Failed to verify meeting access',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Middleware to check if user is banned from meeting
async function checkMeetingBan(req, res, next) {
    try {
        const { meetingId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return next(); // No user to check, continue
        }

        // Check if user is banned
        const isBanned = await meetingSecurityService.isUserBanned(meetingId, userId);

        if (isBanned) {
            return res.status(403).json({
                error: {
                    code: 'USER_BANNED',
                    message: 'You are banned from this meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();

    } catch (error) {
        console.error('Meeting ban check middleware error:', error);
        res.status(500).json({
            error: {
                code: 'BAN_CHECK_FAILED',
                message: 'Failed to verify user access',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Middleware to validate meeting access with security logging
async function validateMeetingAccess(req, res, next) {
    try {
        const { meetingId } = req.params;
        const userId = req.user?.id;

        // Get client security info
        const clientInfo = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer')
        };

        // Log access attempt
        await meetingSecurityService.logSecurityEvent(meetingId, {
            event: 'access_attempt',
            userId,
            timestamp: new Date().toISOString(),
            metadata: {
                endpoint: req.path,
                method: req.method,
                clientInfo
            }
        });

        // Check meeting exists
        const meeting = await meetingCacheService.getMeeting(meetingId);
        if (!meeting) {
            await meetingSecurityService.logSecurityEvent(meetingId, {
                event: 'access_denied_meeting_not_found',
                userId,
                timestamp: new Date().toISOString(),
                metadata: { clientInfo }
            });

            return res.status(404).json({
                error: {
                    code: 'MEETING_NOT_FOUND',
                    message: 'Meeting not found',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check meeting status
        if (meeting.status === 'ENDED') {
            await meetingSecurityService.logSecurityEvent(meetingId, {
                event: 'access_denied_meeting_ended',
                userId,
                timestamp: new Date().toISOString(),
                metadata: { clientInfo }
            });

            return res.status(410).json({
                error: {
                    code: 'MEETING_ENDED',
                    message: 'This meeting has ended',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Log successful access validation
        await meetingSecurityService.logSecurityEvent(meetingId, {
            event: 'access_validated',
            userId,
            timestamp: new Date().toISOString(),
            metadata: { clientInfo }
        });

        next();

    } catch (error) {
        console.error('Meeting access validation middleware error:', error);
        res.status(500).json({
            error: {
                code: 'ACCESS_VALIDATION_FAILED',
                message: 'Failed to validate meeting access',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Middleware to enforce waiting room
async function enforceWaitingRoom(req, res, next) {
    try {
        const { meetingId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required for waiting room',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Get meeting settings
        const meeting = await meetingCacheService.getMeeting(meetingId);

        if (!meeting?.settings?.waitingRoomEnabled) {
            return next(); // No waiting room, continue
        }

        // Check if user is host or already admitted
        if (meeting.hostId === userId) {
            return next(); // Host can bypass waiting room
        }

        // Check if user is already a participant
        const participants = await meetingCacheService.getCachedMeetingParticipants(meetingId);
        const isParticipant = participants.some(p => p.userId === userId);

        if (isParticipant) {
            return next(); // Already admitted
        }

        // Get client security info for waiting room
        const clientInfo = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            location: req.body.location
        };

        // Add to waiting room
        const userInfo = {
            userId,
            userName: req.user.name,
            email: req.user.email,
            socketId: req.body.socketId
        };

        await meetingSecurityService.addToSecureWaitingRoom(meetingId, userInfo, clientInfo);

        return res.status(202).json({
            success: true,
            message: 'Added to waiting room. Please wait for host approval.',
            data: {
                status: 'waiting',
                meetingId,
                userId
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Waiting room middleware error:', error);
        res.status(500).json({
            error: {
                code: 'WAITING_ROOM_FAILED',
                message: 'Failed to process waiting room request',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Rate limiting middleware for security-sensitive operations
function createSecurityRateLimit(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const attempts = new Map();

    return (req, res, next) => {
        const identifier = req.user?.id || req.ip || 'anonymous';
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old attempts
        if (attempts.has(identifier)) {
            const userAttempts = attempts.get(identifier).filter(time => time > windowStart);
            attempts.set(identifier, userAttempts);
        }

        // Check current attempts
        const currentAttempts = attempts.get(identifier) || [];

        if (currentAttempts.length >= maxAttempts) {
            return res.status(429).json({
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many attempts. Please try again later.',
                    retryAfter: Math.ceil(windowMs / 1000),
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Record this attempt
        currentAttempts.push(now);
        attempts.set(identifier, currentAttempts);

        next();
    };
}

// Middleware to validate security headers
function validateSecurityHeaders(req, res, next) {
    const requiredHeaders = ['user-agent'];
    const missingHeaders = [];

    for (const header of requiredHeaders) {
        if (!req.get(header)) {
            missingHeaders.push(header);
        }
    }

    if (missingHeaders.length > 0) {
        return res.status(400).json({
            error: {
                code: 'MISSING_SECURITY_HEADERS',
                message: 'Required security headers are missing',
                details: { missingHeaders },
                timestamp: new Date().toISOString()
            }
        });
    }

    // Check for suspicious user agents
    const userAgent = req.get('user-agent');
    const suspiciousPatterns = ['bot', 'crawler', 'spider', 'scraper'];

    if (suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
        return res.status(403).json({
            error: {
                code: 'SUSPICIOUS_CLIENT',
                message: 'Access denied for automated clients',
                timestamp: new Date().toISOString()
            }
        });
    }

    next();
}

export {
    requireMeetingPassword,
    checkMeetingBan,
    validateMeetingAccess,
    enforceWaitingRoom,
    createSecurityRateLimit,
    validateSecurityHeaders
};