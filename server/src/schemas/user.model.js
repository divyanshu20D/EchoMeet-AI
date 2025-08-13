import { z } from 'zod';

// User registration schema
const userRegistrationSchema = z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
    organizationId: z.string().optional(),
    organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(100, 'Organization name must be less than 100 characters').optional()
});

// User login schema
const userLoginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required')
});

// User update schema
const userUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
    avatar: z.string().url('Invalid avatar URL').optional(),
    preferences: z.object({
        defaultAudioMuted: z.boolean().optional(),
        defaultVideoMuted: z.boolean().optional(),
        virtualBackground: z.string().optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        notifications: z.object({
            email: z.boolean().optional(),
            push: z.boolean().optional(),
            sms: z.boolean().optional()
        }).optional()
    }).optional()
});

// Password change schema
const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'New password must be less than 128 characters')
});

export {
    userRegistrationSchema,
    userLoginSchema,
    userUpdateSchema,
    passwordChangeSchema
};