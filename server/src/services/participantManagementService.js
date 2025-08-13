import { getPrismaClient } from '../utils/database.js';
import { getRedisClient, getRedisPublisher } from '../utils/redis.js';
import meetingCacheService from './meetingCacheService.js';
import presenceService from './presenceService.js';
import cacheService from './cacheService.js';

class ParticipantManagementService {
    constructor() {
        this.redis = getRedisClient();
        this.publisher = getRedisPublisher();

        // Role hierarchy (higher number = more permissions)
        this.roleHierarchy = {
            'participant': 1,
            'moderator': 2,
            'host': 3
        };

        // Default permissions by role
        this.defaultPermissions = {
            'participant': ['join_meeting', 'send_message', 'share_audio', 'share_video'],
            'moderator': ['join_meeting', 'send_message', 'share_audio', 'share_video', 'mute_participants', 'manage_chat'],
            'host': ['join_meeting', 'send_message', 'share_audio', 'share_video', 'mute_participants', 'manage_chat', 'manage_participants', 'end_meeting', 'record_meeting', 'remove_participants']
        };

        // Cache TTL configurations
        this.participantTTL = 4 * 60 * 60; // 4 hours
        this.invitationTTL = 24 * 60 * 60; // 24 hours
        this.waitingRoomTTL = 30 * 60; // 30 minutes
    }

    // Generate cache keys
    getParticipantKey(meetingId, userId) {
        return `participant:${meetingId}:${userId}`;
    }

    getMeetingParticipantsKey(meetingId) {
        return `meeting_participants:${meetingId}`;
    }

    getInvitationKey(meetingId, email) {
        return `invitation:${meetingId}:${email}`;
    }

    getWaitingRoomKey(meetingId) {
        return `waiting_room:${meetingId}`;
    }

    getJoinRequestKey(meetingId, userId) {
        return `join_request:${meetingId}:${userId}`;
    }

    getParticipantActivityKey(meetingId, userId) {
        return `participant_activity:${meetingId}:${userId}`;
    }

    // Add participant to meeting
    async addParticipant(meetingId, participantData) {
        try {
            const prisma = getPrismaClient();

            // Validate meeting exists
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting) {
                throw new Error('Meeting not found');
            }

            // Check if participant already exists
            const existingParticipant = await this.getParticipantDetails(meetingId, participantData.userId);
            if (existingParticipant) {
                throw new Error('Participant already in meeting');
            }

            // Check meeting capacity
            const currentParticipants = await this.getMeetingParticipants(meetingId);
            const maxParticipants = meeting.settings?.maxParticipants || 100;

            if (currentParticipants.length >= maxParticipants) {
                throw new Error('Meeting is at capacity');
            }

            // Create participant data
            const participant = {
                userId: participantData.userId,
                userName: participantData.userName || 'Unknown User',
                email: participantData.email,
                role: participantData.role || 'participant',
                permissions: participantData.permissions || this.defaultPermissions[participantData.role || 'participant'],
                joinedAt: new Date().toISOString(),
                socketId: participantData.socketId,
                isActive: true,
                mediaState: {
                    isAudioMuted: false,
                    isVideoMuted: false,
                    isScreenSharing: false,
                    canShareAudio: true,
                    canShareVideo: true,
                    canShareScreen: participantData.role !== 'participant' || meeting.settings?.allowParticipantScreenShare
                },
                connectionState: {
                    status: 'connected',
                    quality: 'unknown',
                    lastActivity: new Date().toISOString()
                },
                metadata: participantData.metadata || {}
            };

            // Store in database
            await prisma.participant.create({
                data: {
                    meetingId,
                    userId: participant.userId,
                    role: participant.role,
                    joinedAt: new Date(participant.joinedAt),
                    isActive: true,
                    permissions: participant.permissions,
                    metadata: participant.metadata
                }
            });

            // Cache participant data
            const participantKey = this.getParticipantKey(meetingId, participant.userId);
            await cacheService.set(participantKey, participant, this.participantTTL);

            // Add to meeting participants set
            const meetingParticipantsKey = this.getMeetingParticipantsKey(meetingId);
            await cacheService.sadd(meetingParticipantsKey, participant.userId);
            await cacheService.expire(meetingParticipantsKey, this.participantTTL);

            // Update meeting cache
            await meetingCacheService.addParticipantToMeeting(meetingId, participant);

            // Update presence service
            await presenceService.addUserToMeeting(participant.userId, meetingId, participant.role);

            // Publish participant joined event
            await this.publisher.publish('participant:joined', JSON.stringify({
                meetingId,
                participant,
                timestamp: new Date().toISOString()
            }));

            console.log(`Participant ${participant.userName} added to meeting ${meetingId}`);
            return participant;

        } catch (error) {
            console.error('Add participant error:', error);
            throw error;
        }
    }

    // Remove participant from meeting
    async removeParticipant(meetingId, userId, removedBy, reason = null) {
        try {
            const prisma = getPrismaClient();

            // Validate permissions
            if (removedBy !== userId) { // Self-removal is always allowed
                const canRemove = await this.canPerformAction(meetingId, removedBy, 'remove_participant', userId);
                if (!canRemove) {
                    throw new Error('Insufficient permissions to remove participant');
                }
            }

            // Get participant data before removal
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (!participant) {
                throw new Error('Participant not found');
            }

            // Update database
            await prisma.participant.updateMany({
                where: {
                    meetingId,
                    userId,
                    isActive: true
                },
                data: {
                    isActive: false,
                    leftAt: new Date(),
                    removedBy,
                    removalReason: reason
                }
            });

            // Remove from cache
            const participantKey = this.getParticipantKey(meetingId, userId);
            await cacheService.del(participantKey);

            // Remove from meeting participants set
            const meetingParticipantsKey = this.getMeetingParticipantsKey(meetingId);
            await cacheService.srem(meetingParticipantsKey, userId);

            // Update meeting cache
            await meetingCacheService.removeParticipantFromMeeting(meetingId, userId);

            // Update presence service
            await presenceService.removeUserFromMeeting(userId, meetingId);

            // Clean up activity tracking
            const activityKey = this.getParticipantActivityKey(meetingId, userId);
            await cacheService.del(activityKey);

            // Publish participant removed event
            await this.publisher.publish('participant:removed', JSON.stringify({
                meetingId,
                participant,
                removedBy,
                reason,
                timestamp: new Date().toISOString()
            }));

            console.log(`Participant ${participant.userName} removed from meeting ${meetingId}`);
            return true;

        } catch (error) {
            console.error('Remove participant error:', error);
            throw error;
        }
    }

    // Send meeting invitations
    async sendInvitations(meetingId, invitations) {
        try {
            const prisma = getPrismaClient();
            const sentInvitations = [];

            for (const invitation of invitations) {
                const invitationData = {
                    meetingId,
                    email: invitation.email,
                    name: invitation.name,
                    role: invitation.role || 'participant',
                    invitedBy: invitation.invitedBy,
                    invitedAt: new Date().toISOString(),
                    status: 'sent',
                    expiresAt: new Date(Date.now() + this.invitationTTL * 1000).toISOString()
                };

                // Store in database
                await prisma.meetingInvitation.create({
                    data: {
                        meetingId,
                        email: invitation.email,
                        name: invitation.name,
                        role: invitation.role || 'participant',
                        invitedBy: invitation.invitedBy,
                        status: 'sent',
                        expiresAt: new Date(invitationData.expiresAt)
                    }
                });

                // Cache invitation
                const invitationKey = this.getInvitationKey(meetingId, invitation.email);
                await cacheService.set(invitationKey, invitationData, this.invitationTTL);

                sentInvitations.push(invitationData);
            }

            // Publish invitations sent event
            await this.publisher.publish('invitations:sent', JSON.stringify({
                meetingId,
                invitations: sentInvitations,
                timestamp: new Date().toISOString()
            }));

            return sentInvitations;

        } catch (error) {
            console.error('Send invitations error:', error);
            throw error;
        }
    }

    // Request to join meeting (with approval workflow)
    async requestToJoin(meetingId, participantData) {
        try {
            const meeting = await meetingCacheService.getMeeting(meetingId);
            if (!meeting) {
                throw new Error('Meeting not found');
            }

            // Check if approval is required
            if (!meeting.settings?.requireApproval) {
                return await this.joinMeeting(meetingId, participantData);
            }

            // Create join request
            const joinRequest = {
                meetingId,
                userId: participantData.userId,
                userName: participantData.userName,
                email: participantData.email,
                requestedAt: new Date().toISOString(),
                status: 'pending',
                socketId: participantData.socketId
            };

            // Cache join request
            const joinRequestKey = this.getJoinRequestKey(meetingId, participantData.userId);
            await cacheService.set(joinRequestKey, joinRequest, 30 * 60); // 30 minutes

            // Notify meeting host/moderators
            await this.publisher.publish('join_request:created', JSON.stringify({
                meetingId,
                joinRequest,
                timestamp: new Date().toISOString()
            }));

            return joinRequest;

        } catch (error) {
            console.error('Request to join error:', error);
            throw error;
        }
    }

    // Approve join request
    async approveJoinRequest(meetingId, userId, approvedBy) {
        try {
            // Validate approver permissions
            const canApprove = await this.hasPermission(meetingId, approvedBy, 'manage_participants');
            if (!canApprove) {
                throw new Error('Insufficient permissions to approve join request');
            }

            // Get join request
            const joinRequestKey = this.getJoinRequestKey(meetingId, userId);
            const joinRequest = await cacheService.get(joinRequestKey);

            if (!joinRequest || joinRequest.status !== 'pending') {
                throw new Error('Join request not found or already processed');
            }

            // Update join request status
            joinRequest.status = 'approved';
            joinRequest.approvedBy = approvedBy;
            joinRequest.approvedAt = new Date().toISOString();

            await cacheService.set(joinRequestKey, joinRequest, 5 * 60); // Keep for 5 minutes

            // Add participant to meeting
            const participantData = {
                userId: joinRequest.userId,
                userName: joinRequest.userName,
                email: joinRequest.email,
                socketId: joinRequest.socketId,
                role: 'participant'
            };

            const participant = await this.addParticipant(meetingId, participantData);

            // Publish approval event
            await this.publisher.publish('join_request:approved', JSON.stringify({
                meetingId,
                userId,
                approvedBy,
                participant,
                timestamp: new Date().toISOString()
            }));

            return participant;

        } catch (error) {
            console.error('Approve join request error:', error);
            throw error;
        }
    }

    // Reject join request
    async rejectJoinRequest(meetingId, userId, rejectedBy, reason = null) {
        try {
            // Validate rejector permissions
            const canReject = await this.hasPermission(meetingId, rejectedBy, 'manage_participants');
            if (!canReject) {
                throw new Error('Insufficient permissions to reject join request');
            }

            // Get and update join request
            const joinRequestKey = this.getJoinRequestKey(meetingId, userId);
            const joinRequest = await cacheService.get(joinRequestKey);

            if (!joinRequest || joinRequest.status !== 'pending') {
                throw new Error('Join request not found or already processed');
            }

            joinRequest.status = 'rejected';
            joinRequest.rejectedBy = rejectedBy;
            joinRequest.rejectedAt = new Date().toISOString();
            joinRequest.rejectionReason = reason;

            await cacheService.set(joinRequestKey, joinRequest, 5 * 60);

            // Publish rejection event
            await this.publisher.publish('join_request:rejected', JSON.stringify({
                meetingId,
                userId,
                rejectedBy,
                reason,
                timestamp: new Date().toISOString()
            }));

            return true;

        } catch (error) {
            console.error('Reject join request error:', error);
            throw error;
        }
    }

    // Direct join meeting (without approval)
    async joinMeeting(meetingId, participantData) {
        try {
            return await this.addParticipant(meetingId, participantData);
        } catch (error) {
            console.error('Join meeting error:', error);
            throw error;
        }
    }

    // Add participant to waiting room
    async addToWaitingRoom(meetingId, participantData) {
        try {
            const waitingRoomData = {
                userId: participantData.userId,
                userName: participantData.userName,
                email: participantData.email,
                socketId: participantData.socketId,
                addedAt: new Date().toISOString(),
                status: 'waiting'
            };

            const waitingRoomKey = this.getWaitingRoomKey(meetingId);
            await cacheService.hset(waitingRoomKey, participantData.userId, waitingRoomData, this.waitingRoomTTL);

            // Notify host/moderators
            await this.publisher.publish('waiting_room:user_added', JSON.stringify({
                meetingId,
                participant: waitingRoomData,
                timestamp: new Date().toISOString()
            }));

            return waitingRoomData;

        } catch (error) {
            console.error('Add to waiting room error:', error);
            throw error;
        }
    }

    // Admit participant from waiting room
    async admitFromWaitingRoom(meetingId, userId, admittedBy) {
        try {
            // Validate permissions
            const canAdmit = await this.hasPermission(meetingId, admittedBy, 'manage_participants');
            if (!canAdmit) {
                throw new Error('Insufficient permissions to admit from waiting room');
            }

            // Get waiting room data
            const waitingRoomKey = this.getWaitingRoomKey(meetingId);
            const waitingData = await cacheService.hget(waitingRoomKey, userId);

            if (!waitingData) {
                throw new Error('User not found in waiting room');
            }

            // Remove from waiting room
            await cacheService.hdel(waitingRoomKey, userId);

            // Add to meeting
            const participantData = {
                userId: waitingData.userId,
                userName: waitingData.userName,
                email: waitingData.email,
                socketId: waitingData.socketId,
                role: 'participant'
            };

            const participant = await this.addParticipant(meetingId, participantData);

            // Publish admission event
            await this.publisher.publish('waiting_room:user_admitted', JSON.stringify({
                meetingId,
                userId,
                admittedBy,
                participant,
                timestamp: new Date().toISOString()
            }));

            return participant;

        } catch (error) {
            console.error('Admit from waiting room error:', error);
            throw error;
        }
    }

    // Update participant role
    async updateParticipantRole(meetingId, userId, newRole, updatedBy) {
        try {
            // Validate permissions
            const canUpdate = await this.canPerformAction(meetingId, updatedBy, 'update_role', userId);
            if (!canUpdate) {
                throw new Error('Insufficient permissions to update participant role');
            }

            // Get current participant
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (!participant) {
                throw new Error('Participant not found');
            }

            const oldRole = participant.role;

            // Update role and permissions
            participant.role = newRole;
            participant.permissions = this.defaultPermissions[newRole] || [];
            participant.updatedAt = new Date().toISOString();

            // Update in cache
            const participantKey = this.getParticipantKey(meetingId, userId);
            await cacheService.set(participantKey, participant, this.participantTTL);

            // Update in database
            const prisma = getPrismaClient();
            await prisma.participant.updateMany({
                where: { meetingId, userId, isActive: true },
                data: {
                    role: newRole,
                    permissions: participant.permissions
                }
            });

            // Update meeting cache
            await meetingCacheService.updateParticipantState(meetingId, userId, {
                role: newRole,
                permissions: participant.permissions
            });

            // Publish role update event
            await this.publisher.publish('participant:role_updated', JSON.stringify({
                meetingId,
                userId,
                oldRole,
                newRole,
                updatedBy,
                timestamp: new Date().toISOString()
            }));

            return participant;

        } catch (error) {
            console.error('Update participant role error:', error);
            throw error;
        }
    }

    // Update participant permissions
    async updateParticipantPermissions(meetingId, userId, permissions, updatedBy) {
        try {
            // Validate permissions
            const canUpdate = await this.canPerformAction(meetingId, updatedBy, 'update_permissions', userId);
            if (!canUpdate) {
                throw new Error('Insufficient permissions to update participant permissions');
            }

            // Get and update participant
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (!participant) {
                throw new Error('Participant not found');
            }

            const oldPermissions = [...participant.permissions];
            participant.permissions = permissions;
            participant.updatedAt = new Date().toISOString();

            // Update in cache
            const participantKey = this.getParticipantKey(meetingId, userId);
            await cacheService.set(participantKey, participant, this.participantTTL);

            // Update in database
            const prisma = getPrismaClient();
            await prisma.participant.updateMany({
                where: { meetingId, userId, isActive: true },
                data: { permissions }
            });

            // Publish permissions update event
            await this.publisher.publish('participant:permissions_updated', JSON.stringify({
                meetingId,
                userId,
                oldPermissions,
                newPermissions: permissions,
                updatedBy,
                timestamp: new Date().toISOString()
            }));

            return participant;

        } catch (error) {
            console.error('Update participant permissions error:', error);
            throw error;
        }
    }

    // Mute participant
    async muteParticipant(meetingId, userId, mutedBy, mediaType = 'audio') {
        try {
            // Validate permissions
            const canMute = await this.hasPermission(meetingId, mutedBy, 'mute_participants');
            if (!canMute && mutedBy !== userId) {
                throw new Error('Insufficient permissions to mute participant');
            }

            // Update participant media state
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (!participant) {
                throw new Error('Participant not found');
            }

            const mediaStateUpdate = {};
            if (mediaType === 'audio') {
                mediaStateUpdate.isAudioMuted = true;
                mediaStateUpdate.canShareAudio = false;
            } else if (mediaType === 'video') {
                mediaStateUpdate.isVideoMuted = true;
                mediaStateUpdate.canShareVideo = false;
            }

            Object.assign(participant.mediaState, mediaStateUpdate);
            participant.updatedAt = new Date().toISOString();

            // Update in cache
            const participantKey = this.getParticipantKey(meetingId, userId);
            await cacheService.set(participantKey, participant, this.participantTTL);

            // Update meeting cache
            await meetingCacheService.updateParticipantState(meetingId, userId, {
                mediaState: participant.mediaState
            });

            // Publish mute event
            await this.publisher.publish('participant:muted', JSON.stringify({
                meetingId,
                userId,
                mediaType,
                mutedBy,
                timestamp: new Date().toISOString()
            }));

            return true;

        } catch (error) {
            console.error('Mute participant error:', error);
            throw error;
        }
    }

    // Disable participant video
    async disableParticipantVideo(meetingId, userId, disabledBy) {
        try {
            return await this.muteParticipant(meetingId, userId, disabledBy, 'video');
        } catch (error) {
            console.error('Disable participant video error:', error);
            throw error;
        }
    }

    // Mute all participants
    async muteAllParticipants(meetingId, mutedBy) {
        try {
            // Validate permissions
            const canMuteAll = await this.hasPermission(meetingId, mutedBy, 'mute_participants');
            if (!canMuteAll) {
                throw new Error('Insufficient permissions to mute all participants');
            }

            const participants = await this.getMeetingParticipants(meetingId);
            const mutePromises = [];

            for (const participant of participants) {
                if (participant.userId !== mutedBy && participant.role !== 'host') {
                    mutePromises.push(this.muteParticipant(meetingId, participant.userId, mutedBy, 'audio'));
                }
            }

            await Promise.all(mutePromises);

            // Publish mute all event
            await this.publisher.publish('participants:muted_all', JSON.stringify({
                meetingId,
                mutedBy,
                timestamp: new Date().toISOString()
            }));

            return true;

        } catch (error) {
            console.error('Mute all participants error:', error);
            throw error;
        }
    }

    // Disable all participant videos
    async disableAllParticipantVideos(meetingId, disabledBy) {
        try {
            // Validate permissions
            const canDisableAll = await this.hasPermission(meetingId, disabledBy, 'mute_participants');
            if (!canDisableAll) {
                throw new Error('Insufficient permissions to disable all participant videos');
            }

            const participants = await this.getMeetingParticipants(meetingId);
            const disablePromises = [];

            for (const participant of participants) {
                if (participant.userId !== disabledBy && participant.role !== 'host') {
                    disablePromises.push(this.disableParticipantVideo(meetingId, participant.userId, disabledBy));
                }
            }

            await Promise.all(disablePromises);

            // Publish disable all event
            await this.publisher.publish('participants:videos_disabled_all', JSON.stringify({
                meetingId,
                disabledBy,
                timestamp: new Date().toISOString()
            }));

            return true;

        } catch (error) {
            console.error('Disable all participant videos error:', error);
            throw error;
        }
    }

    // Get meeting participants
    async getMeetingParticipants(meetingId) {
        try {
            const meetingParticipantsKey = this.getMeetingParticipantsKey(meetingId);
            const userIds = await cacheService.smembers(meetingParticipantsKey);

            const participants = [];
            for (const userId of userIds) {
                const participant = await this.getParticipantDetails(meetingId, userId);
                if (participant && participant.isActive) {
                    participants.push(participant);
                }
            }

            return participants;

        } catch (error) {
            console.error('Get meeting participants error:', error);
            return [];
        }
    }

    // Get participant details
    async getParticipantDetails(meetingId, userId) {
        try {
            const participantKey = this.getParticipantKey(meetingId, userId);
            let participant = await cacheService.get(participantKey);

            if (!participant) {
                // Fallback to database
                const prisma = getPrismaClient();
                const dbParticipant = await prisma.participant.findFirst({
                    where: {
                        meetingId,
                        userId,
                        isActive: true
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                });

                if (dbParticipant) {
                    participant = {
                        userId: dbParticipant.userId,
                        userName: dbParticipant.user.name,
                        email: dbParticipant.user.email,
                        role: dbParticipant.role,
                        permissions: dbParticipant.permissions,
                        joinedAt: dbParticipant.joinedAt.toISOString(),
                        isActive: dbParticipant.isActive,
                        mediaState: {
                            isAudioMuted: false,
                            isVideoMuted: false,
                            isScreenSharing: false,
                            canShareAudio: true,
                            canShareVideo: true,
                            canShareScreen: true
                        },
                        connectionState: {
                            status: 'unknown',
                            quality: 'unknown',
                            lastActivity: new Date().toISOString()
                        },
                        metadata: dbParticipant.metadata || {}
                    };

                    // Cache for future requests
                    await cacheService.set(participantKey, participant, this.participantTTL);
                }
            }

            return participant;

        } catch (error) {
            console.error('Get participant details error:', error);
            return null;
        }
    }

    // Check if participant has permission
    async hasPermission(meetingId, userId, permission) {
        try {
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (!participant) {
                return false;
            }

            return participant.permissions.includes(permission);

        } catch (error) {
            console.error('Has permission error:', error);
            return false;
        }
    }

    // Check if participant can perform action on another participant
    async canPerformAction(meetingId, actorId, action, targetId = null) {
        try {
            const actor = await this.getParticipantDetails(meetingId, actorId);
            if (!actor) {
                return false;
            }

            // Check basic permission
            const hasBasicPermission = await this.hasPermission(meetingId, actorId, action);
            if (!hasBasicPermission) {
                return false;
            }

            // If no target, just check basic permission
            if (!targetId) {
                return true;
            }

            const target = await this.getParticipantDetails(meetingId, targetId);
            if (!target) {
                return false;
            }

            // Role hierarchy check - can't perform actions on higher or equal roles
            const actorLevel = this.roleHierarchy[actor.role] || 0;
            const targetLevel = this.roleHierarchy[target.role] || 0;

            return actorLevel > targetLevel;

        } catch (error) {
            console.error('Can perform action error:', error);
            return false;
        }
    }

    // Update participant activity
    async updateParticipantActivity(meetingId, userId, activityType, metadata = {}) {
        try {
            const activityData = {
                type: activityType,
                timestamp: new Date().toISOString(),
                metadata
            };

            const activityKey = this.getParticipantActivityKey(meetingId, userId);
            await cacheService.lpush(activityKey, activityData);
            await cacheService.expire(activityKey, 24 * 60 * 60); // 24 hours

            // Keep only last 100 activities
            const activities = await cacheService.lrange(activityKey, 0, 99);
            if (activities.length > 100) {
                await cacheService.del(activityKey);
                for (const activity of activities.slice(0, 100)) {
                    await cacheService.lpush(activityKey, activity);
                }
                await cacheService.expire(activityKey, 24 * 60 * 60);
            }

            // Update participant's last activity
            const participant = await this.getParticipantDetails(meetingId, userId);
            if (participant) {
                participant.connectionState.lastActivity = new Date().toISOString();
                const participantKey = this.getParticipantKey(meetingId, userId);
                await cacheService.set(participantKey, participant, this.participantTTL);
            }

            return true;

        } catch (error) {
            console.error('Update participant activity error:', error);
            return false;
        }
    }

    // Get participant activity log
    async getParticipantActivity(meetingId, userId, limit = 50) {
        try {
            const activityKey = this.getParticipantActivityKey(meetingId, userId);
            return await cacheService.lrange(activityKey, 0, limit - 1);

        } catch (error) {
            console.error('Get participant activity error:', error);
            return [];
        }
    }

    // Get meeting statistics
    async getMeetingStatistics(meetingId) {
        try {
            const participants = await this.getMeetingParticipants(meetingId);

            const stats = {
                totalParticipants: participants.length,
                activeParticipants: participants.filter(p => p.isActive).length,
                participantsByRole: {},
                roleDistribution: {},
                mediaStats: {
                    audioMuted: 0,
                    videoMuted: 0,
                    screenSharing: 0
                },
                connectionStats: {
                    connected: 0,
                    poor: 0,
                    fair: 0,
                    good: 0,
                    excellent: 0
                }
            };

            for (const participant of participants) {
                // Count by role
                const role = participant.role || 'participant';
                stats.participantsByRole[role] = (stats.participantsByRole[role] || 0) + 1;
                stats.roleDistribution[role] = (stats.roleDistribution[role] || 0) + 1;

                // Media stats
                if (participant.mediaState?.isAudioMuted) stats.mediaStats.audioMuted++;
                if (participant.mediaState?.isVideoMuted) stats.mediaStats.videoMuted++;
                if (participant.mediaState?.isScreenSharing) stats.mediaStats.screenSharing++;

                // Connection stats
                const quality = participant.connectionState?.quality || 'unknown';
                if (stats.connectionStats[quality] !== undefined) {
                    stats.connectionStats[quality]++;
                }
            }

            return stats;

        } catch (error) {
            console.error('Get meeting statistics error:', error);
            return {
                totalParticipants: 0,
                activeParticipants: 0,
                participantsByRole: {},
                roleDistribution: {},
                mediaStats: { audioMuted: 0, videoMuted: 0, screenSharing: 0 },
                connectionStats: { connected: 0, poor: 0, fair: 0, good: 0, excellent: 0 }
            };
        }
    }

    // Remove all participants (for meeting cleanup)
    async removeAllParticipants(meetingId) {
        try {
            const participants = await this.getMeetingParticipants(meetingId);
            const removePromises = [];

            for (const participant of participants) {
                removePromises.push(this.removeParticipant(meetingId, participant.userId, 'system', 'Meeting ended'));
            }

            await Promise.all(removePromises);

            // Clean up meeting participants set
            const meetingParticipantsKey = this.getMeetingParticipantsKey(meetingId);
            await cacheService.del(meetingParticipantsKey);

            return true;

        } catch (error) {
            console.error('Remove all participants error:', error);
            return false;
        }
    }

    // Create meeting with host
    async createMeetingWithHost(meetingData) {
        try {
            // Cache the meeting first
            await meetingCacheService.cacheMeeting(meetingData);

            // Add host as participant
            const hostParticipant = await this.addParticipant(meetingData.id, {
                userId: meetingData.hostId,
                userName: 'Host User',
                email: 'host@test.com',
                role: 'host',
                socketId: `socket_${meetingData.hostId}`
            });

            return { meeting: meetingData, host: hostParticipant };

        } catch (error) {
            console.error('Create meeting with host error:', error);
            throw error;
        }
    }

    // Send meeting invitations
    async sendMeetingInvitations(meetingId, hostUserId, invitations) {
        try {
            const sentInvitations = [];

            for (const invitation of invitations) {
                const invitationData = {
                    meetingId,
                    email: invitation.email,
                    name: invitation.name,
                    role: invitation.role || 'participant',
                    invitedBy: hostUserId,
                    status: 'sent',
                    sentAt: new Date().toISOString()
                };

                // Cache invitation
                const invitationKey = this.getInvitationKey(meetingId, invitation.email);
                await cacheService.set(invitationKey, invitationData, this.invitationTTL);

                sentInvitations.push(invitationData);
            }

            return sentInvitations;

        } catch (error) {
            console.error('Send meeting invitations error:', error);
            throw error;
        }
    }

    // Request to join meeting
    async requestToJoinMeeting(meetingId, userId, userData) {
        try {
            const joinRequest = {
                meetingId,
                userId,
                name: userData.name,
                email: userData.email,
                status: 'pending',
                requestedAt: new Date().toISOString()
            };

            // Cache join request
            const joinRequestKey = this.getJoinRequestKey(meetingId, userId);
            await cacheService.set(joinRequestKey, joinRequest, 30 * 60); // 30 minutes

            return joinRequest;

        } catch (error) {
            console.error('Request to join meeting error:', error);
            throw error;
        }
    }

    // Approve participant
    async approveParticipant(meetingId, hostUserId, participantUserId) {
        try {
            // Get join request
            const joinRequestKey = this.getJoinRequestKey(meetingId, participantUserId);
            const joinRequest = await cacheService.get(joinRequestKey);

            if (!joinRequest) {
                throw new Error('Join request not found');
            }

            // Add participant to meeting
            const participant = await this.addParticipant(meetingId, {
                userId: participantUserId,
                userName: joinRequest.name,
                email: joinRequest.email,
                role: 'participant',
                socketId: `socket_${participantUserId}`
            });

            // Remove join request
            await cacheService.del(joinRequestKey);

            return participant;

        } catch (error) {
            console.error('Approve participant error:', error);
            throw error;
        }
    }

    // Add participant to meeting (alias for addParticipant)
    async addParticipantToMeeting(meetingId, userId, userData) {
        try {
            return await this.addParticipant(meetingId, {
                userId,
                userName: userData.name,
                email: userData.email,
                role: userData.role || 'participant',
                socketId: `socket_${userId}`
            });

        } catch (error) {
            console.error('Add participant to meeting error:', error);
            throw error;
        }
    }

    // Change participant role
    async changeParticipantRole(meetingId, hostUserId, participantUserId, newRole) {
        try {
            return await this.updateParticipantRole(meetingId, participantUserId, newRole.toLowerCase(), hostUserId);

        } catch (error) {
            console.error('Change participant role error:', error);
            throw error;
        }
    }

    // Get waiting room participants
    async getWaitingRoomParticipants(meetingId) {
        try {
            const waitingRoomKey = this.getWaitingRoomKey(meetingId);
            const waitingParticipants = await cacheService.hgetall(waitingRoomKey);

            return Object.values(waitingParticipants);

        } catch (error) {
            console.error('Get waiting room participants error:', error);
            return [];
        }
    }

    // Add multiple participants
    async addMultipleParticipants(meetingId, hostUserId, users) {
        try {
            const addedParticipants = [];

            for (const user of users) {
                try {
                    const participant = await this.addParticipant(meetingId, {
                        userId: user.userId,
                        userName: user.name,
                        email: user.email,
                        role: 'participant',
                        socketId: `socket_${user.userId}`
                    });
                    addedParticipants.push(participant);
                } catch (error) {
                    console.error(`Failed to add participant ${user.userId}:`, error);
                }
            }

            return addedParticipants;

        } catch (error) {
            console.error('Add multiple participants error:', error);
            throw error;
        }
    }

    // Check meeting capacity
    async checkMeetingCapacity(meetingId) {
        try {
            const meeting = await meetingCacheService.getCachedMeeting(meetingId);
            const participants = await this.getMeetingParticipants(meetingId);

            const maxParticipants = meeting?.settings?.maxParticipants || 100;
            const currentParticipants = participants.length;
            const availableSlots = maxParticipants - currentParticipants;

            return {
                currentParticipants,
                maxParticipants,
                availableSlots,
                isAtCapacity: availableSlots <= 0
            };

        } catch (error) {
            console.error('Check meeting capacity error:', error);
            return {
                currentParticipants: 0,
                maxParticipants: 100,
                availableSlots: 100,
                isAtCapacity: false
            };
        }
    }

    // Get overall statistics
    async getOverallStatistics() {
        try {
            const participantPattern = 'participant:*';
            const participantKeys = await cacheService.keys(participantPattern);

            const meetingParticipantsPattern = 'meeting_participants:*';
            const meetingKeys = await cacheService.keys(meetingParticipantsPattern);

            const waitingRoomPattern = 'waiting_room:*';
            const waitingRoomKeys = await cacheService.keys(waitingRoomPattern);

            return {
                totalCachedParticipants: participantKeys.length,
                activeMeetingsWithParticipants: meetingKeys.length,
                waitingRoomsActive: waitingRoomKeys.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Get overall statistics error:', error);
            return {
                totalCachedParticipants: 0,
                activeMeetingsWithParticipants: 0,
                waitingRoomsActive: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get service statistics (alias for getOverallStatistics)
    async getServiceStatistics() {
        return await this.getOverallStatistics();
    }
}

export default new ParticipantManagementService();