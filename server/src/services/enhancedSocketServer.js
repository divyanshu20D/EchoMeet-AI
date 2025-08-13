import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient, getRedisSubscriber } from '../utils/redis.js';
import { socketAuthMiddleware } from '../middleware/socketAuth.js';
import EnhancedSocketHandler from '../handlers/enhancedSocketHandler.js';
import webrtcConnectionManager from './webrtcConnectionManager.js';
import presenceService from './presenceService.js';

class EnhancedSocketServer {
    constructor(httpServer) {
        this.httpServer = httpServer;
        this.io = null;
        this.socketHandler = null;

        // Connection tracking
        this.connectedSockets = new Map();
        this.roomParticipants = new Map();

        // Performance metrics
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            totalMessages: 0,
            messagesPerSecond: 0,
            lastMessageTime: Date.now(),
            messageBuffer: []
        };

        this.initialize();
    }

    initialize() {
        try {
            // Create Socket.IO server with optimized configuration
            this.io = new Server(this.httpServer, {
                cors: {
                    origin: process.env.WEBSOCKET_CORS_ORIGIN || "*",
                    methods: ["GET", "POST"],
                    credentials: true,
                },
                // Performance optimizations
                pingTimeout: 60000,
                pingInterval: 25000,
                upgradeTimeout: 10000,
                maxHttpBufferSize: 1e6, // 1MB
                allowEIO3: true,
                transports: ['websocket', 'polling'],
                // Compression
                compression: true,
                // Connection state recovery
                connectionStateRecovery: {
                    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
                    skipMiddlewares: true,
                }
            });

            // Setup Redis adapter for clustering
            this.setupRedisAdapter();

            // Setup authentication middleware
            this.setupAuthentication();

            // Setup connection handling
            this.setupConnectionHandling();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            console.log('🚀 Enhanced Socket.IO server initialized');

        } catch (error) {
            console.error('Socket server initialization error:', error);
            throw error;
        }
    }

    setupRedisAdapter() {
        try {
            const pubClient = getRedisClient();
            const subClient = getRedisSubscriber();

            // Create Redis adapter with optimized settings
            const adapter = createAdapter(pubClient, subClient, {
                key: 'socket.io',
                requestsTimeout: 5000,
            });

            // Check if adapter was created successfully
            if (adapter && typeof adapter.on === 'function') {
                this.io.adapter(adapter);

                // Handle adapter events
                adapter.on('error', (error) => {
                    console.error('Redis adapter error:', error);
                });

                console.log('✅ Redis adapter configured for Socket.IO clustering');
            } else {
                console.warn('⚠️ Redis adapter creation failed, continuing without clustering');
            }

        } catch (error) {
            console.error('Redis adapter setup error:', error);
            // Continue without clustering if Redis fails
        }
    }

    setupAuthentication() {
        // Apply authentication middleware
        this.io.use(socketAuthMiddleware);

        // Optional: Add rate limiting middleware
        this.io.use((socket, next) => {
            const clientIp = socket.handshake.address;
            const userId = socket.userId;

            // Basic rate limiting (can be enhanced)
            if (!this.checkRateLimit(clientIp, userId)) {
                return next(new Error('Rate limit exceeded'));
            }

            next();
        });
    }

    setupConnectionHandling() {
        this.socketHandler = new EnhancedSocketHandler(this.io);

        this.io.on('connection', (socket) => {
            this.handleNewConnection(socket);
        });

        this.io.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
    }

    async handleNewConnection(socket) {
        try {
            console.log(`🔌 New socket connection: ${socket.user?.name || 'Unknown'} (${socket.id})`);

            // Update metrics
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;

            // Store socket reference
            this.connectedSockets.set(socket.id, {
                socket,
                userId: socket.userId,
                userName: socket.user?.name,
                connectedAt: new Date(),
                lastActivity: new Date(),
                roomId: null
            });

            // Set up socket event handlers
            this.setupSocketEvents(socket);

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                this.handleDisconnection(socket, reason);
            });

            // Send welcome message with server info
            socket.emit('server-info', {
                serverId: process.env.SERVER_ID || 'default',
                timestamp: new Date().toISOString(),
                features: {
                    webrtc: true,
                    clustering: true,
                    presence: true,
                    recording: false // Will be true when recording is implemented
                }
            });

        } catch (error) {
            console.error('Handle new connection error:', error);
            socket.disconnect(true);
        }
    }

    setupSocketEvents(socket) {
        // Enhanced WebRTC events with connection management
        socket.on('webrtc-offer', async (data) => {
            await webrtcConnectionManager.handleOffer(socket, data);
            this.updateSocketActivity(socket.id);
        });

        socket.on('webrtc-answer', async (data) => {
            await webrtcConnectionManager.handleAnswer(socket, data);
            this.updateSocketActivity(socket.id);
        });

        socket.on('webrtc-ice-candidate', async (data) => {
            await webrtcConnectionManager.handleIceCandidate(socket, data);
            this.updateSocketActivity(socket.id);
        });

        socket.on('webrtc-connection-state', async (data) => {
            await webrtcConnectionManager.handleConnectionStateChange(socket, data);
            this.updateSocketActivity(socket.id);
        });

        // Meeting room events
        socket.on('join-meeting', async (data) => {
            await this.handleJoinMeeting(socket, data);
        });

        socket.on('leave-meeting', async (data) => {
            await this.handleLeaveMeeting(socket, data);
        });

        // Media control events with enhanced tracking
        socket.on('toggle-audio', async (data) => {
            await this.handleMediaToggle(socket, 'audio', data);
        });

        socket.on('toggle-video', async (data) => {
            await this.handleMediaToggle(socket, 'video', data);
        });

        socket.on('start-screen-share', async (data) => {
            await this.handleScreenShare(socket, true, data);
        });

        socket.on('stop-screen-share', async (data) => {
            await this.handleScreenShare(socket, false, data);
        });

        // Chat events
        socket.on('send-chat-message', async (data) => {
            await this.handleChatMessage(socket, data);
        });

        // Presence events
        socket.on('update-presence', async (data) => {
            await this.handlePresenceUpdate(socket, data);
        });

        // Performance monitoring events
        socket.on('client-metrics', (data) => {
            this.handleClientMetrics(socket, data);
        });

        // Delegate to enhanced socket handler
        this.socketHandler.handleConnection(socket);
    }

    async handleJoinMeeting(socket, data) {
        try {
            const { meetingId } = data;

            // Initialize WebRTC connection management
            await webrtcConnectionManager.initializeConnection(socket, meetingId);

            // Update socket info
            const socketInfo = this.connectedSockets.get(socket.id);
            if (socketInfo) {
                socketInfo.roomId = meetingId;
                socketInfo.lastActivity = new Date();
            }

            // Track room participants
            if (!this.roomParticipants.has(meetingId)) {
                this.roomParticipants.set(meetingId, new Set());
            }
            this.roomParticipants.get(meetingId).add(socket.id);

            console.log(`Socket ${socket.user?.name} joined meeting ${meetingId}`);

        } catch (error) {
            console.error('Handle join meeting error:', error);
            socket.emit('meeting-error', {
                error: 'Failed to join meeting',
                code: 'JOIN_FAILED'
            });
        }
    }

    async handleLeaveMeeting(socket, data) {
        try {
            const { meetingId } = data;

            // Clean up WebRTC connections
            await webrtcConnectionManager.cleanupConnection(socket, meetingId);

            // Update socket info
            const socketInfo = this.connectedSockets.get(socket.id);
            if (socketInfo) {
                socketInfo.roomId = null;
                socketInfo.lastActivity = new Date();
            }

            // Remove from room participants
            if (this.roomParticipants.has(meetingId)) {
                this.roomParticipants.get(meetingId).delete(socket.id);

                // Clean up empty room
                if (this.roomParticipants.get(meetingId).size === 0) {
                    this.roomParticipants.delete(meetingId);
                }
            }

            console.log(`Socket ${socket.user?.name} left meeting ${meetingId}`);

        } catch (error) {
            console.error('Handle leave meeting error:', error);
        }
    }

    async handleMediaToggle(socket, mediaType, data) {
        try {
            const { meetingId, isMuted } = data;

            // Update socket activity
            this.updateSocketActivity(socket.id);

            // Broadcast to room with enhanced data
            socket.to(meetingId).emit(`participant-${mediaType}-toggled`, {
                userId: socket.userId,
                userName: socket.user?.name,
                [`is${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}Muted`]: isMuted,
                timestamp: new Date().toISOString()
            });

            // Update metrics
            this.metrics.totalMessages++;

        } catch (error) {
            console.error(`Handle ${mediaType} toggle error:`, error);
        }
    }

    async handleScreenShare(socket, isSharing, data) {
        try {
            const { meetingId } = data;

            this.updateSocketActivity(socket.id);

            const eventName = isSharing ? 'participant-screen-share-started' : 'participant-screen-share-stopped';

            socket.to(meetingId).emit(eventName, {
                userId: socket.userId,
                userName: socket.user?.name,
                isScreenSharing: isSharing,
                timestamp: new Date().toISOString()
            });

            this.metrics.totalMessages++;

        } catch (error) {
            console.error('Handle screen share error:', error);
        }
    }

    async handleChatMessage(socket, data) {
        try {
            const { meetingId, message } = data;

            if (!message || !message.trim()) return;

            this.updateSocketActivity(socket.id);

            const messageData = {
                userId: socket.userId,
                userName: socket.user?.name,
                message: message.trim(),
                timestamp: new Date().toISOString(),
                messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            // Broadcast to room
            this.io.to(meetingId).emit('new-chat-message', messageData);

            this.metrics.totalMessages++;

        } catch (error) {
            console.error('Handle chat message error:', error);
        }
    }

    async handlePresenceUpdate(socket, data) {
        try {
            await presenceService.updateUserActivity(socket.userId, socket.id);
            this.updateSocketActivity(socket.id);

        } catch (error) {
            console.error('Handle presence update error:', error);
        }
    }

    handleClientMetrics(socket, data) {
        try {
            // Store client-side performance metrics
            const socketInfo = this.connectedSockets.get(socket.id);
            if (socketInfo) {
                socketInfo.clientMetrics = {
                    ...data,
                    receivedAt: new Date().toISOString()
                };
            }

        } catch (error) {
            console.error('Handle client metrics error:', error);
        }
    }

    async handleDisconnection(socket, reason) {
        try {
            console.log(`🔌 Socket disconnected: ${socket.user?.name || 'Unknown'} (${socket.id}) - Reason: ${reason}`);

            // Update metrics
            this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);

            // Get socket info
            const socketInfo = this.connectedSockets.get(socket.id);

            if (socketInfo && socketInfo.roomId) {
                // Clean up meeting participation
                await this.handleLeaveMeeting(socket, { meetingId: socketInfo.roomId });
            }

            // Clean up WebRTC connections
            if (socketInfo && socketInfo.roomId) {
                await webrtcConnectionManager.cleanupConnection(socket, socketInfo.roomId);
            }

            // Update presence service
            if (socket.userId) {
                await presenceService.updateUserActivity(socket.userId);
            }

            // Remove from tracking
            this.connectedSockets.delete(socket.id);

            // Clean up room participants
            for (const [roomId, participants] of this.roomParticipants) {
                participants.delete(socket.id);
                if (participants.size === 0) {
                    this.roomParticipants.delete(roomId);
                }
            }

        } catch (error) {
            console.error('Handle disconnection error:', error);
        }
    }

    updateSocketActivity(socketId) {
        const socketInfo = this.connectedSockets.get(socketId);
        if (socketInfo) {
            socketInfo.lastActivity = new Date();
        }
    }

    checkRateLimit(clientIp, userId) {
        // Basic rate limiting implementation
        // In production, use a more sophisticated rate limiter like express-rate-limit
        return true; // Placeholder
    }

    setupPerformanceMonitoring() {
        // Update messages per second metric
        setInterval(() => {
            const now = Date.now();
            const timeDiff = (now - this.metrics.lastMessageTime) / 1000;

            if (timeDiff > 0) {
                this.metrics.messagesPerSecond = this.metrics.messageBuffer.length / timeDiff;
                this.metrics.messageBuffer = [];
                this.metrics.lastMessageTime = now;
            }
        }, 5000); // Update every 5 seconds

        // Log performance metrics
        setInterval(() => {
            this.logPerformanceMetrics();
        }, 30000); // Log every 30 seconds
    }

    logPerformanceMetrics() {
        console.log('📊 Socket.IO Performance Metrics:', {
            activeConnections: this.metrics.activeConnections,
            totalConnections: this.metrics.totalConnections,
            totalMessages: this.metrics.totalMessages,
            messagesPerSecond: this.metrics.messagesPerSecond.toFixed(2),
            activeRooms: this.roomParticipants.size,
            memoryUsage: process.memoryUsage()
        });
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`Received ${signal}, starting graceful shutdown...`);

            try {
                // Notify all connected clients
                this.io.emit('server-shutdown', {
                    message: 'Server is shutting down',
                    timestamp: new Date().toISOString()
                });

                // Wait a bit for messages to be sent
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Close all socket connections
                this.io.close(() => {
                    console.log('Socket.IO server closed');
                });

                // Clean up resources
                this.connectedSockets.clear();
                this.roomParticipants.clear();

            } catch (error) {
                console.error('Graceful shutdown error:', error);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }

    // Public methods for external access
    getMetrics() {
        return {
            ...this.metrics,
            activeRooms: this.roomParticipants.size,
            roomParticipants: Array.from(this.roomParticipants.entries()).map(([roomId, participants]) => ({
                roomId,
                participantCount: participants.size
            }))
        };
    }

    async getWebRTCStats() {
        return await webrtcConnectionManager.getOverallStats();
    }

    getConnectedSockets() {
        return Array.from(this.connectedSockets.values()).map(info => ({
            socketId: info.socket.id,
            userId: info.userId,
            userName: info.userName,
            connectedAt: info.connectedAt,
            lastActivity: info.lastActivity,
            roomId: info.roomId
        }));
    }

    // Broadcast to all sockets
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    // Broadcast to specific room
    broadcastToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    // Get Socket.IO instance
    getIO() {
        return this.io;
    }
}

export default EnhancedSocketServer;
