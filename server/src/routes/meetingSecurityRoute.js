import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import {
    requireMeetingPassword,
    checkMeetingBan,
    validateMeetingAccess,
    createSecurityRateLimit,
    validateSecurityHeaders
} from '../middleware/meetingSecurity.js';
import meetingSecurityService from '../services/meetingSecurityService.js';
import participantManagementService from '../services/participantManagementService.js';
import meetingCacheService from '../services/meetingCacheService.js';
import cacheService from '../services/cacheService.js';

const router = express.Router();

// Rate limiting for security operations
const securityRateLimit = createSecurityRateLimit(10, 15 * 60 * 1000); // 10 attempts per 15 minutes

// Validation schemas
const setPasswordSchema = z.object({
    password: z.string().min(4, 'Password must be at least 4 characters').max(50, 'Password too long')
});

const verifyPasswordSchema = z.object({
    password: z.string().min(1, 'Password is required'),
    location: z.object({
        country: z.string().optional(),
        city: z.string().optional()
    }).optional()
});

const banUserSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    reason: z.string().min(1, 'Reason is required'),
    duration: z.number().positive().optional() // Duration in seconds
});

const waitingRoomActionSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    action: z.enum(['admit', 'reject'])
});

// Set meeting password
router.post('/:meetingId/password',
    authenticateToken,
    validateMeetingAccess,
    securityRateLimit,
    async (req, res) => {
        try {
            const { meetingId } = req.params;
            const { password } = setPasswordSchema.parse(req.body);

            // Check if user is host
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting || meeting.hostId !== req.user.id) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only the meeting host can set a password',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            await meetingSecurityService.setMeetingPassword(meetingId, password, req.user.id);

            res.json({
                success: true,
                message: 'Meeting password set successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Set meeting password API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid password format',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'SET_PASSWORD_FAILED',
                    message: error.message || 'Failed to set meeting password',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Remove meeting password
router.delete('/:meetingId/password',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;

            // Check if user is host
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting || meeting.hostId !== req.user.id) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only the meeting host can remove the password',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            await meetingSecurityService.removeMeetingPassword(meetingId, req.user.id);

            res.json({
                success: true,
                message: 'Meeting password removed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Remove meeting password API error:', error);
            res.status(500).json({
                error: {
                    code: 'REMOVE_PASSWORD_FAILED',
                    message: error.message || 'Failed to remove meeting password',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Verify meeting password
router.post('/:meetingId/verify-password',
    validateSecurityHeaders,
    securityRateLimit,
    async (req, res) => {
        try {
            const { meetingId } = req.params;
            const { password, location } = verifyPasswordSchema.parse(req.body);

            // Get client info
            const clientInfo = {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                location
            };

            await meetingSecurityService.verifyMeetingPassword(
                meetingId,
                password,
                req.user?.id,
                clientInfo
            );

            res.json({
                success: true,
                message: 'Password verified successfully',
                data: {
                    meetingId,
                    verified: true
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Verify meeting password API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(401).json({
                error: {
                    code: 'PASSWORD_VERIFICATION_FAILED',
                    message: error.message || 'Password verification failed',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Ban user from meeting
router.post('/:meetingId/ban',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;
            const { userId, reason, duration } = banUserSchema.parse(req.body);

            // Check if user has permission to ban
            const canBan = await participantManagementService.hasPermission(
                meetingId,
                req.user.id,
                'remove_participants'
            );

            if (!canBan) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'You do not have permission to ban users',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Cannot ban host
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (meeting && meeting.hostId === userId) {
                return res.status(400).json({
                    error: {
                        code: 'CANNOT_BAN_HOST',
                        message: 'Cannot ban the meeting host',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const banData = await meetingSecurityService.banUserFromMeeting(
                meetingId,
                userId,
                req.user.id,
                reason,
                duration
            );

            // Remove user from meeting if currently present
            try {
                await participantManagementService.removeParticipant(
                    meetingId,
                    userId,
                    req.user.id,
                    `Banned: ${reason}`
                );
            } catch (removeError) {
                // User might not be in meeting, continue
                console.log('User not in meeting during ban:', removeError.message);
            }

            res.json({
                success: true,
                message: 'User banned successfully',
                data: banData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Ban user API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'BAN_USER_FAILED',
                    message: error.message || 'Failed to ban user',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Get waiting room participants
router.get('/:meetingId/waiting-room',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;

            // Check if user has permission to view waiting room
            const canView = await participantManagementService.hasPermission(
                meetingId,
                req.user.id,
                'manage_participants'
            );

            if (!canView) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'You do not have permission to view the waiting room',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const waitingParticipants = await participantManagementService.getWaitingRoomParticipants(meetingId);

            res.json({
                success: true,
                data: {
                    participants: waitingParticipants,
                    count: waitingParticipants.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get waiting room API error:', error);
            res.status(500).json({
                error: {
                    code: 'GET_WAITING_ROOM_FAILED',
                    message: error.message || 'Failed to get waiting room participants',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Handle waiting room actions (admit/reject)
router.post('/:meetingId/waiting-room/action',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;
            const { userId, action } = waitingRoomActionSchema.parse(req.body);

            // Check if user has permission
            const canManage = await participantManagementService.hasPermission(
                meetingId,
                req.user.id,
                'manage_participants'
            );

            if (!canManage) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'You do not have permission to manage waiting room',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            let result;
            if (action === 'admit') {
                result = await meetingSecurityService.admitFromSecureWaitingRoom(
                    meetingId,
                    userId,
                    req.user.id
                );

                // Add to meeting participants
                await participantManagementService.addParticipant(meetingId, {
                    userId: result.userId,
                    userName: result.userName,
                    email: result.email,
                    socketId: result.socketId,
                    role: 'participant'
                });
            } else {
                // Reject - just remove from waiting room
                const waitingRoomKey = meetingSecurityService.getWaitingRoomKey(meetingId);
                await cacheService.hdel(waitingRoomKey, userId);

                await meetingSecurityService.logSecurityEvent(meetingId, {
                    event: 'waiting_room_rejected',
                    userId,
                    rejectedBy: req.user.id,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: `User ${action}${action === 'admit' ? 'ted' : 'ed'} successfully`,
                data: { action, userId },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Waiting room action API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'WAITING_ROOM_ACTION_FAILED',
                    message: error.message || 'Failed to process waiting room action',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Get security logs
router.get('/:meetingId/security-logs',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;
            const { limit = 100 } = req.query;

            // Check if user is host
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting || meeting.hostId !== req.user.id) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only the meeting host can view security logs',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const logs = await meetingSecurityService.getSecurityLogs(meetingId, parseInt(limit));

            res.json({
                success: true,
                data: {
                    logs,
                    count: logs.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get security logs API error:', error);
            res.status(500).json({
                error: {
                    code: 'GET_SECURITY_LOGS_FAILED',
                    message: error.message || 'Failed to get security logs',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Get security statistics
router.get('/:meetingId/security-stats',
    authenticateToken,
    validateMeetingAccess,
    async (req, res) => {
        try {
            const { meetingId } = req.params;

            // Check if user is host
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting || meeting.hostId !== req.user.id) {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only the meeting host can view security statistics',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const stats = await meetingSecurityService.getSecurityStats(meetingId);

            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get security stats API error:', error);
            res.status(500).json({
                error: {
                    code: 'GET_SECURITY_STATS_FAILED',
                    message: error.message || 'Failed to get security statistics',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

export default router;