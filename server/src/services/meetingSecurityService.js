import bcrypt from 'bcryptjs';
import { getPrismaClient } from '../utils/database.js';
import { getRedisClient, getRedisPublisher } from '../utils/redis.js';
import cacheService from './cacheService.js';
import meetingCacheService from './meetingCacheService.js';

class MeetingSecurityService {
    constructor() {
        this.redis = getRedisClient();
        this.publisher = getRedisPublisher();

        // Security configurations
        this.passwordSaltRounds = 12;
        this.accessAttemptTTL = 15 * 60; // 15 minutes
        this.maxAccessAttempts = 5;
        this.waitingRoomTTL = 60 * 60; // 1 hour
        this.securityLogTTL = 7 * 24 * 60 * 60; // 7 days
    }

    // Generate cache keys
    getPasswordKey(meetingId) {
        return `meeting_password:${meetingId}`;
    }

    getAccessAttemptsKey(meetingId, identifier) {
        return `access_attempts:${meetingId}:${identifier}`;
    }

    getWaitingRoomKey(meetingId) {
        return `waiting_room:${meetingId}`;
    }

    getSecurityLogKey(meetingId) {
        return `security_log:${meetingId}`;
    }

    getBannedUsersKey(meetingId) {
        return `banned_users:${meetingId}`;
    }

    // Set meeting password
    async setMeetingPassword(meetingId, password, setBy) {
        try {
            if (!password || password.length < 4) {
                throw new Error('Password must be at least 4 characters long');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, this.passwordSaltRounds);

            // Store in database
            const prisma = getPrismaClient();
            await prisma.meeting.update({
                where: { id: meetingId },
                data: {
                    settings: {
                        ...await this.getMeetingSettings(meetingId),
                        hasPassword: true,
                        passwordHash: hashedPassword,
                        passwordSetBy: setBy,
                        passwordSetAt: new Date().toISOString()
                    }
                }
            });

            // Cache password hash
            const passwordKey = this.getPasswordKey(meetingId);
            await cacheService.set(passwordKey, hashedPassword, 24 * 60 * 60); // 24 hours

            // Update meeting cache
            await meetingCacheService.updateMeetingCache(meetingId, {
                'settings.hasPassword': true,
                'settings.passwordSetAt': new Date().toISOString()
            });

            // Log security event
            await this.logSecurityEvent(meetingId, {
                event: 'password_set',
                userId: setBy,
                timestamp: new Date().toISOString(),
                metadata: { passwordLength: password.length }
            });

            // Publish security event
            await this.publisher.publish('meeting:password_set', JSON.stringify({
                meetingId,
                setBy,
                timestamp: new Date().toISOString()
            }));

            console.log(`Password set for meeting ${meetingId} by ${setBy}`);
            return true;

        } catch (error) {
            console.error('Set meeting password error:', error);
            throw error;
        }
    }
    // Remove meeting password
    async removeMeetingPassword(meetingId, removedBy) {
        try {
            // Update database
            const prisma = getPrismaClient();
            await prisma.meeting.update({
                where: { id: meetingId },
                data: {
                    settings: {
                        ...await this.getMeetingSettings(meetingId),
                        hasPassword: false,
                        passwordHash: null,
                        passwordRemovedBy: removedBy,
                        passwordRemovedAt: new Date().toISOString()
                    }
                }
            });

            // Remove from cache
            const passwordKey = this.getPasswordKey(meetingId);
            await cacheService.del(passwordKey);

            // Update meeting cache
            await meetingCacheService.updateMeetingCache(meetingId, {
                'settings.hasPassword': false,
                'settings.passwordRemovedAt': new Date().toISOString()
            });

            // Log security event
            await this.logSecurityEvent(meetingId, {
                event: 'password_removed',
                userId: removedBy,
                timestamp: new Date().toISOString()
            });

            // Publish security event
            await this.publisher.publish('meeting:password_removed', JSON.stringify({
                meetingId,
                removedBy,
                timestamp: new Date().toISOString()
            }));

            console.log(`Password removed from meeting ${meetingId} by ${removedBy}`);
            return true;

        } catch (error) {
            console.error('Remove meeting password error:', error);
            throw error;
        }
    }

    // Verify meeting password
    async verifyMeetingPassword(meetingId, password, userId, clientInfo = {}) {
        try {
            const identifier = userId || clientInfo.ipAddress || 'anonymous';

            // Check access attempts
            const canAttempt = await this.checkAccessAttempts(meetingId, identifier);
            if (!canAttempt) {
                throw new Error('Too many failed attempts. Please try again later.');
            }

            // Get password hash from cache or database
            let passwordHash = await cacheService.get(this.getPasswordKey(meetingId));

            if (!passwordHash) {
                const meeting = await meetingCacheService.getMeeting(meetingId);
                if (!meeting || !meeting.settings?.hasPassword) {
                    throw new Error('Meeting does not require a password');
                }
                passwordHash = meeting.settings.passwordHash;

                // Cache for future requests
                await cacheService.set(this.getPasswordKey(meetingId), passwordHash, 24 * 60 * 60);
            }

            // Verify password
            const isValid = await bcrypt.compare(password, passwordHash);

            if (isValid) {
                // Reset access attempts on success
                await this.resetAccessAttempts(meetingId, identifier);

                // Log successful access
                await this.logSecurityEvent(meetingId, {
                    event: 'password_verified',
                    userId,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        clientInfo,
                        success: true
                    }
                });

                return true;
            } else {
                // Increment failed attempts
                await this.incrementAccessAttempts(meetingId, identifier);

                // Log failed attempt
                await this.logSecurityEvent(meetingId, {
                    event: 'password_failed',
                    userId,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        clientInfo,
                        success: false
                    }
                });

                throw new Error('Invalid password');
            }

        } catch (error) {
            console.error('Verify meeting password error:', error);
            throw error;
        }
    }

    // Check access attempts
    async checkAccessAttempts(meetingId, identifier) {
        try {
            const attemptsKey = this.getAccessAttemptsKey(meetingId, identifier);
            const attempts = await cacheService.get(attemptsKey) || 0;

            return attempts < this.maxAccessAttempts;

        } catch (error) {
            console.error('Check access attempts error:', error);
            return true; // Allow on error
        }
    }

    // Increment access attempts
    async incrementAccessAttempts(meetingId, identifier) {
        try {
            const attemptsKey = this.getAccessAttemptsKey(meetingId, identifier);
            const attempts = await cacheService.get(attemptsKey) || 0;

            await cacheService.set(attemptsKey, attempts + 1, this.accessAttemptTTL);

            // If max attempts reached, log security event
            if (attempts + 1 >= this.maxAccessAttempts) {
                await this.logSecurityEvent(meetingId, {
                    event: 'max_attempts_reached',
                    identifier,
                    timestamp: new Date().toISOString(),
                    metadata: { attempts: attempts + 1 }
                });
            }

        } catch (error) {
            console.error('Increment access attempts error:', error);
        }
    }

    // Reset access attempts
    async resetAccessAttempts(meetingId, identifier) {
        try {
            const attemptsKey = this.getAccessAttemptsKey(meetingId, identifier);
            await cacheService.del(attemptsKey);

        } catch (error) {
            console.error('Reset access attempts error:', error);
        }
    }

    // Enhanced waiting room with security
    async addToSecureWaitingRoom(meetingId, userInfo, securityCheck = {}) {
        try {
            const waitingRoomData = {
                userId: userInfo.userId,
                userName: userInfo.userName,
                email: userInfo.email,
                socketId: userInfo.socketId,
                addedAt: new Date().toISOString(),
                status: 'waiting',
                securityInfo: {
                    ipAddress: securityCheck.ipAddress,
                    userAgent: securityCheck.userAgent,
                    location: securityCheck.location,
                    riskScore: await this.calculateRiskScore(userInfo, securityCheck)
                }
            };

            // Check if user is banned
            const isBanned = await this.isUserBanned(meetingId, userInfo.userId);
            if (isBanned) {
                throw new Error('User is banned from this meeting');
            }

            // Add to waiting room
            const waitingRoomKey = this.getWaitingRoomKey(meetingId);
            await cacheService.hset(waitingRoomKey, userInfo.userId, waitingRoomData, this.waitingRoomTTL);

            // Log security event
            await this.logSecurityEvent(meetingId, {
                event: 'waiting_room_added',
                userId: userInfo.userId,
                timestamp: new Date().toISOString(),
                metadata: {
                    securityInfo: waitingRoomData.securityInfo,
                    riskScore: waitingRoomData.securityInfo.riskScore
                }
            });

            // Notify host/moderators
            await this.publisher.publish('waiting_room:user_added', JSON.stringify({
                meetingId,
                user: waitingRoomData,
                timestamp: new Date().toISOString()
            }));

            return waitingRoomData;

        } catch (error) {
            console.error('Add to secure waiting room error:', error);
            throw error;
        }
    }

    // Admit from waiting room with security validation
    async admitFromSecureWaitingRoom(meetingId, userId, admittedBy, securityValidation = true) {
        try {
            // Get waiting room data
            const waitingRoomKey = this.getWaitingRoomKey(meetingId);
            const waitingData = await cacheService.hget(waitingRoomKey, userId);

            if (!waitingData) {
                throw new Error('User not found in waiting room');
            }

            // Additional security validation if required
            if (securityValidation) {
                const riskScore = waitingData.securityInfo?.riskScore || 0;
                if (riskScore > 0.7) { // High risk threshold
                    await this.logSecurityEvent(meetingId, {
                        event: 'high_risk_admission',
                        userId,
                        admittedBy,
                        timestamp: new Date().toISOString(),
                        metadata: { riskScore }
                    });
                }
            }

            // Remove from waiting room
            await cacheService.hdel(waitingRoomKey, userId);

            // Log admission
            await this.logSecurityEvent(meetingId, {
                event: 'waiting_room_admitted',
                userId,
                admittedBy,
                timestamp: new Date().toISOString(),
                metadata: { securityInfo: waitingData.securityInfo }
            });

            // Publish admission event
            await this.publisher.publish('waiting_room:user_admitted', JSON.stringify({
                meetingId,
                userId,
                admittedBy,
                timestamp: new Date().toISOString()
            }));

            return waitingData;

        } catch (error) {
            console.error('Admit from secure waiting room error:', error);
            throw error;
        }
    }

    // Ban user from meeting
    async banUserFromMeeting(meetingId, userId, bannedBy, reason, duration = null) {
        try {
            const banData = {
                userId,
                bannedBy,
                reason,
                bannedAt: new Date().toISOString(),
                expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null,
                isActive: true
            };

            // Store ban in cache
            const bannedUsersKey = this.getBannedUsersKey(meetingId);
            const banTTL = duration || (30 * 24 * 60 * 60); // 30 days default
            await cacheService.hset(bannedUsersKey, userId, banData, banTTL);

            // Store in database for persistence
            const prisma = getPrismaClient();
            await prisma.meetingBan.create({
                data: {
                    meetingId,
                    userId,
                    bannedBy,
                    reason,
                    bannedAt: new Date(banData.bannedAt),
                    expiresAt: banData.expiresAt ? new Date(banData.expiresAt) : null,
                    isActive: true
                }
            });

            // Log security event
            await this.logSecurityEvent(meetingId, {
                event: 'user_banned',
                userId,
                bannedBy,
                timestamp: new Date().toISOString(),
                metadata: { reason, duration }
            });

            // Publish ban event
            await this.publisher.publish('meeting:user_banned', JSON.stringify({
                meetingId,
                userId,
                bannedBy,
                reason,
                timestamp: new Date().toISOString()
            }));

            console.log(`User ${userId} banned from meeting ${meetingId} by ${bannedBy}`);
            return banData;

        } catch (error) {
            console.error('Ban user from meeting error:', error);
            throw error;
        }
    }

    // Check if user is banned
    async isUserBanned(meetingId, userId) {
        try {
            const bannedUsersKey = this.getBannedUsersKey(meetingId);
            const banData = await cacheService.hget(bannedUsersKey, userId);

            if (!banData || !banData.isActive) {
                return false;
            }

            // Check if ban has expired
            if (banData.expiresAt && new Date(banData.expiresAt) < new Date()) {
                // Remove expired ban
                await cacheService.hdel(bannedUsersKey, userId);
                return false;
            }

            return true;

        } catch (error) {
            console.error('Check user banned error:', error);
            return false;
        }
    }

    // Calculate risk score for security assessment
    async calculateRiskScore(userInfo, securityCheck) {
        try {
            let riskScore = 0;

            // Check for suspicious patterns
            if (!userInfo.email || !userInfo.email.includes('@')) {
                riskScore += 0.2;
            }

            if (!securityCheck.userAgent || securityCheck.userAgent.includes('bot')) {
                riskScore += 0.3;
            }

            // Check for rapid successive attempts
            const recentAttempts = await this.getRecentAccessAttempts(userInfo.userId);
            if (recentAttempts > 3) {
                riskScore += 0.2;
            }

            // Geographic location check (if available)
            if (securityCheck.location && await this.isHighRiskLocation(securityCheck.location)) {
                riskScore += 0.1;
            }

            return Math.min(riskScore, 1.0); // Cap at 1.0

        } catch (error) {
            console.error('Calculate risk score error:', error);
            return 0.5; // Default medium risk
        }
    }

    // Log security events
    async logSecurityEvent(meetingId, eventData) {
        try {
            const securityLogKey = this.getSecurityLogKey(meetingId);
            const logEntry = {
                ...eventData,
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                meetingId
            };

            await cacheService.lpush(securityLogKey, logEntry);
            await cacheService.expire(securityLogKey, this.securityLogTTL);

            // Keep only last 1000 entries
            const logSize = await cacheService.llen(securityLogKey);
            if (logSize > 1000) {
                await cacheService.ltrim(securityLogKey, 0, 999);
            }

        } catch (error) {
            console.error('Log security event error:', error);
        }
    }

    // Get security logs for a meeting
    async getSecurityLogs(meetingId, limit = 100) {
        try {
            const securityLogKey = this.getSecurityLogKey(meetingId);
            return await cacheService.lrange(securityLogKey, 0, limit - 1);

        } catch (error) {
            console.error('Get security logs error:', error);
            return [];
        }
    }

    // Get meeting settings helper
    async getMeetingSettings(meetingId) {
        try {
            const meeting = await meetingCacheService.getMeeting(meetingId);
            return meeting?.settings || {};

        } catch (error) {
            console.error('Get meeting settings error:', error);
            return {};
        }
    }

    // Helper methods
    async getRecentAccessAttempts(userId) {
        // Implementation for tracking recent access attempts
        return 0;
    }

    async isHighRiskLocation(location) {
        // Implementation for geographic risk assessment
        return false;
    }

    // Get security statistics
    async getSecurityStats(meetingId) {
        try {
            const logs = await this.getSecurityLogs(meetingId, 1000);
            const bannedUsersKey = this.getBannedUsersKey(meetingId);
            const bannedUsers = await cacheService.hgetall(bannedUsersKey);

            const stats = {
                totalSecurityEvents: logs.length,
                eventsByType: {},
                bannedUsersCount: Object.keys(bannedUsers).length,
                recentEvents: logs.slice(0, 10),
                riskAssessment: 'low' // Default
            };

            // Count events by type
            logs.forEach(log => {
                stats.eventsByType[log.event] = (stats.eventsByType[log.event] || 0) + 1;
            });

            // Assess overall risk
            const highRiskEvents = ['max_attempts_reached', 'user_banned', 'high_risk_admission'];
            const highRiskCount = highRiskEvents.reduce((count, event) =>
                count + (stats.eventsByType[event] || 0), 0);

            if (highRiskCount > 10) {
                stats.riskAssessment = 'high';
            } else if (highRiskCount > 5) {
                stats.riskAssessment = 'medium';
            }

            return stats;

        } catch (error) {
            console.error('Get security stats error:', error);
            return {
                totalSecurityEvents: 0,
                eventsByType: {},
                bannedUsersCount: 0,
                recentEvents: [],
                riskAssessment: 'unknown'
            };
        }
    }
}

export default new MeetingSecurityService();