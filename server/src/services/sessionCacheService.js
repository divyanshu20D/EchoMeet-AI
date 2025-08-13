import { getRedisClient } from '../utils/redis.js';

class SessionCacheService {
    constructor() {
        this.redis = getRedisClient();
        this.sessionPrefix = 'session:';
        this.userSessionPrefix = 'user_sessions:';
        this.refreshTokenPrefix = 'refresh_token:';

        // TTL configurations (in seconds)
        this.sessionTTL = 15 * 60; // 15 minutes (matches JWT expiry)
        this.refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days
        this.userSessionsTTL = 24 * 60 * 60; // 24 hours
    }

    // Session Management
    async setSession(sessionId, sessionData) {
        try {
            const key = `${this.sessionPrefix}${sessionId}`;
            const data = JSON.stringify({
                ...sessionData,
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            });

            await this.redis.setex(key, this.sessionTTL, data);

            // Also track user sessions
            if (sessionData.userId) {
                await this.addUserSession(sessionData.userId, sessionId);
            }

            return true;
        } catch (error) {
            console.error('Error setting session cache:', error);
            return false;
        }
    }

    async getSession(sessionId) {
        try {
            const key = `${this.sessionPrefix}${sessionId}`;
            const data = await this.redis.get(key);

            if (!data) {
                return null;
            }

            const sessionData = JSON.parse(data);

            // Update last accessed time
            sessionData.lastAccessed = new Date().toISOString();
            await this.redis.setex(key, this.sessionTTL, JSON.stringify(sessionData));

            return sessionData;
        } catch (error) {
            console.error('Error getting session cache:', error);
            return null;
        }
    }

    async deleteSession(sessionId) {
        try {
            const key = `${this.sessionPrefix}${sessionId}`;

            // Get session data to remove from user sessions
            const sessionData = await this.getSession(sessionId);
            if (sessionData && sessionData.userId) {
                await this.removeUserSession(sessionData.userId, sessionId);
            }

            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error('Error deleting session cache:', error);
            return false;
        }
    }

    async extendSession(sessionId, additionalTime = null) {
        try {
            const key = `${this.sessionPrefix}${sessionId}`;
            const ttl = additionalTime || this.sessionTTL;

            const exists = await this.redis.exists(key);
            if (exists) {
                await this.redis.expire(key, ttl);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error extending session cache:', error);
            return false;
        }
    }

    // Refresh Token Management
    async setRefreshToken(tokenId, tokenData) {
        try {
            const key = `${this.refreshTokenPrefix}${tokenId}`;
            const data = JSON.stringify({
                ...tokenData,
                createdAt: new Date().toISOString()
            });

            await this.redis.setex(key, this.refreshTokenTTL, data);
            return true;
        } catch (error) {
            console.error('Error setting refresh token cache:', error);
            return false;
        }
    }

    async getRefreshToken(tokenId) {
        try {
            const key = `${this.refreshTokenPrefix}${tokenId}`;
            const data = await this.redis.get(key);

            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting refresh token cache:', error);
            return null;
        }
    }

    async deleteRefreshToken(tokenId) {
        try {
            const key = `${this.refreshTokenPrefix}${tokenId}`;
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error('Error deleting refresh token cache:', error);
            return false;
        }
    }

    // User Session Tracking
    async addUserSession(userId, sessionId) {
        try {
            const key = `${this.userSessionPrefix}${userId}`;
            await this.redis.sadd(key, sessionId);
            await this.redis.expire(key, this.userSessionsTTL);
            return true;
        } catch (error) {
            console.error('Error adding user session:', error);
            return false;
        }
    }

    async removeUserSession(userId, sessionId) {
        try {
            const key = `${this.userSessionPrefix}${userId}`;
            await this.redis.srem(key, sessionId);
            return true;
        } catch (error) {
            console.error('Error removing user session:', error);
            return false;
        }
    }

    async getUserSessions(userId) {
        try {
            const key = `${this.userSessionPrefix}${userId}`;
            const sessionIds = await this.redis.smembers(key);

            const sessions = [];
            for (const sessionId of sessionIds) {
                const sessionData = await this.getSession(sessionId);
                if (sessionData) {
                    sessions.push({ sessionId, ...sessionData });
                } else {
                    // Clean up invalid session reference
                    await this.removeUserSession(userId, sessionId);
                }
            }

            return sessions;
        } catch (error) {
            console.error('Error getting user sessions:', error);
            return [];
        }
    }

    async invalidateAllUserSessions(userId) {
        try {
            const sessionIds = await this.redis.smembers(`${this.userSessionPrefix}${userId}`);

            const promises = sessionIds.map(sessionId => this.deleteSession(sessionId));
            await Promise.all(promises);

            // Clear the user sessions set
            await this.redis.del(`${this.userSessionPrefix}${userId}`);

            return true;
        } catch (error) {
            console.error('Error invalidating user sessions:', error);
            return false;
        }
    }

    // Cache Statistics
    async getSessionStats() {
        try {
            const sessionKeys = await this.redis.keys(`${this.sessionPrefix}*`);
            const refreshTokenKeys = await this.redis.keys(`${this.refreshTokenPrefix}*`);
            const userSessionKeys = await this.redis.keys(`${this.userSessionPrefix}*`);

            return {
                totalSessions: sessionKeys.length,
                totalRefreshTokens: refreshTokenKeys.length,
                activeUsers: userSessionKeys.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting session stats:', error);
            return {
                totalSessions: 0,
                totalRefreshTokens: 0,
                activeUsers: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Cleanup expired sessions
    async cleanupExpiredSessions() {
        try {
            let cleanedCount = 0;

            // Get all session keys
            const sessionKeys = await this.redis.keys(`${this.sessionPrefix}*`);

            for (const key of sessionKeys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1 || ttl === -2) { // -1: no expiry, -2: doesn't exist
                    await this.redis.del(key);
                    cleanedCount++;
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired sessions`);
            return cleanedCount;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            return 0;
        }
    }
}

export default new SessionCacheService();