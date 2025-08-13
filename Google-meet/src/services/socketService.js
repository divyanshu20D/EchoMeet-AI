import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.meetingId = null;
        this.userId = null;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // Connect to socket server
    connect(meetingId, userId) {
        const serverUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4000';
        const token = localStorage.getItem('accessToken');

        if (this.socket) {
            this.disconnect();
        }

        this.meetingId = meetingId;
        this.userId = userId;

        this.socket = io(serverUrl, {
            auth: {
                token,
                meetingId,
                userId
            },
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });

        this.setupEventListeners();
        return this.socket;
    }

    // Setup socket event listeners
    setupEventListeners() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected', this.socket.id);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.isConnected = false;
            this.emit('disconnected', reason);

            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect
                return;
            }

            this.handleReconnection();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.emit('connectionError', error);
            this.handleReconnection();
        });

        // Meeting events
        this.socket.on('meeting:joined', (data) => {
            console.log('Joined meeting:', data);
            this.emit('meetingJoined', data);
        });

        this.socket.on('meeting:left', (data) => {
            console.log('Left meeting:', data);
            this.emit('meetingLeft', data);
        });

        this.socket.on('meeting:ended', (data) => {
            console.log('Meeting ended:', data);
            this.emit('meetingEnded', data);
        });

        // Participant events
        this.socket.on('participant:joined', (data) => {
            console.log('Participant joined:', data);
            this.emit('participantJoined', data);
        });

        this.socket.on('participant:left', (data) => {
            console.log('Participant left:', data);
            this.emit('participantLeft', data);
        });

        this.socket.on('participant:updated', (data) => {
            console.log('Participant updated:', data);
            this.emit('participantUpdated', data);
        });

        this.socket.on('participants:list', (data) => {
            console.log('Participants list:', data);
            this.emit('participantsList', data);
        });

        // WebRTC signaling events
        this.socket.on('webrtc:offer', (data) => {
            console.log('Received WebRTC offer:', data);
            this.emit('webrtcOffer', data);
        });

        this.socket.on('webrtc:answer', (data) => {
            console.log('Received WebRTC answer:', data);
            this.emit('webrtcAnswer', data);
        });

        this.socket.on('webrtc:ice-candidate', (data) => {
            console.log('Received ICE candidate:', data);
            this.emit('webrtcIceCandidate', data);
        });

        // Chat events
        this.socket.on('chat:message', (data) => {
            console.log('Received chat message:', data);
            this.emit('chatMessage', data);
        });

        this.socket.on('chat:typing', (data) => {
            console.log('User typing:', data);
            this.emit('chatTyping', data);
        });

        this.socket.on('chat:stop-typing', (data) => {
            console.log('User stopped typing:', data);
            this.emit('chatStopTyping', data);
        });

        // Screen sharing events
        this.socket.on('screen:share-started', (data) => {
            console.log('Screen sharing started:', data);
            this.emit('screenShareStarted', data);
        });

        this.socket.on('screen:share-stopped', (data) => {
            console.log('Screen sharing stopped:', data);
            this.emit('screenShareStopped', data);
        });

        // Recording events
        this.socket.on('recording:started', (data) => {
            console.log('Recording started:', data);
            this.emit('recordingStarted', data);
        });

        this.socket.on('recording:stopped', (data) => {
            console.log('Recording stopped:', data);
            this.emit('recordingStopped', data);
        });

        // Error events
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.emit('error', error);
        });

        // Meeting control events
        this.socket.on('meeting:mute-all', (data) => {
            console.log('Mute all participants:', data);
            this.emit('meetingMuteAll', data);
        });

        this.socket.on('meeting:participant-muted', (data) => {
            console.log('Participant muted:', data);
            this.emit('participantMuted', data);
        });

        this.socket.on('meeting:participant-removed', (data) => {
            console.log('Participant removed:', data);
            this.emit('participantRemoved', data);
        });

        // Waiting room events
        this.socket.on('waiting-room:joined', (data) => {
            console.log('Joined waiting room:', data);
            this.emit('waitingRoomJoined', data);
        });

        this.socket.on('waiting-room:admitted', (data) => {
            console.log('Admitted from waiting room:', data);
            this.emit('waitingRoomAdmitted', data);
        });

        this.socket.on('waiting-room:denied', (data) => {
            console.log('Denied from waiting room:', data);
            this.emit('waitingRoomDenied', data);
        });
    }

    // Handle reconnection
    handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('reconnectionFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

        setTimeout(() => {
            if (!this.isConnected && this.meetingId && this.userId) {
                this.connect(this.meetingId, this.userId);
            }
        }, delay);
    }

    // Join meeting
    joinMeeting(meetingData) {
        if (this.socket && this.isConnected) {
            this.socket.emit('meeting:join', meetingData);
        }
    }

    // Leave meeting
    leaveMeeting() {
        if (this.socket && this.isConnected) {
            this.socket.emit('meeting:leave', {
                meetingId: this.meetingId,
                userId: this.userId
            });
        }
    }

    // Send WebRTC offer
    sendOffer(targetUserId, offer) {
        if (this.socket && this.isConnected) {
            this.socket.emit('webrtc:offer', {
                targetUserId,
                offer,
                meetingId: this.meetingId
            });
        }
    }

    // Send WebRTC answer
    sendAnswer(targetUserId, answer) {
        if (this.socket && this.isConnected) {
            this.socket.emit('webrtc:answer', {
                targetUserId,
                answer,
                meetingId: this.meetingId
            });
        }
    }

    // Send ICE candidate
    sendIceCandidate(targetUserId, candidate) {
        if (this.socket && this.isConnected) {
            this.socket.emit('webrtc:ice-candidate', {
                targetUserId,
                candidate,
                meetingId: this.meetingId
            });
        }
    }

    // Send chat message
    sendChatMessage(message) {
        if (this.socket && this.isConnected) {
            this.socket.emit('chat:message', {
                meetingId: this.meetingId,
                message,
                timestamp: Date.now()
            });
        }
    }

    // Send typing indicator
    sendTyping() {
        if (this.socket && this.isConnected) {
            this.socket.emit('chat:typing', {
                meetingId: this.meetingId,
                userId: this.userId
            });
        }
    }

    // Stop typing indicator
    stopTyping() {
        if (this.socket && this.isConnected) {
            this.socket.emit('chat:stop-typing', {
                meetingId: this.meetingId,
                userId: this.userId
            });
        }
    }

    // Update participant status
    updateParticipantStatus(status) {
        if (this.socket && this.isConnected) {
            this.socket.emit('participant:update', {
                meetingId: this.meetingId,
                userId: this.userId,
                status
            });
        }
    }

    // Start screen sharing
    startScreenShare() {
        if (this.socket && this.isConnected) {
            this.socket.emit('screen:share-start', {
                meetingId: this.meetingId,
                userId: this.userId
            });
        }
    }

    // Stop screen sharing
    stopScreenShare() {
        if (this.socket && this.isConnected) {
            this.socket.emit('screen:share-stop', {
                meetingId: this.meetingId,
                userId: this.userId
            });
        }
    }

    // Start recording
    startRecording() {
        if (this.socket && this.isConnected) {
            this.socket.emit('recording:start', {
                meetingId: this.meetingId
            });
        }
    }

    // Stop recording
    stopRecording() {
        if (this.socket && this.isConnected) {
            this.socket.emit('recording:stop', {
                meetingId: this.meetingId
            });
        }
    }

    // Mute all participants
    muteAllParticipants() {
        if (this.socket && this.isConnected) {
            this.socket.emit('meeting:mute-all', {
                meetingId: this.meetingId
            });
        }
    }

    // Mute specific participant
    muteParticipant(participantId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('meeting:mute-participant', {
                meetingId: this.meetingId,
                participantId
            });
        }
    }

    // Remove participant
    removeParticipant(participantId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('meeting:remove-participant', {
                meetingId: this.meetingId,
                participantId
            });
        }
    }

    // Admit from waiting room
    admitFromWaitingRoom(participantId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('waiting-room:admit', {
                meetingId: this.meetingId,
                participantId
            });
        }
    }

    // Deny from waiting room
    denyFromWaitingRoom(participantId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('waiting-room:deny', {
                meetingId: this.meetingId,
                participantId
            });
        }
    }

    // Get connection status
    isSocketConnected() {
        return this.socket && this.isConnected;
    }

    // Get socket ID
    getSocketId() {
        return this.socket ? this.socket.id : null;
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.meetingId = null;
        this.userId = null;
        this.reconnectAttempts = 0;
    }

    // Cleanup
    cleanup() {
        this.disconnect();
        this.eventHandlers.clear();
    }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;