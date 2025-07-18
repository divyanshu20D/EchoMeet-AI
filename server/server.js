const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // React frontend URL
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for rooms and participants
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

// REST API Endpoints

// Create a new room
app.post('/api/rooms', (req, res) => {
    const roomId = uuidv4();
    const { hostName, hostId } = req.body;

    const room = new Room(roomId, hostId || uuidv4());
    rooms.set(roomId, room);

    res.json({
        roomId,
        hostId: room.hostId,
        message: 'Room created successfully'
    });
});

// Check if room exists
app.get('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
        roomId: room.id,
        participantCount: room.participants.size,
        createdAt: room.createdAt,
        exists: true
    });
});

// Get room participants
app.get('/api/rooms/:roomId/participants', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
        participants: room.getParticipantsList(),
        participantCount: room.participants.size
    });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', (data) => {
        const { roomId, userId, userName } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Create participant
        const isHost = room.participants.size === 0 || userId === room.hostId;
        const participant = new Participant(socket.id, userId, userName, roomId, isHost);

        // Add to room and global participants map
        room.addParticipant(participant);
        participants.set(socket.id, participant);

        // Join socket room
        socket.join(roomId);

        // Notify user they joined successfully
        socket.emit('joined-room', {
            roomId,
            userId,
            isHost,
            participants: room.getParticipantsList()
        });

        // Notify other participants
        socket.to(roomId).emit('user-joined', {
            userId,
            userName,
            isHost,
            participants: room.getParticipantsList()
        });

        console.log(`User ${userName} joined room ${roomId}`);
    });

    // WebRTC Signaling Events
    socket.on('offer', (data) => {
        // Find target participant by userId and get their socketId
        const targetParticipant = Array.from(participants.values())
            .find(p => p.userId === data.target);

        if (targetParticipant) {
            socket.to(targetParticipant.socketId).emit('offer', {
                offer: data.offer,
                sender: socket.id,
                senderUserId: participants.get(socket.id)?.userId
            });
        }
    });

    socket.on('answer', (data) => {
        // Find target participant by userId and get their socketId
        const targetParticipant = Array.from(participants.values())
            .find(p => p.userId === data.target);

        if (targetParticipant) {
            socket.to(targetParticipant.socketId).emit('answer', {
                answer: data.answer,
                sender: socket.id,
                senderUserId: participants.get(socket.id)?.userId
            });
        }
    });

    socket.on('ice-candidate', (data) => {
        // Find target participant by userId and get their socketId
        const targetParticipant = Array.from(participants.values())
            .find(p => p.userId === data.target);

        if (targetParticipant) {
            socket.to(targetParticipant.socketId).emit('ice-candidate', {
                candidate: data.candidate,
                sender: socket.id,
                senderUserId: participants.get(socket.id)?.userId
            });
        }
    });

    // Media control events
    socket.on('toggle-audio', (data) => {
        const participant = participants.get(socket.id);
        if (participant) {
            participant.isAudioMuted = data.isAudioMuted;
            socket.to(participant.roomId).emit('user-audio-toggled', {
                userId: participant.userId,
                isAudioMuted: data.isAudioMuted
            });
        }
    });

    socket.on('toggle-video', (data) => {
        const participant = participants.get(socket.id);
        if (participant) {
            participant.isVideoMuted = data.isVideoMuted;
            socket.to(participant.roomId).emit('user-video-toggled', {
                userId: participant.userId,
                isVideoMuted: data.isVideoMuted
            });
        }
    });

    // Screen sharing events
    socket.on('start-screen-share', () => {
        const participant = participants.get(socket.id);
        if (participant) {
            participant.isScreenSharing = true;
            socket.to(participant.roomId).emit('user-started-screen-share', {
                userId: participant.userId,
                userName: participant.name
            });
        }
    });

    socket.on('stop-screen-share', () => {
        const participant = participants.get(socket.id);
        if (participant) {
            participant.isScreenSharing = false;
            socket.to(participant.roomId).emit('user-stopped-screen-share', {
                userId: participant.userId,
                userName: participant.name
            });
        }
    });

    // Chat events
    socket.on('send-message', (data) => {
        const participant = participants.get(socket.id);
        if (participant) {
            const room = rooms.get(participant.roomId);
            if (room) {
                const message = {
                    id: uuidv4(),
                    userId: participant.userId,
                    userName: participant.name,
                    message: data.message,
                    timestamp: new Date(),
                    isHost: participant.isHost
                };

                room.messages.push(message);

                // Broadcast message to all participants in room
                io.to(participant.roomId).emit('new-message', message);
            }
        }
    });

    socket.on('typing', (data) => {
        const participant = participants.get(socket.id);
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
        const participant = participants.get(socket.id);
        if (participant && participant.isHost) {
            const room = rooms.get(participant.roomId);
            if (room) {
                // Notify all participants that meeting is ending
                io.to(participant.roomId).emit('meeting-ended', {
                    message: 'Meeting has been ended by the host'
                });

                // Disconnect all participants
                room.participants.forEach((p) => {
                    const participantSocket = io.sockets.sockets.get(p.socketId);
                    if (participantSocket) {
                        participantSocket.leave(participant.roomId);
                        participantSocket.disconnect();
                    }
                    participants.delete(p.socketId);
                });

                // Remove room
                rooms.delete(participant.roomId);
                console.log(`Meeting ${participant.roomId} ended by host`);
            }
        }
    });

    socket.on('remove-participant', (data) => {
        const host = participants.get(socket.id);
        if (host && host.isHost) {
            const room = rooms.get(host.roomId);
            if (room) {
                // Find participant to remove
                const participantToRemove = Array.from(room.participants.values())
                    .find(p => p.userId === data.userId);

                if (participantToRemove && !participantToRemove.isHost) {
                    // Notify the participant they're being removed
                    const participantSocket = io.sockets.sockets.get(participantToRemove.socketId);
                    if (participantSocket) {
                        participantSocket.emit('removed-from-meeting', {
                            message: 'You have been removed from the meeting by the host'
                        });
                        participantSocket.leave(host.roomId);
                        participantSocket.disconnect();
                    }

                    // Remove from room and participants map
                    room.removeParticipant(participantToRemove.socketId);
                    participants.delete(participantToRemove.socketId);

                    // Notify other participants
                    socket.to(host.roomId).emit('participant-removed', {
                        userId: data.userId,
                        participants: room.getParticipantsList()
                    });

                    console.log(`Participant ${participantToRemove.name} removed from room ${host.roomId}`);
                }
            }
        }
    });

    // Leave room
    socket.on('leave-room', () => {
        handleUserLeaving(socket.id);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleUserLeaving(socket.id);
    });
});

// Helper function to handle user leaving
function handleUserLeaving(socketId) {
    const participant = participants.get(socketId);
    if (participant) {
        const room = rooms.get(participant.roomId);
        if (room) {
            const newHost = room.removeParticipant(socketId);

            // Notify other participants
            io.to(participant.roomId).emit('user-left', {
                userId: participant.userId,
                userName: participant.name,
                participants: room.getParticipantsList(),
                newHost: newHost ? {
                    userId: newHost.userId,
                    userName: newHost.name
                } : null
            });

            // Remove empty room
            if (room.isEmpty()) {
                rooms.delete(participant.roomId);
                console.log(`Room ${participant.roomId} deleted (empty)`);
            }
        }

        participants.delete(socketId);
    }
}

// Room cleanup job
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        activeRooms: rooms.size,
        activeParticipants: participants.size
    });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for http://localhost:3000`);
});