import { getPrismaClient } from '../utils/database.js';
class UserService {
    constructor() {
        this.prisma = null;
    }

    getPrisma() {
        if (!this.prisma) {
            this.prisma = getPrismaClient();
        }
        return this.prisma;
    }

    async updateUserProfile(userId, updateData) {
        const updatedUser = await this.getPrisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                organizationId: true,
                preferences: true,
                updatedAt: true
            }
        });

        return updatedUser;
    }

    async getAllUsers(pagination) {
        const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.getPrisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    role: true,
                    organizationId: true,
                    isActive: true,
                    createdAt: true,
                    lastLoginAt: true,
                    organization: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip,
                take: limit
            }),
            this.getPrisma.user.count()
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getUserById(userId) {
        const user = await this.getPrisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                organizationId: true,
                preferences: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                lastLoginAt: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                        domain: true
                    }
                },
                _count: {
                    select: {
                        hostedMeetings: true,
                        participations: true
                    }
                }
            }
        });

        if (!user) {
            throw new Error('USER_NOT_FOUND');
        }

        return user;
    }

    async deactivateUser(userId, adminId) {
        // Prevent self-deactivation
        if (userId === adminId) {
            throw new Error('CANNOT_DEACTIVATE_SELF');
        }

        const user = await this.getPrisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('USER_NOT_FOUND');
        }

        const updatedUser = await this.getPrisma.user.update({
            where: { id: userId },
            data: { isActive: false },
            select: {
                id: true,
                email: true,
                name: true,
                isActive: true
            }
        });

        // Invalidate all user sessions
        await this.getPrisma.userSession.updateMany({
            where: { userId },
            data: { isActive: false }
        });

        return updatedUser;
    }

    async activateUser(userId) {
        const user = await this.getPrisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('USER_NOT_FOUND');
        }

        const updatedUser = await this.getPrisma.user.update({
            where: { id: userId },
            data: { isActive: true },
            select: {
                id: true,
                email: true,
                name: true,
                isActive: true
            }
        });

        return updatedUser;
    }
}

export default new UserService();