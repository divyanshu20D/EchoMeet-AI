import cacheService from './cacheService.js';
import { getRedisPublisher, getRedisSubscriber } from '../utils/redis.js';
import { getPrismaClient } from '../utils/database.js';

class MeetingCacheService {
    constructor() {
        this.meetingTTL = 4 * 60 * 60; // 4 hours in seconds
        this.participantTTL = 2 * 60 * 60; // 2 hours in seconds
        this.publisher = getRedisPublisher();
        this.subscriber = getRedisSubscriber();
        this.setupSubscriptions();
    }

    // Generate cache keys
    getMeetingKey(meetingId) {
        return `meeting:${meetingId}`;
    }

    getMeetingParticipantsKey(meetingId) {
        return `meeting:${meetingId}:participants`;
    }

    getMeetingSettingsKey(meetingId) {
        return `meeting:${meetingId}:settings`;
    }

    getMeetingStateKey(meetingId) {
        return `meeting:${meetingId}:state`;
    }

    getActiveMeetingsKey() {
        return 'meetings:active';
    }

    getUserActiveMeetingsKey(userId) {
        return `user:${userId}:active_meetings`;
    }

    // Cache meeting data
    async cacheMeeting(meetingData) {
        try {
            const meetingKey = this.getMeetingKey(meetingData.id);
            const activeMeetingsKey = this.getActiveMeetingsKey();

            // Cache basic meeting data
            const cachedMeeting = {
                id: meetingData.id,
                title: meetingData.title,
                description: meetingData.description,
                hostId: meetingData.hostId,
                organizationId: meetingData.organizationId,
                status: meetingData.status,
                scheduledAt: meetingData.scheduledAt,
                startedAt: meetingData.startedAt,
                endedAt: meetingData.endedAt,
                duration: meetingData.duration,
                createdAt: meetingData.createdAt,
                updatedAt: meetingData.updatedAt,
                host: meetingData.host,
                cachedAt: new Date().toISOString()
            };

            await cacheService.set(meetingKey, cachedMeeting, this.meetingTTL);

            // Cache meeting settings separately
            if (meetingData.settings) {
                const settingsKey = this.getMeetingSettingsKey(meetingData.id);
                await cacheService.set(settingsKey, meetingData.settings, this.meetingTTL);
            }

            // Add to active meetings if status is ACTIVE
            if (meetingData.status === 'ACTIVE') {
                await cacheService.sadd(activeMeetingsKey, meetingData.id);
                await cacheService.expire(activeMeetingsKey, this.meetingTTL);
            }

            return cachedMeeting;
        } catch (error) {
            console.error('Cache meeting error:', error);
            return null;
        }
    }

    // Get cached meeting
    async getCachedMeeting(meetingId) {
        try {
            const meetingKey = this.getMeetingKey(meetingId);
            const settingsKey = this.getMeetingSettingsKey(meetingId);

            const [meetingData, settings] = await Promise.all([
                cacheService.get(meetingKey),
                cacheService.get(settingsKey)
            ]);

            if (meetingData) {
                meetingData.settings = settings;
                return meetingData;
            }

            return null;
        } catch (error) {
            console.error('Get cached meeting error:', error);
            return null;
        }
    }

    // Get meeting with fallback to database
    async getMeeting(meetingId) {
        try {
            // Try cache first
            let meeting = await this.getCachedMeeting(meetingId);

            if (meeting) {
                return meeting;
            }

            // Fallback to database
            const prisma = getPrismaClient();
            const dbMeeting = await prisma.meeting.findUnique({
                where: { id: meetingId },
                include: {
                    host: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (dbMeeting) {
                // Cache the meeting for future requests
                meeting = await this.cacheMeeting(dbMeeting);
                return meeting;
            }

            return null;
        } catch (error) {
            console.error('Get meeting error:', error);
            return null;
        }
    }

    // Update meeting cache
    async updateMeetingCache(meetingId, updateData) {
        try {
            const meetingKey = this.getMeetingKey(meetingId);
            const cachedMeeting = await cacheService.get(meetingKey);

            if (cachedMeeting) {
                Object.assign(cachedMeeting, updateData);
                cachedMeeting.updatedAt = new Date().toISOString();
                await cacheService.set(meetingKey, cachedMeeting, this.meetingTTL);

                // Publish meeting update event
                await this.publisher.publish('meeting:updated', JSON.stringify({
                    meetingId,
                    updateData,
                    timestamp: new Date().toISOString()
                }));
            }

            return cachedMeeting;
        } catch (error) {
            console.error('Update meeting cache error:', error);
            return null;
        }
    }

    // Cache meeting participants
    async cacheMeetingParticipants(meetingId, participants) {
        try {
            const participantsKey = this.getMeetingParticipantsKey(meetingId);

            // Store each participant with their data
            for (const participant of participants) {
                await cacheService.hset(participantsKey, participant.userId, {
                    id: participant.id,
                    userId: participant.userId,
                    role: participant.role,
                    joinedAt: participant.joinedAt,
                    leftAt: participant.leftAt,
                    isAudioMuted: participant.isAudioMuted,
                    isVideoMuted: participant.isVideoMuted,
                    isScreenSharing: participant.isScreenSharing,
                    user: participant.user
                }, this.participantTTL);
            }

            return true;
        } catch (error) {
            console.error('Cache meeting participants error:', error);
            return false;
        }
    }

    // Get cached meeting participants
    async getCachedMeetingParticipants(meetingId) {
        try {
            const participantsKey = this.getMeetingParticipantsKey(meetingId);
            const participantsHash = await cacheService.hgetall(participantsKey);

            return Object.values(participantsHash);
        } catch (error) {
            console.error('Get cached meeting participants error:', error);
            return [];
        }
    }

    // Add participant to meeting cache
    async addParticipantToMeeting(meetingId, participantData) {
        try {
            const participantsKey = this.getMeetingParticipantsKey(meetingId);
            const userActiveMeetingsKey = this.getUserActiveMeetingsKey(participantData.userId);

            // Add participant to meeting
            await cacheService.hset(participantsKey, participantData.userId, participantData, this.participantTTL);

            // Add meeting to user's active meetings
            await cacheService.sadd(userActiveMeetingsKey, meetingId);
            await cacheService.expire(userActiveMeetingsKey, this.participantTTL);

            // Publish participant joined event
            await this.publisher.publish('meeting:participant_joined', JSON.stringify({
                meetingId,
                participant: participantData,
                timestamp: new Date().toISOString()
            }));

            return true;
        } catch (error) {
            console.error('Add participant to meeting error:', error);
            return false;
        }
    }

    // Remove participant from meeting cache
    async removeParticipantFromMeeting(meetingId, userId) {
        try {
            const participantsKey = this.getMeetingParticipantsKey(meetingId);
            const userActiveMeetingsKey = this.getUserActiveMeetingsKey(userId);

            // Get participant data before removal
            const participantData = await cacheService.hget(participantsKey, userId);

            // Remove participant from meeting
            await cacheService.hdel(participantsKey, userId);

            // Remove meeting from user's active meetings
            await cacheService.srem(userActiveMeetingsKey, meetingId);

            // Publish participant left event
            if (participantData) {
                await this.publisher.publish('meeting:participant_left', JSON.stringify({
                    meetingId,
                    participant: participantData,
                    timestamp: new Date().toISOString()
                }));
            }

            return true;
        } catch (error) {
            console.error('Remove participant from meeting error:', error);
            return false;
        }
    }

    // Update participant state
    async updateParticipantState(meetingId, userId, stateUpdate) {
        try {
            const participantsKey = this.getMeetingParticipantsKey(meetingId);
            const participantData = await cacheService.hget(participantsKey, userId);

            if (participantData) {
                Object.assign(participantData, stateUpdate);
                await cacheService.hset(participantsKey, userId, participantData, this.participantTTL);

                // Publish participant state update
                await this.publisher.publish('meeting:participant_updated', JSON.stringify({
                    meetingId,
                    userId,
                    stateUpdate,
                    timestamp: new Date().toISOString()
                }));
            }

            return participantData;
        } catch (error) {
            console.error('Update participant state error:', error);
            return null;
        }
    }

    // Set meeting state (for real-time features)
    async setMeetingState(meetingId, state) {
        try {
            const stateKey = this.getMeetingStateKey(meetingId);
            const stateData = {
                ...state,
                lastUpdated: new Date().toISOString()
            };

            await cacheService.set(stateKey, stateData, this.meetingTTL);

            // Publish meeting state update
            await this.publisher.publish('meeting:state_updated', JSON.stringify({
                meetingId,
                state: stateData,
                timestamp: new Date().toISOString()
            }));

            return stateData;
        } catch (error) {
            console.error('Set meeting state error:', error);
            return null;
        }
    }

    // Get meeting state
    async getMeetingState(meetingId) {
        try {
            const stateKey = this.getMeetingStateKey(meetingId);
            return await cacheService.get(stateKey);
        } catch (error) {
            console.error('Get meeting state error:', error);
            return null;
        }
    }

    // Start meeting (update cache and state)
    async startMeeting(meetingId) {
        try {
            const activeMeetingsKey = this.getActiveMeetingsKey();
            const startedAt = new Date();

            // Update meeting cache
            await this.updateMeetingCache(meetingId, {
                status: 'ACTIVE',
                startedAt: startedAt.toISOString()
            });

            // Add to active meetings
            await cacheService.sadd(activeMeetingsKey, meetingId);
            await cacheService.expire(activeMeetingsKey, this.meetingTTL);

            // Set initial meeting state
            await this.setMeetingState(meetingId, {
                status: 'ACTIVE',
                startedAt: startedAt.toISOString(),
                participantCount: 0,
                isRecording: false,
                screenSharingUserId: null
            });

            // Publish meeting started event
            await this.publisher.publish('meeting:started', JSON.stringify({
                meetingId,
                startedAt: startedAt.toISOString(),
                timestamp: new Date().toISOString()
            }));

            return true;
        } catch (error) {
            console.error('Start meeting error:', error);
            return false;
        }
    }

    // End meeting (update cache and cleanup)
    async endMeeting(meetingId) {
        try {
            const activeMeetingsKey = this.getActiveMeetingsKey();
            const endedAt = new Date();

            // Get current meeting data for duration calculation
            const meeting = await this.getCachedMeeting(meetingId);
            let duration = null;

            if (meeting && meeting.startedAt) {
                const startTime = new Date(meeting.startedAt);
                duration = Math.floor((endedAt - startTime) / 1000 / 60); // in minutes
            }

            // Update meeting cache
            await this.updateMeetingCache(meetingId, {
                status: 'ENDED',
                endedAt: endedAt.toISOString(),
                duration
            });

            // Remove from active meetings
            await cacheService.srem(activeMeetingsKey, meetingId);

            // Update meeting state
            await this.setMeetingState(meetingId, {
                status: 'ENDED',
                endedAt: endedAt.toISOString(),
                duration
            });

            // Mark all participants as left
            const participants = await this.getCachedMeetingParticipants(meetingId);
            for (const participant of participants) {
                if (!participant.leftAt) {
                    await this.updateParticipantState(meetingId, participant.userId, {
                        leftAt: endedAt.toISOString()
                    });
                }
            }

            // Publish meeting ended event
            await this.publisher.publish('meeting:ended', JSON.stringify({
                meetingId,
                endedAt: endedAt.toISOString(),
                duration,
                timestamp: new Date().toISOString()
            }));

            return true;
        } catch (error) {
            console.error('End meeting error:', error);
            return false;
        }
    }

    // Get active meetings
    async getActiveMeetings() {
        try {
            const activeMeetingsKey = this.getActiveMeetingsKey();
            const meetingIds = await cacheService.smembers(activeMeetingsKey);

            const meetingPromises = meetingIds.map(id => this.getCachedMeeting(id));
            const meetings = await Promise.all(meetingPromises);

            return meetings.filter(meeting => meeting !== null);
        } catch (error) {
            console.error('Get active meetings error:', error);
            return [];
        }
    }

    // Get user's active meetings
    async getUserActiveMeetings(userId) {
        try {
            const userActiveMeetingsKey = this.getUserActiveMeetingsKey(userId);
            const meetingIds = await cacheService.smembers(userActiveMeetingsKey);

            const meetingPromises = meetingIds.map(id => this.getCachedMeeting(id));
            const meetings = await Promise.all(meetingPromises);

            return meetings.filter(meeting => meeting !== null);
        } catch (error) {
            console.error('Get user active meetings error:', error);
            return [];
        }
    }

    // Setup Redis subscriptions for meeting events
    setupSubscriptions() {
        const channels = [
            'meeting:updated',
            'meeting:started',
            'meeting:ended',
            'meeting:participant_joined',
            'meeting:participant_left',
            'meeting:participant_updated',
            'meeting:state_updated'
        ];

        channels.forEach(channel => {
            this.subscriber.subscribe(channel);
        });

        this.subscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                this.handleMeetingEvent(channel, data);
            } catch (error) {
                console.error('Meeting subscription error:', error);
            }
        });
    }

    // Handle meeting events (for cross-server synchronization)
    handleMeetingEvent(channel, data) {
        // This can be extended to handle cross-server meeting synchronization
        console.log(`Meeting event: ${channel}`, data);
    }

    // Cleanup expired meeting data
    async cleanupExpiredMeetings() {
        try {
            const activeMeetingsKey = this.getActiveMeetingsKey();
            const meetingIds = await cacheService.smembers(activeMeetingsKey);
            let cleanedCount = 0;

            for (const meetingId of meetingIds) {
                const meeting = await this.getCachedMeeting(meetingId);
                if (!meeting) {
                    await cacheService.srem(activeMeetingsKey, meetingId);
                    cleanedCount++;
                } else if (meeting.status === 'ENDED') {
                    await cacheService.srem(activeMeetingsKey, meetingId);
                    cleanedCount++;
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired meetings from active list`);
            return cleanedCount;
        } catch (error) {
            console.error('Cleanup expired meetings error:', error);
            return 0;
        }
    }

    // Get meeting cache statistics
    async getMeetingCacheStats() {
        try {
            const activeMeetings = await this.getActiveMeetings();
            const meetingPattern = 'meeting:*:participants';
            const participantKeys = await cacheService.keys(meetingPattern);

            let totalParticipants = 0;
            for (const key of participantKeys) {
                const participants = await cacheService.hgetall(key);
                totalParticipants += Object.keys(participants).length;
            }

            return {
                activeMeetings: activeMeetings.length,
                totalParticipants,
                cachedMeetingKeys: participantKeys.length,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Get meeting cache stats error:', error);
            return {
                activeMeetings: 0,
                totalParticipants: 0,
                cachedMeetingKeys: 0,
                timestamp: new Date()
            };
        }
    }

    // Remove meeting from cache
    async removeMeetingFromCache(meetingId) {
        try {
            const meetingKey = this.getMeetingKey(meetingId);
            const settingsKey = this.getMeetingSettingsKey(meetingId);
            const participantsKey = this.getMeetingParticipantsKey(meetingId);
            const stateKey = this.getMeetingStateKey(meetingId);
            const activeMeetingsKey = this.getActiveMeetingsKey();

            // Remove all meeting-related cache entries
            await Promise.all([
                cacheService.del(meetingKey),
                cacheService.del(settingsKey),
                cacheService.del(participantsKey),
                cacheService.del(stateKey),
                cacheService.srem(activeMeetingsKey, meetingId)
            ]);

            return true;
        } catch (error) {
            console.error('Remove meeting from cache error:', error);
            return false;
        }
    }
}

export default new MeetingCacheService();