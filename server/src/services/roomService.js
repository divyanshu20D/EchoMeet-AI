import { v4 as uuidv4 } from 'uuid';
// In-memory storage for rooms and participants (will be moved to Redis later)
const rooms = new Map();
const participants = new Map(); // socketId -> participant info

// Room cleanup interval (remove empty rooms after 1 hour)
const ROOM_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const EMPTY_ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Participant structure
class Participant {
    constructor(socketId, userId, name, roomId, isHost = false) {
        this.socketId = socketId;
        this.userId = userId;
        this.name = name;
        this.roomId = roomId;
        this.isHost = isHost;
        this.isAudioMuted = false;
        this.isVideoMuted = false;
        this.isScreenSharing = false;
        this.joinedAt = new Date();
    }
}

// Room structure
class Room {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.participants = new Map();
        this.createdAt = new Date();
        this.lastActivity = new Date();
        this.messages = [];
    }

    addParticipant(participant) {
        this.participants.set(participant.socketId, participant);
        this.lastActivity = new Date();
    }

    removeParticipant(socketId) {
        const participant = this.participants.get(socketId);
        this.participants.delete(socketId);
        this.lastActivity = new Date();

        // Transfer host if current host leaves and room isn't empty
        if (participant && participant.isHost && this.participants.size > 0) {
            const newHost = this.participants.values().next().value;
            newHost.isHost = true;
            this.hostId = newHost.userId;
            return newHost;
        }
        return null;
    }

    getParticipantsList() {
        return Array.from(this.participants.values()).map(p => ({
            userId: p.userId,
            name: p.name,
            isHost: p.isHost,
            isAudioMuted: p.isAudioMuted,
            isVideoMuted: p.isVideoMuted,
            isScreenSharing: p.isScreenSharing
        }));
    }

    isEmpty() {
        return this.participants.size === 0;
    }
}

class RoomService {
    constructor() {
        // Start cleanup interval
        this.startCleanupInterval();
    }

    createRoom(hostName, hostId) {
        const roomId = uuidv4();
        const room = new Room(roomId, hostId || uuidv4());
        rooms.set(roomId, room);

        return {
            roomId,
            hostId: room.hostId,
            message: 'Room created successfully'
        };
    }

    getRoomById(roomId) {
        const room = rooms.get(roomId);

        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }

        return {
            roomId: room.id,
            participantCount: room.participants.size,
            createdAt: room.createdAt,
            exists: true
        };
    }

    getRoomParticipants(roomId) {
        const room = rooms.get(roomId);

        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }

        return {
            participants: room.getParticipantsList(),
            participantCount: room.participants.size
        };
    }

    joinRoom(socketId, roomId, userId, userName) {
        const room = rooms.get(roomId);

        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }

        // Create participant
        const isHost = room.participants.size === 0 || userId === room.hostId;
        const participant = new Participant(socketId, userId, userName, roomId, isHost);

        // Add to room and global participants map
        room.addParticipant(participant);
        participants.set(socketId, participant);

        return {
            roomId,
            userId,
            isHost,
            participants: room.getParticipantsList()
        };
    }

    leaveRoom(socketId) {
        const participant = participants.get(socketId);
        if (!participant) {
            return null;
        }

        const room = rooms.get(participant.roomId);
        if (!room) {
            participants.delete(socketId);
            return null;
        }

        const newHost = room.removeParticipant(socketId);

        const result = {
            participant,
            newHost: newHost ? {
                userId: newHost.userId,
                userName: newHost.name
            } : null,
            participants: room.getParticipantsList()
        };

        // Remove empty room
        if (room.isEmpty()) {
            rooms.delete(participant.roomId);
            console.log(`Room ${participant.roomId} deleted (empty)`);
        }

        participants.delete(socketId);
        return result;
    }

    getParticipantBySocketId(socketId) {
        return participants.get(socketId);
    }

    updateParticipantAudio(socketId, isAudioMuted) {
        const participant = participants.get(socketId);
        if (participant) {
            participant.isAudioMuted = isAudioMuted;
            return {
                userId: participant.userId,
                roomId: participant.roomId,
                isAudioMuted
            };
        }
        return null;
    }

    updateParticipantVideo(socketId, isVideoMuted) {
        const participant = participants.get(socketId);
        if (participant) {
            participant.isVideoMuted = isVideoMuted;
            return {
                userId: participant.userId,
                roomId: participant.roomId,
                isVideoMuted
            };
        }
        return null;
    }

    updateParticipantScreenShare(socketId, isScreenSharing) {
        const participant = participants.get(socketId);
        if (participant) {
            participant.isScreenSharing = isScreenSharing;
            return {
                userId: participant.userId,
                userName: participant.name,
                roomId: participant.roomId,
                isScreenSharing
            };
        }
        return null;
    }

    addChatMessage(socketId, message) {
        const participant = participants.get(socketId);
        if (!participant) {
            return null;
        }

        const room = rooms.get(participant.roomId);
        if (!room) {
            return null;
        }

        const chatMessage = {
            id: uuidv4(),
            userId: participant.userId,
            userName: participant.name,
            message: message,
            timestamp: new Date(),
            isHost: participant.isHost
        };

        room.messages.push(chatMessage);

        return {
            message: chatMessage,
            roomId: participant.roomId
        };
    }

    endMeeting(socketId) {
        const participant = participants.get(socketId);
        if (!participant || !participant.isHost) {
            return null;
        }

        const room = rooms.get(participant.roomId);
        if (!room) {
            return null;
        }

        const participantsToDisconnect = Array.from(room.participants.values());

        // Remove room and all participants
        rooms.delete(participant.roomId);
        participantsToDisconnect.forEach(p => {
            participants.delete(p.socketId);
        });

        return {
            roomId: participant.roomId,
            participants: participantsToDisconnect
        };
    }

    removeParticipant(hostSocketId, userIdToRemove) {
        const host = participants.get(hostSocketId);
        if (!host || !host.isHost) {
            return null;
        }

        const room = rooms.get(host.roomId);
        if (!room) {
            return null;
        }

        // Find participant to remove
        const participantToRemove = Array.from(room.participants.values())
            .find(p => p.userId === userIdToRemove);

        if (!participantToRemove || participantToRemove.isHost) {
            return null;
        }

        // Remove from room and participants map
        room.removeParticipant(participantToRemove.socketId);
        participants.delete(participantToRemove.socketId);

        return {
            removedParticipant: participantToRemove,
            roomId: host.roomId,
            participants: room.getParticipantsList()
        };
    }

    findParticipantByUserId(userId) {
        return Array.from(participants.values()).find(p => p.userId === userId);
    }

    getStats() {
        return {
            activeRooms: rooms.size,
            activeParticipants: participants.size
        };
    }

    startCleanupInterval() {
        setInterval(() => {
            const now = new Date();
            const roomsToDelete = [];

            rooms.forEach((room, roomId) => {
                const timeSinceLastActivity = now - room.lastActivity;

                if (room.isEmpty() && timeSinceLastActivity > EMPTY_ROOM_TIMEOUT) {
                    roomsToDelete.push(roomId);
                }
            });

            roomsToDelete.forEach(roomId => {
                rooms.delete(roomId);
                console.log(`Cleaned up empty room: ${roomId}`);
            });
        }, ROOM_CLEANUP_INTERVAL);
    }
}

export default new RoomService();