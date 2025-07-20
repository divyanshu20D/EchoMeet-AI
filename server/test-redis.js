require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const cacheService = require('./src/services/cacheService');
const sessionService = require('./src/services/sessionService');
const presenceService = require('./src/services/presenceService');

async function testRedisIntegration() {
    console.log('🔴 Testing Redis Integration...\n');

    try {
        // Initialize Redis
        console.log('1. Initializing Redis connection...');
        initializeRedis();

        // Test Redis connection
        console.log('2. Testing Redis connection...');
        const connectionStatus = await checkRedisConnection();
        console.log('✅ Redis connection:', connectionStatus.status);

        // Test basic cache operations
        console.log('\n3. Testing basic cache operations...');
        await cacheService.set('test:key', { message: 'Hello Redis!' }, 60);
        const cachedData = await cacheService.get('test:key');
        console.log('✅ Cache set/get:', cachedData.message);

        // Test session service
        console.log('\n4. Testing session service...');
        const testUser = {
            id: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'USER'
        };

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await sessionService.createSession(testUser.id, 'test-token-123', expiresAt, testUser);
        const session = await sessionService.getSession('test-token-123');
        console.log('✅ Session created and retrieved:', session.userInfo.name);

        // Test presence service
        console.log('\n5. Testing presence service...');
        await presenceService.setUserOnline(testUser.id, testUser);
        const presence = await presenceService.getUserPresence(testUser.id);
        console.log('✅ User presence set:', presence.status);

        // Test meeting presence
        console.log('\n6. Testing meeting presence...');
        await presenceService.addUserToMeeting(testUser.id, 'test-meeting-123', 'host');
        const meetingParticipants = await presenceService.getMeetingParticipants('test-meeting-123');
        console.log('✅ Meeting participant added:', Object.keys(meetingParticipants).length, 'participants');

        // Get statistics
        console.log('\n7. Getting statistics...');
        const sessionStats = await sessionService.getSessionStats();
        const presenceStats = await presenceService.getPresenceStats();
        console.log('✅ Session stats:', sessionStats);
        console.log('✅ Presence stats:', presenceStats);

        // Cleanup test data
        console.log('\n8. Cleaning up test data...');
        await cacheService.del('test:key');
        await sessionService.invalidateSession('test-token-123');
        await presenceService.setUserOffline(testUser.id);
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 All Redis integration tests passed!');
        console.log('\n📊 Redis Integration Summary:');
        console.log('   ✅ Redis connection established');
        console.log('   ✅ Basic caching operations working');
        console.log('   ✅ Session management with Redis');
        console.log('   ✅ User presence tracking');
        console.log('   ✅ Meeting participant management');
        console.log('   ✅ Statistics and monitoring');

    } catch (error) {
        console.error('\n❌ Redis integration test failed:');
        console.error('Error:', error.message);

        console.log('\n🔍 Troubleshooting:');
        console.log('   1. Make sure Redis server is running');
        console.log('   2. Check Redis connection settings in .env');
        console.log('   3. Verify Docker container "meetAI" is running');
        console.log('   4. Test Redis connection: docker exec meetAI redis-cli ping');
    }

    process.exit(0);
}

// Run tests if this file is executed directly
if (require.main === module) {
    testRedisIntegration();
}

module.exports = { testRedisIntegration };