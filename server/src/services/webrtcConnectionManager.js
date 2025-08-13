import { getRedisClient, getRedisPublisher, getRedisSubscriber } from '../utils/redis.js';
import meetingCacheService from './meetingCacheService.js';
import presenceService from './presenceService.js';

class WebRTCConnectionManager {
    constructor() {
        this.redis = getRedisClient();
        this.publisher = getRedisPublisher();
        this.subscriber = getRedisSubscriber();

        // Connection tracking
        this.connections = new Map(); // socketId -> connection info
        this.peerConnections = new Map(); // connectionId -> peer connection data

        // Configuration
        this.connectionTimeout = 30000; // 30 seconds
        this.iceGatheringTimeout = 10000; // 10 seconds
        this.maxReconnectAttempts = 3;

        this.setupRedisSubscriptions();
        this.startConnectionMonitoring();
    }

    // Generate cache keys
    getConnectionKey(connectionId) {
        return `webrtc:connection:${connectionId}`;
    }

    getPeerConnectionKey(fromUserId, toUserId, meetingId) {
        return `webrtc:peer:${meetingId}:${fromUserId}:${toUserId}`;
    }

    getMeetingConnectionsKey(meetingId) {
        return `webrtc:meeting:${meetingId}:connections`;
    }

    getConnectionStatsKey(meetingId) {
        return `webrtc:stats:${meetingId}`;
    }

    // Initialize connection tracking for a socket
    async initializeConnection(socket, meetingId) {
        try {
            const connectionInfo = {
                socketId: socket.id,
                userId: socket.userId,
                userName: socket.userName,
                meetingId,
                status: 'initializing',
                connectedPeers: new Set(),
                failedConnections: new Map(),
                lastActivity: new Date().toISOString(),
                connectionAttempts: 0,
                iceConnectionState: 'new',
                signalingState: 'stable'
            };

            this.connections.set(socket.id, connectionInfo);

            // Cache connection info in Redis
            const connectionKey = this.getConnectionKey(socket.id);
            await this.redis.setex(connectionKey, 300, JSON.stringify(connectionInfo)); // 5 minutes

            // Add to meeting connections
            const meetingConnectionsKey = this.getMeetingConnectionsKey(meetingId);
            await this.redis.sadd(meetingConnectionsKey, socket.id);
            await this.redis.expire(meetingConnectionsKey, 3600); // 1 hour

            console.log(`WebRTC connection initialized for ${socket.userName} in meeting ${meetingId}`);
            return connectionInfo;
        } catch (error) {
            console.error('Initialize connection error:', error);
            return null;
        }
    }

    // Handle WebRTC offer
    async handleOffer(socket, data) {
        try {
            const { targetUserId, offer, meetingId } = data;
            const fromUserId = socket.userId;

            // Validate meeting and participants
            const participants = await meetingCacheService.getCachedMeetingParticipants(meetingId);
            const targetParticipant = participants.find(p => p.userId === targetUserId);

            if (!targetParticipant) {
                socket.emit('webrtc-error', {
                    error: 'Target participant not found',
                    code: 'PARTICIPANT_NOT_FOUND'
                });
                return;
            }

            // Create peer connection tracking
            const connectionId = `${fromUserId}_${targetUserId}_${Date.now()}`;
            const peerConnectionKey = this.getPeerConnectionKey(fromUserId, targetUserId, meetingId);

            const peerConnectionData = {
                connectionId,
                fromUserId,
                toUserId: targetUserId,
                meetingId,
                status: 'offer-sent',
                offer,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                attempts: 1
            };

            // Store peer connection data
            await this.redis.setex(peerConnectionKey, 60, JSON.stringify(peerConnectionData)); // 1 minute
            this.peerConnections.set(connectionId, peerConnectionData);

            // Update connection info
            const connectionInfo = this.connections.get(socket.id);
            if (connectionInfo) {
                connectionInfo.lastActivity = new Date().toISOString();
                connectionInfo.signalingState = 'have-local-offer';
            }

            // Forward offer to target participant
            const targetSocket = this.findSocketByUserId(targetUserId, meetingId);
            if (targetSocket) {
                targetSocket.emit('webrtc-offer', {
                    connectionId,
                    offer,
                    fromUserId,
                    fromUserName: socket.userName,
                    meetingId
                });

                // Publish to Redis for cross-server communication
                await this.publisher.publish('webrtc:offer', JSON.stringify({
                    connectionId,
                    offer,
                    fromUserId,
                    targetUserId,
                    meetingId,
                    timestamp: new Date().toISOString()
                }));

                console.log(`WebRTC offer sent from ${socket.userName} to ${targetParticipant.userName}`);
            } else {
                socket.emit('webrtc-error', {
                    error: 'Target participant not available',
                    code: 'PARTICIPANT_OFFLINE'
                });
            }

        } catch (error) {
            console.error('Handle offer error:', error);
            socket.emit('webrtc-error', {
                error: 'Failed to process offer',
                code: 'OFFER_FAILED'
            });
        }
    }

    // Handle WebRTC answer
    async handleAnswer(socket, data) {
        try {
            const { connectionId, answer, meetingId } = data;
            const toUserId = socket.userId;

            // Get peer connection data
            const peerConnectionData = this.peerConnections.get(connectionId);
            if (!peerConnectionData) {
                socket.emit('webrtc-error', {
                    error: 'Connection not found',
                    code: 'CONNECTION_NOT_FOUND'
                });
                return;
            }

            // Update peer connection data
            peerConnectionData.answer = answer;
            peerConnectionData.status = 'answer-sent';
            peerConnectionData.lastActivity = new Date().toISOString();

            const peerConnectionKey = this.getPeerConnectionKey(
                peerConnectionData.fromUserId,
                toUserId,
                meetingId
            );
            await this.redis.setex(peerConnectionKey, 60, JSON.stringify(peerConnectionData));

            // Update connection info
            const connectionInfo = this.connections.get(socket.id);
            if (connectionInfo) {
                connectionInfo.lastActivity = new Date().toISOString();
                connectionInfo.signalingState = 'have-remote-offer';
            }

            // Forward answer to original sender
            const fromSocket = this.findSocketByUserId(peerConnectionData.fromUserId, meetingId);
            if (fromSocket) {
                fromSocket.emit('webrtc-answer', {
                    connectionId,
                    answer,
                    fromUserId: toUserId,
                    fromUserName: socket.userName,
                    meetingId
                });

                // Publish to Redis for cross-server communication
                await this.publisher.publish('webrtc:answer', JSON.stringify({
                    connectionId,
                    answer,
                    fromUserId: toUserId,
                    targetUserId: peerConnectionData.fromUserId,
                    meetingId,
                    timestamp: new Date().toISOString()
                }));

                console.log(`WebRTC answer sent from ${socket.userName} to ${peerConnectionData.fromUserId}`);
            } else {
                socket.emit('webrtc-error', {
                    error: 'Original sender not available',
                    code: 'SENDER_OFFLINE'
                });
            }

        } catch (error) {
            console.error('Handle answer error:', error);
            socket.emit('webrtc-error', {
                error: 'Failed to process answer',
                code: 'ANSWER_FAILED'
            });
        }
    }

    // Handle ICE candidate
    async handleIceCandidate(socket, data) {
        try {
            const { targetUserId, candidate, meetingId, connectionId } = data;
            const fromUserId = socket.userId;

            // Validate target participant
            const participants = await meetingCacheService.getCachedMeetingParticipants(meetingId);
            const targetParticipant = participants.find(p => p.userId === targetUserId);

            if (!targetParticipant) {
                return; // Silently ignore invalid targets for ICE candidates
            }

            // Update connection activity
            const connectionInfo = this.connections.get(socket.id);
            if (connectionInfo) {
                connectionInfo.lastActivity = new Date().toISOString();
            }

            // Forward ICE candidate to target
            const targetSocket = this.findSocketByUserId(targetUserId, meetingId);
            if (targetSocket) {
                targetSocket.emit('webrtc-ice-candidate', {
                    connectionId,
                    candidate,
                    fromUserId,
                    meetingId
                });

                // Publish to Redis for cross-server communication
                await this.publisher.publish('webrtc:ice-candidate', JSON.stringify({
                    connectionId,
                    candidate,
                    fromUserId,
                    targetUserId,
                    meetingId,
                    timestamp: new Date().toISOString()
                }));
            }

        } catch (error) {
            console.error('Handle ICE candidate error:', error);
        }
    }

    // Handle connection state changes
    async handleConnectionStateChange(socket, data) {
        try {
            const { connectionId, iceConnectionState, signalingState, targetUserId, meetingId } = data;
            const userId = socket.userId;

            // Update connection info
            const connectionInfo = this.connections.get(socket.id);
            if (connectionInfo) {
                connectionInfo.iceConnectionState = iceConnectionState;
                connectionInfo.signalingState = signalingState;
                connectionInfo.lastActivity = new Date().toISOString();

                // Handle successful connection
                if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
                    connectionInfo.connectedPeers.add(targetUserId);
                    connectionInfo.status = 'connected';

                    // Remove from failed connections if it was there
                    connectionInfo.failedConnections.delete(targetUserId);

                    console.log(`WebRTC connection established: ${socket.userName} <-> ${targetUserId}`);
                }

                // Handle failed connection
                if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected') {
                    connectionInfo.connectedPeers.delete(targetUserId);

                    if (iceConnectionState === 'failed') {
                        const failureCount = (connectionInfo.failedConnections.get(targetUserId) || 0) + 1;
                        connectionInfo.failedConnections.set(targetUserId, failureCount);

                        // Trigger reconnection if under max attempts
                        if (failureCount < this.maxReconnectAttempts) {
                            setTimeout(() => {
                                this.triggerReconnection(socket, targetUserId, meetingId);
                            }, 2000 * failureCount); // Exponential backoff
                        }
                    }

                    console.log(`WebRTC connection ${iceConnectionState}: ${socket.userName} <-> ${targetUserId}`);
                }

                // Update Redis cache
                const connectionKey = this.getConnectionKey(socket.id);
                await this.redis.setex(connectionKey, 300, JSON.stringify(connectionInfo));
            }

            // Update connection statistics
            await this.updateConnectionStats(meetingId, iceConnectionState);

            // Notify other participants about connection state
            socket.to(meetingId).emit('peer-connection-state', {
                userId,
                targetUserId,
                iceConnectionState,
                signalingState
            });

        } catch (error) {
            console.error('Handle connection state change error:', error);
        }
    }

    // Trigger reconnection attempt
    async triggerReconnection(socket, targetUserId, meetingId) {
        try {
            const connectionInfo = this.connections.get(socket.id);
            if (!connectionInfo) return;

            connectionInfo.connectionAttempts++;

            socket.emit('webrtc-reconnect', {
                targetUserId,
                meetingId,
                attempt: connectionInfo.connectionAttempts
            });

            console.log(`Triggering WebRTC reconnection: ${socket.userName} -> ${targetUserId} (attempt ${connectionInfo.connectionAttempts})`);
        } catch (error) {
            console.error('Trigger reconnection error:', error);
        }
    }

    // Find socket by user ID in a meeting
    findSocketByUserId(userId, meetingId) {
        for (const [socketId, connectionInfo] of this.connections) {
            if (connectionInfo.userId === userId && connectionInfo.meetingId === meetingId) {
                // TODO: Get actual socket instance from Socket.IO server
                // This is a placeholder - in real implementation, you'd need access to io.sockets
                return { id: socketId, emit: () => { } }; // Placeholder
            }
        }
        return null;
    }

    // Clean up connection when user leaves
    async cleanupConnection(socket, meetingId) {
        try {
            const connectionInfo = this.connections.get(socket.id);
            if (!connectionInfo) return;

            // Remove from local tracking
            this.connections.delete(socket.id);

            // Remove from Redis
            const connectionKey = this.getConnectionKey(socket.id);
            await this.redis.del(connectionKey);

            // Remove from meeting connections
            const meetingConnectionsKey = this.getMeetingConnectionsKey(meetingId);
            await this.redis.srem(meetingConnectionsKey, socket.id);

            // Clean up peer connections
            for (const [connectionId, peerData] of this.peerConnections) {
                if (peerData.fromUserId === socket.userId || peerData.toUserId === socket.userId) {
                    this.peerConnections.delete(connectionId);

                    const peerConnectionKey = this.getPeerConnectionKey(
                        peerData.fromUserId,
                        peerData.toUserId,
                        meetingId
                    );
                    await this.redis.del(peerConnectionKey);
                }
            }

            // Notify other participants about disconnection
            const participants = await meetingCacheService.getCachedMeetingParticipants(meetingId);
            for (const participant of participants) {
                if (participant.userId !== socket.userId && participant.socketId) {
                    // Notify about peer disconnection
                    // TODO: Emit to actual socket
                }
            }

            console.log(`WebRTC connection cleaned up for ${socket.userName}`);
        } catch (error) {
            console.error('Cleanup connection error:', error);
        }
    }

    // Update connection statistics
    async updateConnectionStats(meetingId, connectionState) {
        try {
            const statsKey = this.getConnectionStatsKey(meetingId);
            const stats = await this.redis.hgetall(statsKey) || {};

            // Initialize stats if not exists
            if (!stats.totalConnections) {
                stats.totalConnections = '0';
                stats.successfulConnections = '0';
                stats.failedConnections = '0';
                stats.activeConnections = '0';
            }

            // Update based on connection state
            switch (connectionState) {
                case 'connected':
                case 'completed':
                    stats.successfulConnections = String(parseInt(stats.successfulConnections) + 1);
                    stats.activeConnections = String(parseInt(stats.activeConnections) + 1);
                    break;
                case 'failed':
                    stats.failedConnections = String(parseInt(stats.failedConnections) + 1);
                    break;
                case 'disconnected':
                case 'closed':
                    stats.activeConnections = String(Math.max(0, parseInt(stats.activeConnections) - 1));
                    break;
            }

            stats.lastUpdated = new Date().toISOString();

            // Save stats
            await this.redis.hmset(statsKey, stats);
            await this.redis.expire(statsKey, 3600); // 1 hour

        } catch (error) {
            console.error('Update connection stats error:', error);
        }
    }

    // Get connection statistics for a meeting
    async getConnectionStats(meetingId) {
        try {
            const statsKey = this.getConnectionStatsKey(meetingId);
            const stats = await this.redis.hgetall(statsKey);

            return {
                totalConnections: parseInt(stats.totalConnections || '0'),
                successfulConnections: parseInt(stats.successfulConnections || '0'),
                failedConnections: parseInt(stats.failedConnections || '0'),
                activeConnections: parseInt(stats.activeConnections || '0'),
                successRate: stats.totalConnections > 0
                    ? (parseInt(stats.successfulConnections) / parseInt(stats.totalConnections) * 100).toFixed(2)
                    : '0',
                lastUpdated: stats.lastUpdated || null
            };
        } catch (error) {
            console.error('Get connection stats error:', error);
            return {
                totalConnections: 0,
                successfulConnections: 0,
                failedConnections: 0,
                activeConnections: 0,
                successRate: '0',
                lastUpdated: null
            };
        }
    }

    // Setup Redis subscriptions for cross-server WebRTC signaling
    setupRedisSubscriptions() {
        const channels = [
            'webrtc:offer',
            'webrtc:answer',
            'webrtc:ice-candidate',
            'webrtc:connection-state'
        ];

        channels.forEach(channel => {
            this.subscriber.subscribe(channel);
        });

        this.subscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                this.handleRedisWebRTCMessage(channel, data);
            } catch (error) {
                console.error('Redis WebRTC message error:', error);
            }
        });
    }

    // Handle Redis WebRTC messages for cross-server communication
    handleRedisWebRTCMessage(channel, data) {
        // This would be implemented to handle cross-server WebRTC signaling
        console.log(`WebRTC Redis message: ${channel}`, data);
    }

    // Start connection monitoring
    startConnectionMonitoring() {
        setInterval(() => {
            this.monitorConnections();
        }, 10000); // Check every 10 seconds
    }

    // Monitor connection health
    async monitorConnections() {
        try {
            const now = new Date();
            const timeoutThreshold = now.getTime() - this.connectionTimeout;

            for (const [socketId, connectionInfo] of this.connections) {
                const lastActivity = new Date(connectionInfo.lastActivity).getTime();

                if (lastActivity < timeoutThreshold) {
                    console.log(`Connection timeout detected for ${connectionInfo.userName}`);

                    // Clean up timed out connection
                    this.connections.delete(socketId);

                    const connectionKey = this.getConnectionKey(socketId);
                    await this.redis.del(connectionKey);
                }
            }
        } catch (error) {
            console.error('Monitor connections error:', error);
        }
    }

    // Get overall WebRTC statistics
    async getOverallStats() {
        try {
            const totalConnections = this.connections.size;
            const connectedCount = Array.from(this.connections.values())
                .filter(conn => conn.status === 'connected').length;

            const meetingPattern = 'webrtc:stats:*';
            const statsKeys = await this.redis.keys(meetingPattern);

            let totalMeetings = statsKeys.length;
            let totalSuccessful = 0;
            let totalFailed = 0;

            for (const key of statsKeys) {
                const stats = await this.redis.hgetall(key);
                totalSuccessful += parseInt(stats.successfulConnections || '0');
                totalFailed += parseInt(stats.failedConnections || '0');
            }

            return {
                activeConnections: totalConnections,
                connectedConnections: connectedCount,
                activeMeetings: totalMeetings,
                totalSuccessfulConnections: totalSuccessful,
                totalFailedConnections: totalFailed,
                overallSuccessRate: (totalSuccessful + totalFailed) > 0
                    ? (totalSuccessful / (totalSuccessful + totalFailed) * 100).toFixed(2)
                    : '0',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Get overall stats error:', error);
            return {
                activeConnections: 0,
                connectedConnections: 0,
                activeMeetings: 0,
                totalSuccessfulConnections: 0,
                totalFailedConnections: 0,
                overallSuccessRate: '0',
                timestamp: new Date().toISOString()
            };
        }
    }
}

export default new WebRTCConnectionManager();