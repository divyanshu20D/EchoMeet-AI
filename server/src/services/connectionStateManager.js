const { getRedisClient } = require('../utils/redis');
const meetingCacheService = require('./meetingCacheService');

class ConnectionStateManager {
    constructor() {
        this.redis = getRedisClient();

        // Connection state tracking
        this.connectionStates = new Map();
        this.reconnectionAttempts = new Map();

        // Configuration
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000; // 2 seconds
        this.connectionTimeout = 30000; // 30 seconds
        this.heartbeatInterval = 10000; // 10 seconds

        this.startHeartbeat();
    }

    // Generate cache keys
    getConnectionStateKey(userId, meetingId) {
        return `connection_state:${meetingId}:${userId}`;
    }

    getMeetingConnectionsKey(meetingId) {
        return `meeting_connections:${meetingId}`;
    }

    // Initialize connection state for a user in a meeting
    async initializeConnectionState(userId, meetingId, socketId) {
        try {
            const connectionState = {
                userId,
                meetingId,
                socketId,
                status: 'connecting',
                connectedPeers: [],
                failedPeers: [],
                lastHeartbeat: new Date().toISOString(),
                connectionQuality: 'unknown',
                bandwidth: {
                    upload: 0,
                    download: 0
                },
                mediaState: {
                    audio: { enabled: true, muted: false },
                    video: { enabled: true, muted: false },
                    screen: { sharing: false }
                },
                networkStats: {
                    rtt: 0,
                    packetLoss: 0,
                    jitter: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Store in memory
            const stateKey = `${userId}_${meetingId}`;
            this.connectionStates.set(stateKey, connectionState);

            // Store in Redis
            const redisKey = this.getConnectionStateKey(userId, meetingId);
            await this.redis.setex(redisKey, 3600, JSON.stringify(connectionState)); // 1 hour

            // Add to meeting connections
            const meetingConnectionsKey = this.getMeetingConnectionsKey(meetingId);
            await this.redis.sadd(meetingConnectionsKey, userId);
            await this.redis.expire(meetingConnectionsKey, 3600);

            console.log(`Connection state initialized for user ${userId} in meeting ${meetingId}`);
            return connectionState;

        } catch (error) {
            console.error('Initialize connection state error:', error);
            return null;
        }
    }

    // Update connection state
    async updateConnectionState(userId, meetingId, updates) {
        try {
            const stateKey = `${userId}_${meetingId}`;
            const connectionState = this.connectionStates.get(stateKey);

            if (!connectionState) {
                console.warn(`Connection state not found for user ${userId} in meeting ${meetingId}`);
                return null;
            }

            // Apply updates
            Object.assign(connectionState, updates);
            connectionState.updatedAt = new Date().toISOString();

            // Update in memory
            this.connectionStates.set(stateKey, connectionState);

            // Update in Redis
            const redisKey = this.getConnectionStateKey(userId, meetingId);
            await this.redis.setex(redisKey, 3600, JSON.stringify(connectionState));

            return connectionState;

        } catch (error) {
            console.error('Update connection state error:', error);
            return null;
        }
    }

    // Handle peer connection establishment
    async handlePeerConnection(userId, meetingId, peerId, connectionState) {
        try {
            const stateKey = `${userId}_${meetingId}`;
            const userConnectionState = this.connectionStates.get(stateKey);

            if (!userConnectionState) return;

            switch (connectionState) {
                case 'connected':
                    // Add to connected peers
                    if (!userConnectionState.connectedPeers.includes(peerId)) {
                        userConnectionState.connectedPeers.push(peerId);
                    }

                    // Remove from failed peers if it was there
                    userConnectionState.failedPeers = userConnectionState.failedPeers.filter(id => id !== peerId);

                    // Update overall status
                    userConnectionState.status = 'connected';
                    break;

                case 'failed':
                case 'disconnected':
                    // Remove from connected peers
                    userConnectionState.connectedPeers = userConnectionState.connectedPeers.filter(id => id !== peerId);

                    // Add to failed peers
                    if (!userConnectionState.failedPeers.includes(peerId)) {
                        userConnectionState.failedPeers.push(peerId);
                    }

                    // Check if we should attempt reconnection
                    if (connectionState === 'failed') {
                        await this.attemptReconnection(userId, meetingId, peerId);
                    }
                    break;

                case 'connecting':
                    userConnectionState.status = 'connecting';
                    break;
            }

            // Update the state
            await this.updateConnectionState(userId, meetingId, userConnectionState);

            console.log(`Peer connection ${connectionState}: ${userId} <-> ${peerId} in meeting ${meetingId}`);

        } catch (error) {
            console.error('Handle peer connection error:', error);
        }
    }

    // Attempt reconnection for failed peer connections
    async attemptReconnection(userId, meetingId, peerId) {
        try {
            const reconnectKey = `${userId}_${meetingId}_${peerId}`;
            const currentAttempts = this.reconnectionAttempts.get(reconnectKey) || 0;

            if (currentAttempts >= this.maxReconnectAttempts) {
                console.log(`Max reconnection attempts reached for ${userId} -> ${peerId}`);
                return;
            }

            // Increment attempt counter
            this.reconnectionAttempts.set(reconnectKey, currentAttempts + 1);

            // Schedule reconnection with exponential backoff
            const delay = this.reconnectDelay * Math.pow(2, currentAttempts);

            setTimeout(async () => {
                try {
                    // Trigger reconnection event
                    const participants = await meetingCacheService.getCachedMeetingParticipants(meetingId);
                    const userParticipant = participants.find(p => p.userId === userId);
                    const peerParticipant = participants.find(p => p.userId === peerId);

                    if (userParticipant && peerParticipant && userParticipant.socketId) {
                        // Emit reconnection event to user's socket
                        // Note: In real implementation, you'd need access to the socket instance
                        console.log(`Triggering reconnection: ${userId} -> ${peerId} (attempt ${currentAttempts + 1})`);

                        // This would emit to the actual socket
                        // socket.emit('peer-reconnect', { peerId, attempt: currentAttempts + 1 });
                    }

                } catch (error) {
                    console.error('Reconnection trigger error:', error);
                }
            }, delay);

        } catch (error) {
            console.error('Attempt reconnection error:', error);
        }
    }

    // Update network statistics
    async updateNetworkStats(userId, meetingId, stats) {
        try {
            const updates = {
                networkStats: {
                    rtt: stats.rtt || 0,
                    packetLoss: stats.packetLoss || 0,
                    jitter: stats.jitter || 0
                },
                bandwidth: {
                    upload: stats.uploadBandwidth || 0,
                    download: stats.downloadBandwidth || 0
                },
                connectionQuality: this.calculateConnectionQuality(stats)
            };

            await this.updateConnectionState(userId, meetingId, updates);

        } catch (error) {
            console.error('Update network stats error:', error);
        }
    }

    // Calculate connection quality based on network stats
    calculateConnectionQuality(stats) {
        const rtt = stats.rtt || 0;
        const packetLoss = stats.packetLoss || 0;
        const jitter = stats.jitter || 0;

        // Simple quality calculation
        if (rtt < 100 && packetLoss < 1 && jitter < 30) {
            return 'excellent';
        } else if (rtt < 200 && packetLoss < 3 && jitter < 50) {
            return 'good';
        } else if (rtt < 400 && packetLoss < 5 && jitter < 100) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    // Update media state
    async updateMediaState(userId, meetingId, mediaUpdates) {
        try {
            const stateKey = `${userId}_${meetingId}`;
            const connectionState = this.connectionStates.get(stateKey);

            if (connectionState) {
                Object.assign(connectionState.mediaState, mediaUpdates);
                await this.updateConnectionState(userId, meetingId, { mediaState: connectionState.mediaState });
            }

        } catch (error) {
            console.error('Update media state error:', error);
        }
    }

    // Handle heartbeat from client
    async handleHeartbeat(userId, meetingId, heartbeatData = {}) {
        try {
            const updates = {
                lastHeartbeat: new Date().toISOString(),
                status: 'connected'
            };

            // Include any additional heartbeat data
            if (heartbeatData.networkStats) {
                await this.updateNetworkStats(userId, meetingId, heartbeatData.networkStats);
            }

            await this.updateConnectionState(userId, meetingId, updates);

        } catch (error) {
            console.error('Handle heartbeat error:', error);
        }
    }

    // Get connection state
    async getConnectionState(userId, meetingId) {
        try {
            const stateKey = `${userId}_${meetingId}`;
            let connectionState = this.connectionStates.get(stateKey);

            if (!connectionState) {
                // Try to get from Redis
                const redisKey = this.getConnectionStateKey(userId, meetingId);
                const redisData = await this.redis.get(redisKey);

                if (redisData) {
                    connectionState = JSON.parse(redisData);
                    this.connectionStates.set(stateKey, connectionState);
                }
            }

            return connectionState;

        } catch (error) {
            console.error('Get connection state error:', error);
            return null;
        }
    }

    // Get all connection states for a meeting
    async getMeetingConnectionStates(meetingId) {
        try {
            const meetingConnectionsKey = this.getMeetingConnectionsKey(meetingId);
            const userIds = await this.redis.smembers(meetingConnectionsKey);

            const connectionStates = [];
            for (const userId of userIds) {
                const state = await this.getConnectionState(userId, meetingId);
                if (state) {
                    connectionStates.push(state);
                }
            }

            return connectionStates;

        } catch (error) {
            console.error('Get meeting connection states error:', error);
            return [];
        }
    }

    // Clean up connection state when user leaves
    async cleanupConnectionState(userId, meetingId) {
        try {
            const stateKey = `${userId}_${meetingId}`;

            // Remove from memory
            this.connectionStates.delete(stateKey);

            // Remove reconnection attempts
            for (const [key] of this.reconnectionAttempts) {
                if (key.startsWith(`${userId}_${meetingId}_`)) {
                    this.reconnectionAttempts.delete(key);
                }
            }

            // Remove from Redis
            const redisKey = this.getConnectionStateKey(userId, meetingId);
            await this.redis.del(redisKey);

            // Remove from meeting connections
            const meetingConnectionsKey = this.getMeetingConnectionsKey(meetingId);
            await this.redis.srem(meetingConnectionsKey, userId);

            console.log(`Connection state cleaned up for user ${userId} in meeting ${meetingId}`);

        } catch (error) {
            console.error('Cleanup connection state error:', error);
        }
    }

    // Start heartbeat monitoring
    startHeartbeat() {
        setInterval(() => {
            this.checkConnectionHealth();
        }, this.heartbeatInterval);
    }

    // Check connection health and handle timeouts
    async checkConnectionHealth() {
        try {
            const now = new Date();
            const timeoutThreshold = now.getTime() - this.connectionTimeout;

            for (const [stateKey, connectionState] of this.connectionStates) {
                const lastHeartbeat = new Date(connectionState.lastHeartbeat).getTime();

                if (lastHeartbeat < timeoutThreshold) {
                    console.log(`Connection timeout detected for ${connectionState.userId} in meeting ${connectionState.meetingId}`);

                    // Mark as disconnected
                    await this.updateConnectionState(
                        connectionState.userId,
                        connectionState.meetingId,
                        { status: 'timeout' }
                    );

                    // Trigger cleanup after additional grace period
                    setTimeout(() => {
                        this.cleanupConnectionState(connectionState.userId, connectionState.meetingId);
                    }, 30000); // 30 seconds grace period
                }
            }

        } catch (error) {
            console.error('Check connection health error:', error);
        }
    }

    // Get connection statistics
    getConnectionStats() {
        const stats = {
            totalConnections: this.connectionStates.size,
            connectionsByStatus: {},
            connectionsByQuality: {},
            averageConnectedPeers: 0,
            totalReconnectionAttempts: this.reconnectionAttempts.size
        };

        let totalPeers = 0;

        for (const connectionState of this.connectionStates.values()) {
            // Count by status
            const status = connectionState.status;
            stats.connectionsByStatus[status] = (stats.connectionsByStatus[status] || 0) + 1;

            // Count by quality
            const quality = connectionState.connectionQuality;
            stats.connectionsByQuality[quality] = (stats.connectionsByQuality[quality] || 0) + 1;

            // Sum connected peers
            totalPeers += connectionState.connectedPeers.length;
        }

        // Calculate average
        if (stats.totalConnections > 0) {
            stats.averageConnectedPeers = (totalPeers / stats.totalConnections).toFixed(2);
        }

        return stats;
    }
}

module.exports = new ConnectionStateManager();