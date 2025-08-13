import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import participantManagementService from '../services/participantManagementService.js';
import meetingCacheService from '../services/meetingCacheService.js';

const router = express.Router();

// Validation schemas
const addParticipantSchema = z.object({
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    userName: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['participant', 'moderator', 'host']).optional(),
    permissions: z.array(z.string()).optional(),
    socketId: z.string().optional(),
    metadata: z.object({}).optional()
});

const sendInvitationsSchema = z.object({
    meetingId: z.string().min(1),
    invitations: z.array(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.enum(['participant', 'moderator']).optional()
    }))
});

const joinRequestSchema = z.object({
    meetingId: z.string().min(1),
    userName: z.string().min(1),
    email: z.string().email().optional(),
    socketId: z.string().optional()
});

const updateRoleSchema = z.object({
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    role: z.enum(['participant', 'moderator', 'host'])
});

const updatePermissionsSchema = z.object({
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    permissions: z.array(z.string())
});

const muteParticipantSchema = z.object({
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    mediaType: z.enum(['audio', 'video']).optional()
});

const removeParticipantSchema = z.object({
    meetingId: z.string().min(1),
    userId: z.string().min(1),
    reason: z.string().optional()
});

// Add participant to meeting
router.post('/add', authenticateToken, async (req, res) => {
    try {
        const validatedData = addParticipantSchema.parse(req.body);

        // Check if user has permission to add participants
        const canAdd = await participantManagementService.hasPermission(
            validatedData.meetingId,
            req.user.id,
            'manage_participants'
        );

        if (!canAdd) {
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to add participants',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const participant = await participantManagementService.addParticipant(
            validatedData.meetingId,
            {
                ...validatedData,
                addedBy: req.user.id
            }
        );

        res.status(201).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Add participant API error:', error);

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
                code: 'ADD_PARTICIPANT_FAILED',
                message: error.message || 'Failed to add participant',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Send meeting invitations
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        const validatedData = sendInvitationsSchema.parse(req.body);

        // Check if user has permission to send invitations
        const canInvite = await participantManagementService.hasPermission(
            validatedData.meetingId,
            req.user.id,
            'manage_participants'
        );

        if (!canInvite) {
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to send invitations',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Add invitedBy to each invitation
        const invitationsWithInviter = validatedData.invitations.map(invitation => ({
            ...invitation,
            invitedBy: req.user.id
        }));

        const sentInvitations = await participantManagementService.sendInvitations(
            validatedData.meetingId,
            invitationsWithInviter
        );

        res.status(200).json({
            success: true,
            data: {
                invitations: sentInvitations,
                count: sentInvitations.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Send invitations API error:', error);

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
                code: 'SEND_INVITATIONS_FAILED',
                message: error.message || 'Failed to send invitations',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Request to join meeting
router.post('/join-request', authenticateToken, async (req, res) => {
    try {
        const validatedData = joinRequestSchema.parse(req.body);

        const joinRequest = await participantManagementService.requestToJoin(
            validatedData.meetingId,
            {
                userId: req.user.id,
                userName: validatedData.userName,
                email: validatedData.email || req.user.email,
                socketId: validatedData.socketId
            }
        );

        res.status(200).json({
            success: true,
            data: joinRequest,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Join request API error:', error);

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
                code: 'JOIN_REQUEST_FAILED',
                message: error.message || 'Failed to create join request',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Approve join request
router.post('/approve-join/:meetingId/:userId', authenticateToken, async (req, res) => {
    try {
        const { meetingId, userId } = req.params;

        const participant = await participantManagementService.approveJoinRequest(
            meetingId,
            userId,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Approve join request API error:', error);

        res.status(500).json({
            error: {
                code: 'APPROVE_JOIN_FAILED',
                message: error.message || 'Failed to approve join request',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Reject join request
router.post('/reject-join/:meetingId/:userId', authenticateToken, async (req, res) => {
    try {
        const { meetingId, userId } = req.params;
        const { reason } = req.body;

        await participantManagementService.rejectJoinRequest(
            meetingId,
            userId,
            req.user.id,
            reason
        );

        res.status(200).json({
            success: true,
            message: 'Join request rejected',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Reject join request API error:', error);

        res.status(500).json({
            error: {
                code: 'REJECT_JOIN_FAILED',
                message: error.message || 'Failed to reject join request',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Join meeting directly
router.post('/join', authenticateToken, async (req, res) => {
    try {
        const validatedData = joinRequestSchema.parse(req.body);

        const participant = await participantManagementService.joinMeeting(
            validatedData.meetingId,
            {
                userId: req.user.id,
                userName: validatedData.userName,
                email: validatedData.email || req.user.email,
                socketId: validatedData.socketId
            }
        );

        res.status(200).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Join meeting API error:', error);

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
                code: 'JOIN_MEETING_FAILED',
                message: error.message || 'Failed to join meeting',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Update participant role
router.put('/role', authenticateToken, async (req, res) => {
    try {
        const validatedData = updateRoleSchema.parse(req.body);

        const participant = await participantManagementService.updateParticipantRole(
            validatedData.meetingId,
            validatedData.userId,
            validatedData.role,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Update role API error:', error);

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
                code: 'UPDATE_ROLE_FAILED',
                message: error.message || 'Failed to update participant role',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Update participant permissions
router.put('/permissions', authenticateToken, async (req, res) => {
    try {
        const validatedData = updatePermissionsSchema.parse(req.body);

        const participant = await participantManagementService.updateParticipantPermissions(
            validatedData.meetingId,
            validatedData.userId,
            validatedData.permissions,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Update permissions API error:', error);

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
                code: 'UPDATE_PERMISSIONS_FAILED',
                message: error.message || 'Failed to update participant permissions',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Mute participant
router.post('/mute', authenticateToken, async (req, res) => {
    try {
        const validatedData = muteParticipantSchema.parse(req.body);

        await participantManagementService.muteParticipant(
            validatedData.meetingId,
            validatedData.userId,
            req.user.id,
            validatedData.mediaType || 'audio'
        );

        res.status(200).json({
            success: true,
            message: `Participant ${validatedData.mediaType || 'audio'} muted`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Mute participant API error:', error);

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
                code: 'MUTE_PARTICIPANT_FAILED',
                message: error.message || 'Failed to mute participant',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Mute all participants
router.post('/mute-all/:meetingId', authenticateToken, async (req, res) => {
    try {
        const { meetingId } = req.params;

        await participantManagementService.muteAllParticipants(meetingId, req.user.id);

        res.status(200).json({
            success: true,
            message: 'All participants muted',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Mute all participants API error:', error);

        res.status(500).json({
            error: {
                code: 'MUTE_ALL_FAILED',
                message: error.message || 'Failed to mute all participants',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Disable all participant videos
router.post('/disable-videos/:meetingId', authenticateToken, async (req, res) => {
    try {
        const { meetingId } = req.params;

        await participantManagementService.disableAllParticipantVideos(meetingId, req.user.id);

        res.status(200).json({
            success: true,
            message: 'All participant videos disabled',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Disable all videos API error:', error);

        res.status(500).json({
            error: {
                code: 'DISABLE_VIDEOS_FAILED',
                message: error.message || 'Failed to disable all participant videos',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Remove participant
router.delete('/remove', authenticateToken, async (req, res) => {
    try {
        const validatedData = removeParticipantSchema.parse(req.body);

        await participantManagementService.removeParticipant(
            validatedData.meetingId,
            validatedData.userId,
            req.user.id,
            validatedData.reason
        );

        res.status(200).json({
            success: true,
            message: 'Participant removed',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Remove participant API error:', error);

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
                code: 'REMOVE_PARTICIPANT_FAILED',
                message: error.message || 'Failed to remove participant',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Get meeting participants
router.get('/:meetingId', authenticateToken, async (req, res) => {
    try {
        const { meetingId } = req.params;

        // Check if user has access to the meeting
        const hasAccess = await participantManagementService.getParticipantDetails(meetingId, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({
                error: {
                    code: 'ACCESS_DENIED',
                    message: 'You do not have access to this meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const participants = await participantManagementService.getMeetingParticipants(meetingId);

        res.status(200).json({
            success: true,
            data: {
                participants,
                count: participants.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get participants API error:', error);

        res.status(500).json({
            error: {
                code: 'GET_PARTICIPANTS_FAILED',
                message: error.message || 'Failed to get meeting participants',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Get participant details
router.get('/:meetingId/:userId', authenticateToken, async (req, res) => {
    try {
        const { meetingId, userId } = req.params;

        // Check if user has access to the meeting
        const hasAccess = await participantManagementService.getParticipantDetails(meetingId, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({
                error: {
                    code: 'ACCESS_DENIED',
                    message: 'You do not have access to this meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const participant = await participantManagementService.getParticipantDetails(meetingId, userId);

        if (!participant) {
            return res.status(404).json({
                error: {
                    code: 'PARTICIPANT_NOT_FOUND',
                    message: 'Participant not found',
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.status(200).json({
            success: true,
            data: participant,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get participant details API error:', error);

        res.status(500).json({
            error: {
                code: 'GET_PARTICIPANT_FAILED',
                message: error.message || 'Failed to get participant details',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Get meeting statistics
router.get('/:meetingId/statistics', authenticateToken, async (req, res) => {
    try {
        const { meetingId } = req.params;

        // Check if user has access to the meeting
        const hasAccess = await participantManagementService.getParticipantDetails(meetingId, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({
                error: {
                    code: 'ACCESS_DENIED',
                    message: 'You do not have access to this meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const statistics = await participantManagementService.getMeetingStatistics(meetingId);

        res.status(200).json({
            success: true,
            data: statistics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get meeting statistics API error:', error);

        res.status(500).json({
            error: {
                code: 'GET_STATISTICS_FAILED',
                message: error.message || 'Failed to get meeting statistics',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Get participant activity log
router.get('/:meetingId/:userId/activity', authenticateToken, async (req, res) => {
    try {
        const { meetingId, userId } = req.params;
        const { limit = 50 } = req.query;

        // Check if user has permission to view activity
        const canView = await participantManagementService.hasPermission(meetingId, req.user.id, 'manage_participants');
        if (!canView && req.user.id !== userId) {
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to view participant activity',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const activity = await participantManagementService.getParticipantActivity(
            meetingId,
            userId,
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            data: {
                activity,
                count: activity.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Get participant activity API error:', error);

        res.status(500).json({
            error: {
                code: 'GET_ACTIVITY_FAILED',
                message: error.message || 'Failed to get participant activity',
                timestamp: new Date().toISOString()
            }
        });
    }
});

export default router;