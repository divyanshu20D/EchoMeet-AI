const { z } = require('zod');

// Meeting creation schema
const meetingCreationSchema = z.object({
    title: z.string().min(1, 'Meeting title is required').max(200, 'Title must be less than 200 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    scheduledAt: z.string().datetime('Invalid date format').optional(),
    settings: z.object({
        isPublic: z.boolean().default(false),
        requirePassword: z.boolean().default(false),
        password: z.string().min(4, 'Password must be at least 4 characters').max(50, 'Password must be less than 50 characters').optional(),
        waitingRoomEnabled: z.boolean().default(false),
        recordingEnabled: z.boolean().default(false),
        maxParticipants: z.number().int().min(2).max(1000).default(100),
        allowScreenShare: z.boolean().default(true),
        allowChat: z.boolean().default(true),
        muteParticipantsOnJoin: z.boolean().default(false)
    }).optional()
});

// Meeting update schema
const meetingUpdateSchema = z.object({
    title: z.string().min(1, 'Meeting title is required').max(200, 'Title must be less than 200 characters').optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    scheduledAt: z.string().datetime('Invalid date format').optional(),
    settings: z.object({
        isPublic: z.boolean().optional(),
        requirePassword: z.boolean().optional(),
        password: z.string().min(4, 'Password must be at least 4 characters').max(50, 'Password must be less than 50 characters').optional(),
        waitingRoomEnabled: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
        maxParticipants: z.number().int().min(2).max(1000).optional(),
        allowScreenShare: z.boolean().optional(),
        allowChat: z.boolean().optional(),
        muteParticipantsOnJoin: z.boolean().optional()
    }).optional()
});

// Join meeting schema
const joinMeetingSchema = z.object({
    meetingId: z.string().min(1, 'Meeting ID is required'),
    userName: z.string().min(1, 'User name is required').max(100, 'Name must be less than 100 characters'),
    password: z.string().optional()
});

// Chat message schema
const chatMessageSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message must be less than 1000 characters')
});

module.exports = {
    meetingCreationSchema,
    meetingUpdateSchema,
    joinMeetingSchema,
    chatMessageSchema
};