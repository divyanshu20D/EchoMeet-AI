const roomService = require('../services/roomService');

const sessionCacheService = require('../services/sessionCacheService');
const meetingCacheService = require('../services/meetingCacheService');
const { getRedisPublisher, getRedisSubscriber } = require('../utils/redis');

class SocketHandler {
    constructor(io) {
        this.io = io;
        this.publisher = getRedisPublisher();
        this.subscriber = getRedisSubscriber();
        this.setupRedisSubscriptions();
    }

    // Setup Redis pub/sub for cross-server communication
    setupRedisSubscriptions() {
        const channels = [
            'socket:user_joined',
            'socket:user_left',
            'socket:message_broadcast',
            'socket:meeting_update'
        ];

        channels.forEach(channel => {
            this.subscriber.subscribe(channel);
        });

        this.subscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                this.handleRedisMessage(channel, data);
            } catch (error) {
                console.error('Redis message handling error:', error);
            }
        });
    }

    // Handle Redis pub/sub messages for cross-server synchronization
    handleRedisMessage(channel, data) {
        switch (channel) {
            case 'socket:user_joined':
                this.io.to(data.roomId).emit('user-joined', data.payload);
                break;
            case 'socket:user_left':
                this.io.to(data.roomId).emit('user-left', data.payload);
                break;
            case 'socket:message_broadcast':
                this.io.to(data.roomId).emit(data.event, data.payload);
                break;
            case 'socket:meeting_update':
                this.io.to(data.roomId).emit('meeting-updated', data.payload);
                break;
        }
    }

    handleConnection(socket) {
        console.log(`User connected: ${socket.id}`);

        // Join room
        socket.on('join-room', async (data) => {
            try {
                const { roomId, userId, userName } = data;

                // Use meeting cache service for participant management
                const meeting = await meetingCacheService.getMeeting(roomId);
                if (!meeting) {
                    socket.emit('error', { message: 'Meeting not found' });
                    return;
                }

                // Add participant to meeting cache
                const participantData = {
                    userId,
                    userName,
                    socketId: socket.id,
                    joinedAt: new Date().toISOString(),
                    isAudioMuted: false,
                    isVideoMuted: false,
                    isScreenSharing: false
                };

                await meetingCacheService.addParticipantToMeeting(roomId, participantData);

                // Get updated participants list
                const participants = await meetingCacheService.getCachedMeetingParticipants(roomId);
                const isHost = meeting.hostId === userId;

                const result = {
                    roomId,
                    isHost,
                    participants: participants.map(p => ({
                        userId: p.userId,
                        userName: p.userName,
                        isHost: meeting.hostId === p.userId,
                        isAudioMuted: p.isAudioMuted,
                        isVideoMuted: p.isVideoMuted,
                        isScreenSharing: p.isScreenSharing
                    }))
                };

                // Join socket room
                socket.join(roomId);

                // Store socket-room mapping in Redis
                await sessionCacheService.setSession(`socket:${socket.id}`, {
                    roomId,
                    userId,
                    userName,
                    joinedAt: new Date().toISOString()
                });

                // Notify user they joined successfully
                socket.emit('joined-room', result);

                // Publish to Redis for cross-server synchronization
                await this.publisher.publish('socket:user_joined', JSON.stringify({
                    roomId,
                    payload: {
                        userId,
                        userName,
                        isHost,
                        participants: result.participants
                    }
                }));

                // Also emit locally
                socket.to(roomId).emit('user-joined', {
                    userId,
                    userName,
                    isHost,
                    participants: result.participants
                });

                console.log(`User ${userName} joined room ${roomId}`);
            } catch (error) {
                console.error('Join room error:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // WebRTC Signaling Events
        socket.on('offer', (data) => {
            const targetParticipant = roomService.findParticipantByUserId(data.target);
            const senderParticipant = roomService.getParticipantBySocketId(socket.id);

            if (targetParticipant) {
                socket.to(targetParticipant.socketId).emit('offer', {
                    offer: data.offer,
                    sender: socket.id,
                    senderUserId: senderParticipant?.userId
                });
            }
        });

        socket.on('answer', (data) => {
            const targetParticipant = roomService.findParticipantByUserId(data.target);
            const senderParticipant = roomService.getParticipantBySocketId(socket.id);

            if (targetParticipant) {
                socket.to(targetParticipant.socketId).emit('answer', {
                    answer: data.answer,
                    sender: socket.id,
                    senderUserId: senderParticipant?.userId
                });
            }
        });

        socket.on('ice-candidate', (data) => {
            const targetParticipant = roomService.findParticipantByUserId(data.target);
            const senderParticipant = roomService.getParticipantBySocketId(socket.id);

            if (targetParticipant) {
                socket.to(targetParticipant.socketId).emit('ice-candidate', {
                    candidate: data.candidate,
                    sender: socket.id,
                    senderUserId: senderParticipant?.userId
                });
            }
        });

        // Media control events
        socket.on('toggle-audio', (data) => {
            const result = roomService.updateParticipantAudio(socket.id, data.isAudioMuted);
            if (result) {
                socket.to(result.roomId).emit('user-audio-toggled', {
                    userId: result.userId,
                    isAudioMuted: result.isAudioMuted
                });
            }
        });

        socket.on('toggle-video', (data) => {
            const result = roomService.updateParticipantVideo(socket.id, data.isVideoMuted);
            if (result) {
                socket.to(result.roomId).emit('user-video-toggled', {
                    userId: result.userId,
                    isVideoMuted: result.isVideoMuted
                });
            }
        });

        // Screen sharing events
        socket.on('start-screen-share', () => {
            const result = roomService.updateParticipantScreenShare(socket.id, true);
            if (result) {
                socket.to(result.roomId).emit('user-started-screen-share', {
                    userId: result.userId,
                    userName: result.userName
                });
            }
        });

        socket.on('stop-screen-share', () => {
            const result = roomService.updateParticipantScreenShare(socket.id, false);
            if (result) {
                socket.to(result.roomId).emit('user-stopped-screen-share', {
                    userId: result.userId,
                    userName: result.userName
                });
            }
        });

        // Chat events
        socket.on('send-message', (data) => {
            const result = roomService.addChatMessage(socket.id, data.message);
            if (result) {
                // Broadcast message to all participants in room
                this.io.to(result.roomId).emit('new-message', result.message);
            }
        });

        socket.on('typing', (data) => {
            const participant = roomService.getParticipantBySocketId(socket.id);
            if (participant) {
                socket.to(participant.roomId).emit('user-typing', {
                    userId: participant.userId,
                    userName: participant.name,
                    isTyping: data.isTyping
                });
            }
        });

        // Host control events
        socket.on('end-meeting', () => {
            const result = roomService.endMeeting(socket.id);
            if (result) {
                // Notify all participants that meeting is ending
                this.io.to(result.roomId).emit('meeting-ended', {
                    message: 'Meeting has been ended by the host'
                });

                // Disconnect all participants
                result.participants.forEach((p) => {
                    const participantSocket = this.io.sockets.sockets.get(p.socketId);
                    if (participantSocket) {
                        participantSocket.leave(result.roomId);
                        participantSocket.disconnect();
                    }
                });

                console.log(`Meeting ${result.roomId} ended by host`);
            }
        });

        socket.on('remove-participant', (data) => {
            const result = roomService.removeParticipant(socket.id, data.userId);
            if (result) {
                // Notify the participant they're being removed
                const participantSocket = this.io.sockets.sockets.get(result.removedParticipant.socketId);
                if (participantSocket) {
                    participantSocket.emit('removed-from-meeting', {
                        message: 'You have been removed from the meeting by the host'
                    });
                    participantSocket.leave(result.roomId);
                    participantSocket.disconnect();
                }

                // Notify other participants
                socket.to(result.roomId).emit('participant-removed', {
                    userId: data.userId,
                    participants: result.participants
                });

                console.log(`Participant ${result.removedParticipant.name} removed from room ${result.roomId}`);
            }
        });

        // Leave room
        socket.on('leave-room', () => {
            this.handleUserLeaving(socket.id);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            this.handleUserLeaving(socket.id);
        });
    }

    handleUserLeaving(socketId) {
        const result = roomService.leaveRoom(socketId);
        if (result) {
            // Notify other participants
            this.io.to(result.participant.roomId).emit('user-left', {
                userId: result.participant.userId,
                userName: result.participant.name,
                participants: result.participants,
                newHost: result.newHost
            });
        }
    }
}

module.exports = SocketHandler;