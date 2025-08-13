import meetingCacheService from '../services/meetingCacheService.js';
import presenceService from '../services/presenceService.js';
import { requireMeetingAccess, socketRateLimit } from '../middleware/socketAuth.js';

class EnhancedSocketHandler {
    constructor(io) {
        this.io = io;
        this.rateLimiter = socketRateLimit(50, 60000); // 50 events per minute
    }

    handleConnection(socket) {
        console.log(`Enhanced socket connection: ${socket.userName} (${socket.id})`);

        // Apply rate limiting to all events
        socket.use((packet, next) => {
            this.rateLimiter(socket, next);
        });

        // Meeting room events
        this.setupMeetingEvents(socket);

        // WebRTC signaling events
        this.setupWebRTCEvents(socket);

        // Media control events
        this.setupMediaEvents(socket);

        // Chat events
        this.setupChatEvents(socket);

        // Host control events
        this.setupHostEvents(socket);

        // Presence events
        this.setupPresenceEvents(socket);

        // Handle disconnect
        socket.on('disconnect', () => {
            this.handleUserDisconnect(socket);
        });
    }

    setupMeetingEvents(socket) {
        // Join meeting room
        socket.on('join-meeting', async (data) => {
            try {
                const { meetingId, userName } = data;

                // Validate meeting access
                await new Promise((resolve, reject) => {
                    requireMeetingAccess(socket, meetingId, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });

                // Get or create meeting cache
                let meeting = await meetingCacheService.getCachedMeeting(meetingId);
                if (!meeting) {
                    // If meeting not in cache, this would typically fetch from database
                    // For now, we'll create a basic meeting structure
                    meeting = {
                        id: meetingId,
                        title: `Meeting ${meetingId}`,
                        hostId: socket.userId, // Assume first joiner is host for now
                        status: 'ACTIVE',
                        createdAt: new Date().toISOString(),
                        participantCount: 0
                    };
                    await meetingCacheService.cacheMeeting(meeting);
                }

                // Create participant data
                const participantData = {
                    userId: socket.userId,
                    userName: socket.userName || userName,
                    email: socket.userEmail,
                    role: meeting.hostId === socket.userId ? 'host' : 'participant',
                    joinedAt: new Date().toISOString(),
                    socketId: socket.id,
                    isAudioMuted: false,
                    isVideoMuted: false,
                    isScreenSharing: false,
                    lastActivity: new Date().toISOString()
                };

                // Add participant to meeting cache
                await meetingCacheService.addParticipant(meetingId, participantData);

                // Add to presence service
                await presenceService.addUserToMeeting(socket.userId, meetingId, participantData.role);

                // Join socket room
                socket.join(meetingId);
                socket.currentMeetingId = meetingId;

                // Get all participants
                const participants = await meetingCacheService.getMeetingParticipants(meetingId);
                const participantsList = Object.values(participants);

                // Notify user they joined successfully
                socket.emit('meeting-joined', {
                    meetingId,
                    meeting,
                    participant: participantData,
                    participants: participantsList
                });

                // Notify other participants
                socket.to(meetingId).emit('participant-joined', {
                    participant: participantData,
                    participants: participantsList
                });

                console.log(`User ${socket.userName} joined meeting ${meetingId}`);
            } catch (error) {
                console.error('Join meeting error:', error);
                socket.emit('meeting-error', {
                    message: error.message || 'Failed to join meeting',
                    code: 'JOIN_FAILED'
                });
            }
        });

        // Leave meeting room
        socket.on('leave-meeting', async (data) => {
            try {
                const meetingId = data?.meetingId || socket.currentMeetingId;
                if (!meetingId) return;

                await this.handleMeetingLeave(socket, meetingId);
            } catch (error) {
                console.error('Leave meeting error:', error);
            }
        });

        // Get meeting info
        socket.on('get-meeting-info', async (data) => {
            try {
                const { meetingId } = data;
                const meeting = await meetingCacheService.getCachedMeeting(meetingId);
                const participants = await meetingCacheService.getMeetingParticipants(meetingId);

                socket.emit('meeting-info', {
                    meeting,
                    participants: Object.values(participants)
                });
            } catch (error) {
                console.error('Get meeting info error:', error);
                socket.emit('meeting-error', {
                    message: 'Failed to get meeting info',
                    code: 'INFO_FAILED'
                });
            }
        });
    }

    setupWebRTCEvents(socket) {
        // WebRTC offer
        socket.on('webrtc-offer', async (data) => {
            try {
                const { targetUserId, offer, meetingId } = data;

                // Find target participant
                const participants = await meetingCacheService.getMeetingParticipants(meetingId || socket.currentMeetingId);
                const targetParticipant = participants[targetUserId];

                if (targetParticipant && targetParticipant.socketId) {
                    this.io.to(targetParticipant.socketId).emit('webrtc-offer', {
                        offer,
                        senderUserId: socket.userId,
                        senderName: socket.userName
                    });
                }
            } catch (error) {
                console.error('WebRTC offer error:', error);
            }
        });

        // WebRTC answer
        socket.on('webrtc-answer', async (data) => {
            try {
                const { targetUserId, answer, meetingId } = data;

                const participants = await meetingCacheService.getMeetingParticipants(meetingId || socket.currentMeetingId);
                const targetParticipant = participants[targetUserId];

                if (targetParticipant && targetParticipant.socketId) {
                    this.io.to(targetParticipant.socketId).emit('webrtc-answer', {
                        answer,
                        senderUserId: socket.userId,
                        senderName: socket.userName
                    });
                }
            } catch (error) {
                console.error('WebRTC answer error:', error);
            }
        });

        // ICE candidate
        socket.on('webrtc-ice-candidate', async (data) => {
            try {
                const { targetUserId, candidate, meetingId } = data;

                const participants = await meetingCacheService.getMeetingParticipants(meetingId || socket.currentMeetingId);
                const targetParticipant = participants[targetUserId];

                if (targetParticipant && targetParticipant.socketId) {
                    this.io.to(targetParticipant.socketId).emit('webrtc-ice-candidate', {
                        candidate,
                        senderUserId: socket.userId
                    });
                }
            } catch (error) {
                console.error('WebRTC ICE candidate error:', error);
            }
        });
    }

    setupMediaEvents(socket) {
        // Toggle audio
        socket.on('toggle-audio', async (data) => {
            try {
                const { isAudioMuted, meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                // Update participant state in cache
                await meetingCacheService.updateParticipantState(targetMeetingId, socket.userId, {
                    isAudioMuted,
                    lastActivity: new Date().toISOString()
                });

                // Update presence service
                await presenceService.updateParticipantMedia(socket.userId, targetMeetingId, {
                    isAudioMuted
                });

                // Notify other participants
                socket.to(targetMeetingId).emit('participant-audio-toggled', {
                    userId: socket.userId,
                    isAudioMuted
                });
            } catch (error) {
                console.error('Toggle audio error:', error);
            }
        });

        // Toggle video
        socket.on('toggle-video', async (data) => {
            try {
                const { isVideoMuted, meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                await meetingCacheService.updateParticipantState(targetMeetingId, socket.userId, {
                    isVideoMuted,
                    lastActivity: new Date().toISOString()
                });

                await presenceService.updateParticipantMedia(socket.userId, targetMeetingId, {
                    isVideoMuted
                });

                socket.to(targetMeetingId).emit('participant-video-toggled', {
                    userId: socket.userId,
                    isVideoMuted
                });
            } catch (error) {
                console.error('Toggle video error:', error);
            }
        });

        // Screen share events
        socket.on('start-screen-share', async (data) => {
            try {
                const { meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                await meetingCacheService.updateParticipantState(targetMeetingId, socket.userId, {
                    isScreenSharing: true,
                    lastActivity: new Date().toISOString()
                });

                await presenceService.updateParticipantMedia(socket.userId, targetMeetingId, {
                    isScreenSharing: true
                });

                socket.to(targetMeetingId).emit('participant-screen-share-started', {
                    userId: socket.userId,
                    userName: socket.userName
                });
            } catch (error) {
                console.error('Start screen share error:', error);
            }
        });

        socket.on('stop-screen-share', async (data) => {
            try {
                const { meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                await meetingCacheService.updateParticipantState(targetMeetingId, socket.userId, {
                    isScreenSharing: false,
                    lastActivity: new Date().toISOString()
                });

                await presenceService.updateParticipantMedia(socket.userId, targetMeetingId, {
                    isScreenSharing: false
                });

                socket.to(targetMeetingId).emit('participant-screen-share-stopped', {
                    userId: socket.userId,
                    userName: socket.userName
                });
            } catch (error) {
                console.error('Stop screen share error:', error);
            }
        });
    }

    setupChatEvents(socket) {
        // Send chat message
        socket.on('send-chat-message', async (data) => {
            try {
                const { message, meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId || !message?.trim()) return;

                const messageData = {
                    userId: socket.userId,
                    userName: socket.userName,
                    message: message.trim(),
                    timestamp: new Date().toISOString()
                };

                // Add message to meeting cache
                const savedMessage = await meetingCacheService.addChatMessage(targetMeetingId, messageData);

                // Broadcast to all participants in meeting
                this.io.to(targetMeetingId).emit('new-chat-message', savedMessage);
            } catch (error) {
                console.error('Send chat message error:', error);
            }
        });

        // Typing indicator
        socket.on('typing', async (data) => {
            try {
                const { isTyping, meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                socket.to(targetMeetingId).emit('participant-typing', {
                    userId: socket.userId,
                    userName: socket.userName,
                    isTyping
                });
            } catch (error) {
                console.error('Typing indicator error:', error);
            }
        });

        // Get chat history
        socket.on('get-chat-history', async (data) => {
            try {
                const { meetingId, limit = 50 } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                const messages = await meetingCacheService.getChatMessages(targetMeetingId, limit);
                socket.emit('chat-history', { messages });
            } catch (error) {
                console.error('Get chat history error:', error);
            }
        });
    }

    setupHostEvents(socket) {
        // End meeting (host only)
        socket.on('end-meeting', async (data) => {
            try {
                const { meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId) return;

                // Check if user is host
                const participants = await meetingCacheService.getMeetingParticipants(targetMeetingId);
                const userParticipant = participants[socket.userId];

                if (!userParticipant || userParticipant.role !== 'host') {
                    socket.emit('meeting-error', {
                        message: 'Only the host can end the meeting',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                    return;
                }

                // Update meeting status
                await meetingCacheService.updateMeetingStatus(targetMeetingId, 'ENDED', {
                    endedAt: new Date().toISOString(),
                    endedBy: socket.userId
                });

                // Notify all participants
                this.io.to(targetMeetingId).emit('meeting-ended', {
                    message: 'Meeting has been ended by the host',
                    endedBy: socket.userName
                });

                // Remove all participants from meeting
                for (const [userId, participant] of Object.entries(participants)) {
                    await meetingCacheService.removeParticipant(targetMeetingId, userId);
                    await presenceService.removeUserFromMeeting(userId, targetMeetingId);

                    // Disconnect participant sockets
                    if (participant.socketId) {
                        const participantSocket = this.io.sockets.sockets.get(participant.socketId);
                        if (participantSocket) {
                            participantSocket.leave(targetMeetingId);
                        }
                    }
                }

                console.log(`Meeting ${targetMeetingId} ended by host ${socket.userName}`);
            } catch (error) {
                console.error('End meeting error:', error);
                socket.emit('meeting-error', {
                    message: 'Failed to end meeting',
                    code: 'END_FAILED'
                });
            }
        });

        // Remove participant (host only)
        socket.on('remove-participant', async (data) => {
            try {
                const { userId, meetingId } = data;
                const targetMeetingId = meetingId || socket.currentMeetingId;

                if (!targetMeetingId || !userId) return;

                // Check if user is host
                const participants = await meetingCacheService.getMeetingParticipants(targetMeetingId);
                const hostParticipant = participants[socket.userId];
                const targetParticipant = participants[userId];

                if (!hostParticipant || hostParticipant.role !== 'host') {
                    socket.emit('meeting-error', {
                        message: 'Only the host can remove participants',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                    return;
                }

                if (!targetParticipant || targetParticipant.role === 'host') {
                    socket.emit('meeting-error', {
                        message: 'Cannot remove host or non-existent participant',
                        code: 'INVALID_TARGET'
                    });
                    return;
                }

                // Remove participant
                await meetingCacheService.removeParticipant(targetMeetingId, userId);
                await presenceService.removeUserFromMeeting(userId, targetMeetingId);

                // Notify the removed participant
                if (targetParticipant.socketId) {
                    const participantSocket = this.io.sockets.sockets.get(targetParticipant.socketId);
                    if (participantSocket) {
                        participantSocket.emit('removed-from-meeting', {
                            message: 'You have been removed from the meeting by the host',
                            removedBy: socket.userName
                        });
                        participantSocket.leave(targetMeetingId);
                    }
                }

                // Notify other participants
                const updatedParticipants = await meetingCacheService.getMeetingParticipants(targetMeetingId);
                socket.to(targetMeetingId).emit('participant-removed', {
                    userId,
                    removedBy: socket.userName,
                    participants: Object.values(updatedParticipants)
                });

                console.log(`Participant ${targetParticipant.userName} removed from meeting ${targetMeetingId} by host ${socket.userName}`);
            } catch (error) {
                console.error('Remove participant error:', error);
                socket.emit('meeting-error', {
                    message: 'Failed to remove participant',
                    code: 'REMOVE_FAILED'
                });
            }
        });
    }

    setupPresenceEvents(socket) {
        // Update activity
        socket.on('update-activity', async () => {
            try {
                await presenceService.updateUserActivity(socket.userId, socket.id);
            } catch (error) {
                console.error('Update activity error:', error);
            }
        });

        // Get online users
        socket.on('get-online-users', async () => {
            try {
                const onlineUsers = await presenceService.getOnlineUsers();
                socket.emit('online-users', { users: onlineUsers });
            } catch (error) {
                console.error('Get online users error:', error);
            }
        });
    }

    async handleMeetingLeave(socket, meetingId) {
        try {
            // Remove from meeting cache
            const removedParticipant = await meetingCacheService.removeParticipant(meetingId, socket.userId);

            // Remove from presence service
            await presenceService.removeUserFromMeeting(socket.userId, meetingId);

            // Leave socket room
            socket.leave(meetingId);

            if (socket.currentMeetingId === meetingId) {
                socket.currentMeetingId = null;
            }

            if (removedParticipant) {
                // Get updated participants list
                const participants = await meetingCacheService.getMeetingParticipants(meetingId);
                const participantsList = Object.values(participants);

                // Notify other participants
                socket.to(meetingId).emit('participant-left', {
                    participant: removedParticipant,
                    participants: participantsList
                });

                // If no participants left, mark meeting as ended
                if (participantsList.length === 0) {
                    await meetingCacheService.updateMeetingStatus(meetingId, 'ENDED', {
                        endedAt: new Date().toISOString(),
                        endReason: 'All participants left'
                    });
                }

                console.log(`User ${socket.userName} left meeting ${meetingId}`);
            }
        } catch (error) {
            console.error('Handle meeting leave error:', error);
        }
    }

    async handleUserDisconnect(socket) {
        console.log(`Enhanced socket disconnected: ${socket.userName} (${socket.id})`);

        try {
            // Handle meeting leave if user was in a meeting
            if (socket.currentMeetingId) {
                await this.handleMeetingLeave(socket, socket.currentMeetingId);
            }

            // Update presence service
            const presence = await presenceService.getUserPresence(socket.userId);
            if (presence && presence.socketIds) {
                presence.socketIds = presence.socketIds.filter(id => id !== socket.id);

                // If no more socket connections, set user offline
                if (presence.socketIds.length === 0) {
                    await presenceService.setUserOffline(socket.userId);
                }
            }
        } catch (error) {
            console.error('Handle user disconnect error:', error);
        }
    }
}

export default EnhancedSocketHandler;