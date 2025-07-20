const cacheService = require('./cacheService');
const { getPrismaClient } = require('../utils/database');

class SessionService {
    constructor() {
        this.sessionTTL = 7 * 24 * 60 * 60; // 7 days in seconds
        this.activeSessionsTTL = 24 * 60 * 60; // 24 hours for active sessions tracking
    }

    // Generate cache keys
    getSessionKey(token) {
        return `session:${token}`;
    }

    getUserSessionsKey(userId) {
        return `user_sessions:${userId}`;
    }

    getActiveUsersKey() {
        return 'active_users';
    }

    // Create user session in Redis
    async createSession(userId, token, expiresAt, userInfo = {}) {
        try {
            const sessionData = {
                userId,
                token,
                expiresAt: expiresAt.toISOString(),
                createdAt: new Date().toISOString(),
                isActive: true,
                userInfo: {
                    email: userInfo.email,
                    name: userInfo.name,
                    role: userInfo.role,
                    organizationId: userInfo.organizationId
                },
                lastActivity: new Date().toISOString()
            };

            const sessionKey = this.getSessionKey(token);
            const userSessionsKey = this.getUserSessionsKey(userId);

            // Store session data
            await cacheService.set(sessionKey, sessionData, this.sessionTTL);

            // Add to user's active sessions
            await cacheService.sadd(userSessionsKey, token);
            await cacheService.expire(userSessionsKey, this.sessionTTL);

            // Add to active users set
            await cacheService.sadd(this.getActiveUsersKey(), userId);
            await cacheService.expire(this.getActiveUsersKey(), this.activeSessionsTTL);

            return sessionData;
        } catch (error) {
            console.error('Create session error:', error);
            throw new Error('Failed to create session');
        }
    }

    // Get session from Redis
    async getSession(token) {
        try {
            const sessionKey = this.getSessionKey(token);
            const sessionData = await cacheService.get(sessionKey);

            if (!sessionData) {
                return null;
            }

            // Check if session is expired
            const expiresAt = new Date(sessionData.expiresAt);
            if (expiresAt <= new Date()) {
                await this.invalidateSession(token);
                return null;
            }

            // Update last activity
            sessionData.lastActivity = new Date().toISOString();
            await cacheService.set(sessionKey, sessionData, this.sessionTTL);

            return sessionData;
        } catch (error) {
            console.error('Get session error:', error);
            return null;
        }
    }

    // Invalidate single session
    async invalidateSession(token) {
        try {
            const sessionKey = this.getSessionKey(token);
            const sessionData = await cacheService.get(sessionKey);

            if (sessionData) {
                const userSessionsKey = this.getUserSessionsKey(sessionData.userId);

                // Remove from user's active sessions
                await cacheService.srem(userSessionsKey, token);

                // Check if user has any other active sessions
                const userSessions = await cacheService.smembers(userSessionsKey);
                if (userSessions.length === 0) {
                    // Remove from active users if no sessions left
                    await cacheService.srem(this.getActiveUsersKey(), sessionData.userId);
                }
            }

            // Delete session
            await cacheService.del(sessionKey);
            return true;
        } catch (error) {
            console.error('Invalidate session error:', error);
            return false;
        }
    }

    // Invalidate all sessions for a user
    async invalidateUserSessions(userId) {
        try {
            const userSessionsKey = this.getUserSessionsKey(userId);
            const tokens = await cacheService.smembers(userSessionsKey);

            // Delete all session keys
            const deletePromises = tokens.map(token =>
                cacheService.del(this.getSessionKey(token))
            );
            await Promise.all(deletePromises);

            // Clear user sessions set
            await cacheService.del(userSessionsKey);

            // Remove from active users
            await cacheService.srem(this.getActiveUsersKey(), userId);

            return tokens.length;
        } catch (error) {
            console.error('Invalidate user sessions error:', error);
            return 0;
        }
    }

    // Get all active sessions for a user
    async getUserSessions(userId) {
        try {
            const userSessionsKey = this.getUserSessionsKey(userId);
            const tokens = await cacheService.smembers(userSessionsKey);

            const sessionPromises = tokens.map(token =>
                cacheService.get(this.getSessionKey(token))
            );
            const sessions = await Promise.all(sessionPromises);

            // Filter out null sessions and expired ones
            const validSessions = sessions.filter(session => {
                if (!session) return false;
                const expiresAt = new Date(session.expiresAt);
                return expiresAt > new Date();
            });

            return validSessions;
        } catch (error) {
            console.error('Get user sessions error:', error);
            return [];
        }
    }

    // Get active users count
    async getActiveUsersCount() {
        try {
            const activeUsers = await cacheService.smembers(this.getActiveUsersKey());
            return activeUsers.length;
        } catch (error) {
            console.error('Get active users count error:', error);
            return 0;
        }
    }

    // Get active users list
    async getActiveUsers() {
        try {
            return await cacheService.smembers(this.getActiveUsersKey());
        } catch (error) {
            console.error('Get active users error:', error);
            return [];
        }
    }

    // Update session activity
    async updateSessionActivity(token) {
        try {
            const sessionKey = this.getSessionKey(token);
            const sessionData = await cacheService.get(sessionKey);

            if (sessionData) {
                sessionData.lastActivity = new Date().toISOString();
                await cacheService.set(sessionKey, sessionData, this.sessionTTL);

                // Refresh user in active users set
                await cacheService.sadd(this.getActiveUsersKey(), sessionData.userId);
                await cacheService.expire(this.getActiveUsersKey(), this.activeSessionsTTL);
            }

            return sessionData;
        } catch (error) {
            console.error('Update session activity error:', error);
            return null;
        }
    }

    // Cleanup expired sessions (run periodically)
    async cleanupExpiredSessions() {
        try {
            const pattern = 'session:*';
            const sessionKeys = await cacheService.keys(pattern);
            let cleanedCount = 0;

            for (const sessionKey of sessionKeys) {
                const sessionData = await cacheService.get(sessionKey);
                if (sessionData) {
                    const expiresAt = new Date(sessionData.expiresAt);
                    if (expiresAt <= new Date()) {
                        const token = sessionKey.replace('session:', '');
                        await this.invalidateSession(token);
                        cleanedCount++;
                    }
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired sessions`);
            return cleanedCount;
        } catch (error) {
            console.error('Cleanup expired sessions error:', error);
            return 0;
        }
    }

    // Migrate existing database sessions to Redis (one-time operation)
    async migrateDatabaseSessions() {
        try {
            const prisma = getPrismaClient();
            const dbSessions = await prisma.userSession.findMany({
                where: {
                    isActive: true,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            role: true,
                            organizationId: true
                        }
                    }
                }
            });

            let migratedCount = 0;
            for (const dbSession of dbSessions) {
                await this.createSession(
                    dbSession.userId,
                    dbSession.token,
                    dbSession.expiresAt,
                    dbSession.user
                );
                migratedCount++;
            }

            console.log(`Migrated ${migratedCount} sessions from database to Redis`);
            return migratedCount;
        } catch (error) {
            console.error('Migrate database sessions error:', error);
            return 0;
        }
    }

    // Get session statistics
    async getSessionStats() {
        try {
            const activeUsersCount = await this.getActiveUsersCount();
            const sessionPattern = 'session:*';
            const sessionKeys = await cacheService.keys(sessionPattern);

            return {
                totalSessions: sessionKeys.length,
                activeUsers: activeUsersCount,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Get session stats error:', error);
            return {
                totalSessions: 0,
                activeUsers: 0,
                timestamp: new Date()
            };
        }
    }
}

module.exports = new SessionService();