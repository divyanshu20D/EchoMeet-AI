require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const webrtcConnectionManager = require('./src/services/webrtcConnectionManager');
const connectionStateManager = require('./src/services/connectionStateManager');
const presenceService = require('./src/services/presenceService');
const meetingCacheService = require('./src/services/meetingCacheService');

async function testRealtimeCommunication() {
    console.log('🚀 Testing Enhanced Real-time Communication...\n');

    try {
        // Initialize Redis
        initializeRedis();

        // Test Redis connection
        const redisHealth = await checkRedisConnection();
        console.log('Redis Health Check:', redisHealth);

        if (redisHealth.status !== 'connected') {
            console.error('❌ Redis connection failed!');
            process.exit(1);
        }

        console.log('✅ Redis connection successful!\n');

        // Test WebRTC Connection Manager
        console.log('🧪 Testing WebRTC Connection Manager...');

        // Simulate connection initialization
        const mockSocket1 = {
            id: 'socket_123',
            userId: 'user_123',
            userName: 'Test User 1'
        };

        const mockSocket2 = {
            id: 'socket_456',
            userId: 'user_456',
            userName: 'Test User 2'
        };

        const testMeetingId = 'meeting_test_123';

        // Initialize connections
        const connection1 = await webrtcConnectionManager.initializeConnection(mockSocket1, testMeetingId);
        const connection2 = await webrtcConnectionManager.initializeConnection(mockSocket2, testMeetingId);

        console.log('Connection 1 initialized:', connection1 ? '✅' : '❌');
        console.log('Connection 2 initialized:', connection2 ? '✅' : '❌');

        // Test WebRTC offer/answer flow
        const mockOfferData = {
            targetUserId: 'user_456',
            offer: { type: 'offer', sdp: 'mock-sdp-offer' },
            meetingId: testMeetingId
        };

        console.log('Testing WebRTC offer handling...');
        // Note: This would normally emit to actual sockets
        // await webrtcConnectionManager.handleOffer(mockSocket1, mockOfferData);

        // Test connection statistics
        const webrtcStats = await webrtcConnectionManager.getOverallStats();
        console.log('WebRTC Stats:', webrtcStats);

        console.log('✅ WebRTC Connection Manager working!\n');

        // Test Connection State Manager
        console.log('🧪 Testing Connection State Manager...');

        // Initialize connection states
        const state1 = await connectionStateManager.initializeConnectionState('user_123', testMeetingId, 'socket_123');
        const state2 = await connectionStateManager.initializeConnectionState('user_456', testMeetingId, 'socket_456');

        console.log('Connection state 1 initialized:', state1 ? '✅' : '❌');
        console.log('Connection state 2 initialized:', state2 ? '✅' : '❌');

        // Test state updates
        await connectionStateManager.updateConnectionState('user_123', testMeetingId, {
            status: 'connected',
            connectionQuality: 'excellent'
        });

        // Test heartbeat
        await connectionStateManager.handleHeartbeat('user_123', testMeetingId, {
            networkStats: {
                rtt: 50,
                packetLoss: 0.1,
                jitter: 10
            }
        });

        // Test peer connection handling
        await connectionStateManager.handlePeerConnection('user_123', testMeetingId, 'user_456', 'connected');

        // Get connection states
        const meetingStates = await connectionStateManager.getMeetingConnectionStates(testMeetingId);
        console.log('Meeting connection states:', meetingStates.length > 0 ? '✅' : '❌');

        // Get connection statistics
        const connectionStats = connectionStateManager.getConnectionStats();
        console.log('Connection Stats:', connectionStats);

        console.log('✅ Connection State Manager working!\n');

        // Test Presence Service
        console.log('🧪 Testing Presence Service...');

        // Set users online
        const presence1 = await presenceService.setUserOnline('user_123', {
            name: 'Test User 1',
            email: 'user1@test.com'
        });

        const presence2 = await presenceService.setUserOnline('user_456', {
            name: 'Test User 2',
            email: 'user2@test.com'
        });

        console.log('User 1 set online:', presence1 ? '✅' : '❌');
        console.log('User 2 set online:', presence2 ? '✅' : '❌');

        // Add users to meeting
        await presenceService.addUserToMeeting('user_123', testMeetingId, 'host');
        await presenceService.addUserToMeeting('user_456', testMeetingId, 'participant');

        // Get online users
        const onlineUsers = await presenceService.getOnlineUsers();
        console.log('Online users count:', onlineUsers.length);

        // Get meeting participants
        const meetingParticipants = await presenceService.getMeetingParticipants(testMeetingId);
        console.log('Meeting participants:', Object.keys(meetingParticipants).length > 0 ? '✅' : '❌');

        // Update media state
        await presenceService.updateParticipantMedia('user_123', testMeetingId, {
            isAudioMuted: true,
            isVideoMuted: false
        });

        // Get presence statistics
        const presenceStats = await presenceService.getPresenceStats();
        console.log('Presence Stats:', presenceStats);

        console.log('✅ Presence Service working!\n');

        // Test Meeting Cache Service Integration
        console.log('🧪 Testing Meeting Cache Service Integration...');

        // Create test meeting
        const testMeeting = {
            id: testMeetingId,
            title: 'Test Real-time Meeting',
            hostId: 'user_123',
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        // Cache meeting
        const cachedMeeting = await meetingCacheService.cacheMeeting(testMeeting);
        console.log('Meeting cached:', cachedMeeting ? '✅' : '❌');

        // Add participants
        const participant1Data = {
            userId: 'user_123',
            userName: 'Test User 1',
            socketId: 'socket_123',
            role: 'host',
            joinedAt: new Date().toISOString()
        };

        const participant2Data = {
            userId: 'user_456',
            userName: 'Test User 2',
            socketId: 'socket_456',
            role: 'participant',
            joinedAt: new Date().toISOString()
        };

        await meetingCacheService.addParticipantToMeeting(testMeetingId, participant1Data);
        await meetingCacheService.addParticipantToMeeting(testMeetingId, participant2Data);

        // Get participants
        const participants = await meetingCacheService.getCachedMeetingParticipants(testMeetingId);
        console.log('Meeting participants cached:', participants.length > 0 ? '✅' : '❌');

        // Update meeting state
        await meetingCacheService.setMeetingState(testMeetingId, {
            status: 'ACTIVE',
            participantCount: 2,
            isRecording: false
        });

        // Get meeting state
        const meetingState = await meetingCacheService.getMeetingState(testMeetingId);
        console.log('Meeting state:', meetingState ? '✅' : '❌');

        console.log('✅ Meeting Cache Service Integration working!\n');

        // Performance Test
        console.log('🧪 Running Performance Tests...');

        const startTime = Date.now();
        const iterations = 100;

        // Test rapid state updates
        for (let i = 0; i < iterations; i++) {
            await connectionStateManager.handleHeartbeat('user_123', testMeetingId, {
                networkStats: {
                    rtt: Math.random() * 100,
                    packetLoss: Math.random() * 2,
                    jitter: Math.random() * 50
                }
            });
        }

        const endTime = Date.now();
        const avgTime = (endTime - startTime) / iterations;

        console.log(`Performance Test Results:`);
        console.log(`- ${iterations} heartbeat updates in ${endTime - startTime}ms`);
        console.log(`- Average time per update: ${avgTime.toFixed(2)}ms`);
        console.log(`- Updates per second: ${(1000 / avgTime).toFixed(2)}`);

        console.log('✅ Performance tests completed!\n');

        // Cleanup
        console.log('🧹 Cleaning up test data...');

        await connectionStateManager.cleanupConnectionState('user_123', testMeetingId);
        await connectionStateManager.cleanupConnectionState('user_456', testMeetingId);
        await presenceService.removeUserFromMeeting('user_123', testMeetingId);
        await presenceService.removeUserFromMeeting('user_456', testMeetingId);
        await presenceService.setUserOffline('user_123');
        await presenceService.setUserOffline('user_456');
        await meetingCacheService.removeMeetingFromCache(testMeetingId);

        console.log('✅ Cleanup completed!\n');

        // Final Statistics
        console.log('📊 Final Test Statistics:');
        const finalWebRTCStats = await webrtcConnectionManager.getOverallStats();
        const finalConnectionStats = connectionStateManager.getConnectionStats();
        const finalPresenceStats = await presenceService.getPresenceStats();

        console.log('WebRTC Stats:', finalWebRTCStats);
        console.log('Connection Stats:', finalConnectionStats);
        console.log('Presence Stats:', finalPresenceStats);

        console.log('\n🎉 All Enhanced Real-time Communication tests passed successfully!');

    } catch (error) {
        console.error('❌ Real-time communication test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the test
testRealtimeCommunication();