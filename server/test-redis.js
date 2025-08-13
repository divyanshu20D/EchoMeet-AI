require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const sessionCacheService = require('./src/services/sessionCacheService');
const meetingCacheService = require('./src/services/meetingCacheService');

async function testRedisConnection() {
    console.log('🔴 Testing Redis Connection...\n');

    try {
        // Initialize Redis
        initializeRedis();

        // Test basic connection
        const healthCheck = await checkRedisConnection();
        console.log('Redis Health Check:', healthCheck);

        if (healthCheck.status !== 'connected') {
            console.error('❌ Redis connection failed!');
            process.exit(1);
        }

        console.log('✅ Redis connection successful!\n');

        // Test session cache service
        console.log('🧪 Testing Session Cache Service...');
        const testSessionId = 'test_session_123';
        const testSessionData = {
            userId: 'user_123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'USER',
            organizationId: 'org_123'
        };

        // Set session
        const setResult = await sessionCacheService.setSession(testSessionId, testSessionData);
        console.log('Set session result:', setResult);

        // Get session
        const getResult = await sessionCacheService.getSession(testSessionId);
        console.log('Get session result:', getResult);

        // Delete session
        const deleteResult = await sessionCacheService.deleteSession(testSessionId);
        console.log('Delete session result:', deleteResult);

        console.log('✅ Session cache service working!\n');

        // Test meeting cache service
        console.log('🧪 Testing Meeting Cache Service...');
        const testMeetingData = {
            id: 'meeting_123',
            title: 'Test Meeting',
            hostId: 'user_123',
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        // Cache meeting
        const cacheResult = await meetingCacheService.cacheMeeting(testMeetingData);
        console.log('Cache meeting result:', cacheResult);

        // Get cached meeting
        const getCachedResult = await meetingCacheService.getCachedMeeting('meeting_123');
        console.log('Get cached meeting result:', getCachedResult);

        // Remove from cache
        const removeResult = await meetingCacheService.removeMeetingFromCache('meeting_123');
        console.log('Remove meeting result:', removeResult);

        console.log('✅ Meeting cache service working!\n');

        // Test statistics
        console.log('📊 Getting Cache Statistics...');
        const sessionStats = await sessionCacheService.getSessionStats();
        const meetingStats = await meetingCacheService.getMeetingCacheStats();

        console.log('Session Stats:', sessionStats);
        console.log('Meeting Stats:', meetingStats);

        console.log('\n🎉 All Redis tests passed successfully!');

    } catch (error) {
        console.error('❌ Redis test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the test
testRedisConnection();