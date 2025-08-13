import cacheService from './cacheService.js';
import { getRedisPublisher, getRedisSubscriber } from '../utils/redis.js';

class PresenceService {
    constructor() {
        this.presenceTTL = 30; // 30 seconds
        this.publisher = getRedisPublisher();
        this.subscriber = getRedisSubscriber();
        this.setupSubscriptions();
    }

    // Generate cache keys
    getUserPresenceKey(userId) {
        return `presence:user:${userId}`;
    }

    getOnlineUsersKey() {
        return 'presence:online_users';
    }

    getMeetingPresenceKey(meetingId) {
        return `presence:meeting:${meetingId}`;
    }

    getUserMeetingsKey(userId) {
        return `presence:user_meetings:${userId}`;
    }

    // Set user online status
    async setUserOnline(userId, userInfo = {}) {
        try {
            const presenceData = {
                userId,
                status: 'online',
                lastSeen: new Date().toISOString(),
                userInfo: {
                    name: userInfo.name,
                    email: userInfo.email,
                    avatar: userInfo.avatar
                },
                socketIds: [],
                activeMeetings: []
            };

            const userPresenceKey = this.getUserPresenceKey(userId);
            const onlineUsersKey = this.getOnlineUsersKey();

            // Set user presence with TTL
            await cacheService.set(userPresenceKey, presenceData, this.presenceTTL);

            // Add to online users set
            await cacheService.sadd(onlineUsersKey, userId);
            await cacheService.expire(onlineUsersKey, this.presenceTTL * 2);

            // Publish presence update
            await this.publisher.publish('presence:user_online', JSON.stringify({
                userId,
                status: 'online',
                timestamp: new Date().toISOString(),
                userInfo: presenceData.userInfo
            }));

            return presenceData;
        } catch (error) {
            console.error('Set user online error:', error);
            return null;
        }
    }

    // Set user offline status
    async setUserOffline(userId) {
        try {
            const userPresenceKey = this.getUserPresenceKey(userId);
            const onlineUsersKey = this.getOnlineUsersKey();

            // Get current presence data
            const presenceData = await cacheService.get(userPresenceKey);

            if (presenceData) {
                // Update status to offline
                presenceData.status = 'offline';
                presenceData.lastSeen = new Date().toISOString();

                // Set with longer TTL for offline status
                await cacheService.set(userPresenceKey, presenceData, 300); // 5 minutes

                // Remove from online users
                await cacheService.srem(onlineUsersKey, userId);

                // Remove from all active meetings
                for (const meetingId of presenceData.activeMeetings) {
                    await this.removeUserFromMeeting(userId, meetingId);
                }

                // Publish presence update
                await this.publisher.publish('presence:user_offline', JSON.stringify({
                    userId,
                    status: 'offline',
                    timestamp: new Date().toISOString()
                }));
            }

            return true;
        } catch (error) {
            console.error('Set user offline error:', error);
            return false;
        }
    }

    // Update user's last activity
    async updateUserActivity(userId, socketId = null) {
        try {
            const userPresenceKey = this.getUserPresenceKey(userId);
            const presenceData = await cacheService.get(userPresenceKey);

            if (presenceData) {
                presenceData.lastSeen = new Date().toISOString();

                // Add socket ID if provided
                if (socketId && !presenceData.socketIds.includes(socketId)) {
                    presenceData.socketIds.push(socketId);
                }

                // Refresh TTL
                await cacheService.set(userPresenceKey, presenceData, this.presenceTTL);

                // Refresh online users set
                await cacheService.sadd(this.getOnlineUsersKey(), userId);
                await cacheService.expire(this.getOnlineUsersKey(), this.presenceTTL * 2);
            }

            return presenceData;
        } catch (error) {
            console.error('Update user activity error:', error);
            return null;
        }
    }

    // Add user to meeting presence
    async addUserToMeeting(userId, meetingId, role = 'participant') {
        try {
            const userPresenceKey = this.getUserPresenceKey(userId);
            const meetingPresenceKey = this.getMeetingPresenceKey(meetingId);
            const userMeetingsKey = this.getUserMeetingsKey(userId);

            // Update user presence
            const presenceData = await cacheService.get(userPresenceKey);
            if (presenceData) {
                if (!presenceData.activeMeetings.includes(meetingId)) {
                    presenceData.activeMeetings.push(meetingId);
                    await cacheService.set(userPresenceKey, presenceData, this.presenceTTL);
                }
            }

            // Add to meeting participants
            const participantData = {
                userId,
                role,
                joinedAt: new Date().toISOString(),
                isAudioMuted: false,
                isVideoMuted: false,
                isScreenSharing: false
            };

            await cacheService.hset(meetingPresenceKey, userId, participantData, 3600); // 1 hour

            // Add to user's active meetings
            await cacheService.sadd(userMeetingsKey, meetingId);
            await cacheService.expire(userMeetingsKey, 3600);

            // Publish meeting join event
            await this.publisher.publish('presence:meeting_join', JSON.stringify({
                userId,
                meetingId,
                role,
                timestamp: new Date().toISOString()
            }));

            return participantData;
        } catch (error) {
            console.error('Add user to meeting error:', error);
            return null;
        }
    }

    // Remove user from meeting presence
    async removeUserFromMeeting(userId, meetingId) {
        try {
            const userPresenceKey = this.getUserPresenceKey(userId);
            const meetingPresenceKey = this.getMeetingPresenceKey(meetingId);
            const userMeetingsKey = this.getUserMeetingsKey(userId);

            // Update user presence
            const presenceData = await cacheService.get(userPresenceKey);
            if (presenceData) {
                presenceData.activeMeetings = presenceData.activeMeetings.filter(id => id !== meetingId);
                await cacheService.set(userPresenceKey, presenceData, this.presenceTTL);
            }

            // Remove from meeting participants
            await cacheService.hdel(meetingPresenceKey, userId);

            // Remove from user's active meetings
            await cacheService.srem(userMeetingsKey, meetingId);

            // Publish meeting leave event
            await this.publisher.publish('presence:meeting_leave', JSON.stringify({
                userId,
                meetingId,
                timestamp: new Date().toISOString()
            }));

            return true;
        } catch (error) {
            console.error('Remove user from meeting error:', error);
            return false;
        }
    }

    // Get user presence
    async getUserPresence(userId) {
        try {
            const userPresenceKey = this.getUserPresenceKey(userId);
            return await cacheService.get(userPresenceKey);
        } catch (error) {
            console.error('Get user presence error:', error);
            return null;
        }
    }

    // Get online users
    async getOnlineUsers() {
        try {
            const onlineUsersKey = this.getOnlineUsersKey();
            const userIds = await cacheService.smembers(onlineUsersKey);

            const presencePromises = userIds.map(userId =>
                this.getUserPresence(userId)
            );
            const presenceData = await Promise.all(presencePromises);

            return presenceData.filter(data => data && data.status === 'online');
        } catch (error) {
            console.error('Get online users error:', error);
            return [];
        }
    }

    // Get meeting participants
    async getMeetingParticipants(meetingId) {
        try {
            const meetingPresenceKey = this.getMeetingPresenceKey(meetingId);
            return await cacheService.hgetall(meetingPresenceKey);
        } catch (error) {
            console.error('Get meeting participants error:', error);
            return {};
        }
    }

    // Update participant media state
    async updateParticipantMedia(userId, meetingId, mediaState) {
        try {
            const meetingPresenceKey = this.getMeetingPresenceKey(meetingId);
            const participantData = await cacheService.hget(meetingPresenceKey, userId);

            if (participantData) {
                Object.assign(participantData, mediaState);
                await cacheService.hset(meetingPresenceKey, userId, participantData, 3600);

                // Publish media state update
                await this.publisher.publish('presence:media_update', JSON.stringify({
                    userId,
                    meetingId,
                    mediaState,
                    timestamp: new Date().toISOString()
                }));
            }

            return participantData;
        } catch (error) {
            console.error('Update participant media error:', error);
            return null;
        }
    }

    // Setup Redis subscriptions for presence events
    setupSubscriptions() {
        this.subscriber.subscribe('presence:user_online');
        this.subscriber.subscribe('presence:user_offline');
        this.subscriber.subscribe('presence:meeting_join');
        this.subscriber.subscribe('presence:meeting_leave');
        this.subscriber.subscribe('presence:media_update');

        this.subscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                this.handlePresenceEvent(channel, data);
            } catch (error) {
                console.error('Presence subscription error:', error);
            }
        });
    }

    // Handle presence events
    handlePresenceEvent(channel, data) {
        // This can be extended to handle cross-server presence synchronization
        console.log(`Presence event: ${channel}`, data);
    }

    // Cleanup expired presence data
    async cleanupExpiredPresence() {
        try {
            const onlineUsersKey = this.getOnlineUsersKey();
            const userIds = await cacheService.smembers(onlineUsersKey);
            let cleanedCount = 0;

            for (const userId of userIds) {
                const presence = await this.getUserPresence(userId);
                if (!presence) {
                    await cacheService.srem(onlineUsersKey, userId);
                    cleanedCount++;
                } else {
                    const lastSeen = new Date(presence.lastSeen);
                    const now = new Date();
                    const timeDiff = (now - lastSeen) / 1000; // seconds

                    if (timeDiff > this.presenceTTL * 2) {
                        await this.setUserOffline(userId);
                        cleanedCount++;
                    }
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired presence records`);
            return cleanedCount;
        } catch (error) {
            console.error('Cleanup expired presence error:', error);
            return 0;
        }
    }

    // Get presence statistics
    async getPresenceStats() {
        try {
            const onlineUsers = await this.getOnlineUsers();
            const meetingPattern = 'presence:meeting:*';
            const meetingKeys = await cacheService.keys(meetingPattern);

            let totalParticipants = 0;
            for (const meetingKey of meetingKeys) {
                const participants = await cacheService.hgetall(meetingKey);
                totalParticipants += Object.keys(participants).length;
            }

            return {
                onlineUsers: onlineUsers.length,
                activeMeetings: meetingKeys.length,
                totalParticipants,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Get presence stats error:', error);
            return {
                onlineUsers: 0,
                activeMeetings: 0,
                totalParticipants: 0,
                timestamp: new Date()
            };
        }
    }
}

export default new PresenceService();