import { getPrismaClient } from '../utils/database.js';
import { hashPassword, verifyPassword, generateTokenPair, verifyRefreshToken, invalidateUserSession } from '../utils/auth.js';
import sessionService from './sessionService.js';

class AuthService {
    constructor() {
        this.prisma = null;
    }

    getPrisma() {
        if (!this.prisma) {
            this.prisma = getPrismaClient();
        }
        return this.prisma;
    }

    async registerUser(userData) {
        const { email, name, password, organizationId, organizationName } = userData;

        // Check if user already exists
        const existingUser = await this.getPrisma().user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new Error('USER_EXISTS');
        }

        let finalOrganizationId = organizationId;

        // Handle organization creation or validation
        if (organizationName && !organizationId) {
            // Create a domain from organization name (simple approach)
            const domain = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.local';

            // Check if organization with this name already exists
            let organization = await this.getPrisma().organization.findFirst({
                where: { name: organizationName }
            });

            if (!organization) {
                // Create new organization
                organization = await this.getPrisma().organization.create({
                    data: {
                        name: organizationName,
                        domain: domain,
                        settings: {
                            allowPublicMeetings: true,
                            maxMeetingDuration: 240, // 4 hours
                            recordingEnabled: true
                        }
                    }
                });
            }

            finalOrganizationId = organization.id;
        } else if (organizationId) {
            // Validate existing organization ID
            const organization = await this.getPrisma().organization.findUnique({
                where: { id: organizationId }
            });

            if (!organization) {
                throw new Error('INVALID_ORGANIZATION');
            }
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await this.getPrisma().user.create({
            data: {
                email,
                name,
                passwordHash,
                organizationId: finalOrganizationId,
                preferences: {
                    defaultAudioMuted: false,
                    defaultVideoMuted: false,
                    language: 'en',
                    timezone: 'UTC',
                    notifications: {
                        email: true,
                        push: true,
                        sms: false
                    }
                }
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                organizationId: true,
                createdAt: true
            }
        });

        // Generate tokens
        const tokens = await generateTokenPair(user);

        return { user, tokens };
    }

    async loginUser(email, password) {
        // Find user
        const user = await this.getPrisma().user.findUnique({
            where: { email }
        });

        if (!user || !user.isActive) {
            throw new Error('INVALID_CREDENTIALS');
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new Error('INVALID_CREDENTIALS');
        }

        // Update last login
        await this.getPrisma().user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        // Generate tokens
        const tokens = await generateTokenPair(user);

        // Return user data without password
        const { passwordHash, ...userWithoutPassword } = user;

        return { user: userWithoutPassword, tokens };
    }

    async refreshToken(refreshToken) {
        if (!refreshToken) {
            throw new Error('MISSING_REFRESH_TOKEN');
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);

        // Get session from Redis
        const session = await sessionService.getSession(refreshToken);

        if (!session || !session.userInfo) {
            throw new Error('INVALID_REFRESH_TOKEN');
        }

        // Verify user is still active in database
        const user = await this.getPrisma().user.findUnique({
            where: { id: session.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                organizationId: true,
                isActive: true
            }
        });

        if (!user || !user.isActive) {
            await sessionService.invalidateSession(refreshToken);
            throw new Error('INVALID_REFRESH_TOKEN');
        }

        // Invalidate old refresh token
        await sessionService.invalidateSession(refreshToken);

        // Generate new tokens
        const tokens = await generateTokenPair(user);

        return { tokens };
    }

    async logoutUser(userId) {
        // Invalidate all Redis sessions for this user
        await sessionService.invalidateUserSessions(userId);

        // Also invalidate database sessions for backup
        await this.getPrisma().userSession.updateMany({
            where: { userId },
            data: { isActive: false }
        });
    }

    async changePassword(userId, currentPassword, newPassword) {
        // Get user with password
        const user = await this.getPrisma().user.findUnique({
            where: { id: userId }
        });

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);

        if (!isCurrentPasswordValid) {
            throw new Error('INVALID_CURRENT_PASSWORD');
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        await this.getPrisma().user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });

        // Invalidate all sessions to force re-login
        await this.getPrisma().userSession.updateMany({
            where: { userId },
            data: { isActive: false }
        });
    }

    async getUserProfile(userId) {
        const user = await this.getPrisma().user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                organizationId: true,
                preferences: true,
                createdAt: true,
                lastLoginAt: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                        domain: true
                    }
                }
            }
        });

        return user;
    }
}

export default new AuthService();