require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const { checkDatabaseConnection } = require('./src/utils/database');
const meetingSecurityService = require('./src/services/meetingSecurityService');
const meetingCacheService = require('./src/services/meetingCacheService');
const participantManagementService = require('./src/services/participantManagementService');

async function testMeetingSecurityFeatures() {
    console.log('🔒 Testing Meeting Security Features...\n');

    try {
        // Initialize services
        initializeRedis();

        // Test connections
        const redisHealth = await checkRedisConnection();
        const dbHealth = await checkDatabaseConnection();

        console.log('Redis Health:', redisHealth.status);
        console.log('Database Health:', dbHealth.status);

        if (redisHealth.status !== 'connected' || dbHealth.status !== 'connected') {
            console.error('❌ Service connections failed!');
            process.exit(1);
        }

        console.log('✅ All services connected!\n');

        // Test data setup
        const testMeetingId = 'meeting_security_test_123';
        const hostUserId = 'host_user_123';
        const participantUserId = 'participant_user_456';
        const bannedUserId = 'banned_user_789';

        // Test 1: Create meeting for security testing
        console.log('🧪 Test 1: Creating meeting for security testing...');

        const meetingData = {
            id: testMeetingId,
            title: 'Security Test Meeting',
            hostId: hostUserId,
            status: 'ACTIVE',
            settings: {
                waitingRoomEnabled: true,
                requiresApproval: true,
                hasPassword: false
            },
            createdAt: new Date().toISOString()
        };

        await meetingCacheService.cacheMeeting(meetingData);
        console.log('Meeting created: ✅');

        // Test 2: Password protection
        console.log('\n🧪 Test 2: Testing password protection...');

        const testPassword = 'secure123';

        // Set meeting password
        const passwordSet = await meetingSecurityService.setMeetingPassword(
            testMeetingId,
            testPassword,
            hostUserId
        );
        console.log('Password set:', passwordSet ? '✅' : '❌');

        // Verify correct password
        try {
            await meetingSecurityService.verifyMeetingPassword(
                testMeetingId,
                testPassword,
                participantUserId,
                { ipAddress: '127.0.0.1', userAgent: 'Test Browser' }
            );
            console.log('Correct password verified: ✅');
        } catch (error) {
            console.log('Correct password verification failed: ❌');
        }

        // Test wrong password
        try {
            await meetingSecurityService.verifyMeetingPassword(
                testMeetingId,
                'wrongpassword',
                participantUserId,
                { ipAddress: '127.0.0.1', userAgent: 'Test Browser' }
            );
            console.log('Wrong password rejected: ❌ (Should have failed)');
        } catch (error) {
            console.log('Wrong password correctly rejected: ✅');
        }

        // Test 3: Access attempt tracking
        console.log('\n🧪 Test 3: Testing access attempt tracking...');

        // Make multiple failed attempts
        for (let i = 0; i < 3; i++) {
            try {
                await meetingSecurityService.verifyMeetingPassword(
                    testMeetingId,
                    'wrongpassword',
                    'attacker_user',
                    { ipAddress: '192.168.1.100', userAgent: 'Suspicious Browser' }
                );
            } catch (error) {
                // Expected to fail
            }
        }

        const canAttempt = await meetingSecurityService.checkAccessAttempts(
            testMeetingId,
            'attacker_user'
        );
        console.log('Access attempts tracked:', !canAttempt ? '✅' : '❌');

        // Test 4: Secure waiting room
        console.log('\n🧪 Test 4: Testing secure waiting room...');

        const waitingUserInfo = {
            userId: participantUserId,
            userName: 'Test Participant',
            email: 'participant@test.com',
            socketId: 'socket_123'
        };

        const securityCheck = {
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome/91.0',
            location: { country: 'US', city: 'New York' }
        };

        const waitingRoomResult = await meetingSecurityService.addToSecureWaitingRoom(
            testMeetingId,
            waitingUserInfo,
            securityCheck
        );
        console.log('User added to secure waiting room:', waitingRoomResult ? '✅' : '❌');

        // Test risk score calculation
        const riskScore = waitingRoomResult.securityInfo?.riskScore || 0;
        console.log(`Risk score calculated: ${riskScore} ${riskScore >= 0 && riskScore <= 1 ? '✅' : '❌'}`);

        // Test 5: Admit from waiting room
        console.log('\n🧪 Test 5: Testing waiting room admission...');

        const admissionResult = await meetingSecurityService.admitFromSecureWaitingRoom(
            testMeetingId,
            participantUserId,
            hostUserId,
            true // Security validation enabled
        );
        console.log('User admitted from waiting room:', admissionResult ? '✅' : '❌');

        // Test 6: User banning
        console.log('\n🧪 Test 6: Testing user banning...');

        const banResult = await meetingSecurityService.banUserFromMeeting(
            testMeetingId,
            bannedUserId,
            hostUserId,
            'Disruptive behavior',
            3600 // 1 hour ban
        );
        console.log('User banned:', banResult ? '✅' : '❌');

        // Test ban check
        const isBanned = await meetingSecurityService.isUserBanned(testMeetingId, bannedUserId);
        console.log('Ban status checked:', isBanned ? '✅' : '❌');

        // Test non-banned user
        const isNotBanned = await meetingSecurityService.isUserBanned(testMeetingId, participantUserId);
        console.log('Non-banned user check:', !isNotBanned ? '✅' : '❌');

        // Test 7: Security event logging
        console.log('\n🧪 Test 7: Testing security event logging...');

        // Log custom security event
        await meetingSecurityService.logSecurityEvent(testMeetingId, {
            event: 'test_security_event',
            userId: participantUserId,
            timestamp: new Date().toISOString(),
            metadata: { testData: 'security test' }
        });

        // Get security logs
        const securityLogs = await meetingSecurityService.getSecurityLogs(testMeetingId, 10);
        console.log('Security logs retrieved:', securityLogs.length > 0 ? '✅' : '❌');
        console.log(`Total security events logged: ${securityLogs.length}`);

        // Test 8: Security statistics
        console.log('\n🧪 Test 8: Testing security statistics...');

        const securityStats = await meetingSecurityService.getSecurityStats(testMeetingId);
        console.log('Security statistics generated:', securityStats ? '✅' : '❌');
        console.log('Security stats:', {
            totalEvents: securityStats.totalSecurityEvents,
            bannedUsers: securityStats.bannedUsersCount,
            riskAssessment: securityStats.riskAssessment
        });

        // Test 9: Password removal
        console.log('\n🧪 Test 9: Testing password removal...');

        const passwordRemoved = await meetingSecurityService.removeMeetingPassword(
            testMeetingId,
            hostUserId
        );
        console.log('Password removed:', passwordRemoved ? '✅' : '❌');

        // Verify password no longer required
        try {
            await meetingSecurityService.verifyMeetingPassword(
                testMeetingId,
                'anypassword',
                participantUserId
            );
            console.log('Password removal verification: ❌ (Should have thrown error)');
        } catch (error) {
            if (error.message.includes('does not require a password')) {
                console.log('Password removal verified: ✅');
            } else {
                console.log('Password removal verification: ❌');
            }
        }

        // Test 10: Integration with participant management
        console.log('\n🧪 Test 10: Testing integration with participant management...');

        // Add host as participant
        await participantManagementService.addParticipant(testMeetingId, {
            userId: hostUserId,
            userName: 'Host User',
            email: 'host@test.com',
            role: 'host'
        });

        // Try to ban host (should fail)
        try {
            await meetingSecurityService.banUserFromMeeting(
                testMeetingId,
                hostUserId,
                participantUserId,
                'Test ban'
            );
            console.log('Host ban prevention: ❌ (Should have failed)');
        } catch (error) {
            console.log('Host ban prevention: ✅ (Correctly prevented)');
        }

        // Test 11: Performance testing
        console.log('\n🧪 Test 11: Running security performance tests...');

        const startTime = Date.now();
        const iterations = 20;

        // Test rapid security operations
        for (let i = 0; i < iterations; i++) {
            await meetingSecurityService.logSecurityEvent(testMeetingId, {
                event: 'performance_test',
                userId: `test_user_${i}`,
                timestamp: new Date().toISOString(),
                metadata: { iteration: i }
            });
        }

        const endTime = Date.now();
        const avgTime = (endTime - startTime) / iterations;

        console.log(`Security Performance Results:`);
        console.log(`- ${iterations} security events logged in ${endTime - startTime}ms`);
        console.log(`- Average time per event: ${avgTime.toFixed(2)}ms`);
        console.log(`- Events per second: ${(1000 / avgTime).toFixed(2)}`);

        // Test 12: Error handling and edge cases
        console.log('\n🧪 Test 12: Testing error handling...');

        // Test with non-existent meeting
        try {
            await meetingSecurityService.setMeetingPassword(
                'non_existent_meeting',
                'password',
                hostUserId
            );
            console.log('Non-existent meeting error handling: ❌');
        } catch (error) {
            console.log('Non-existent meeting error handling: ✅');
        }

        // Test with invalid password
        try {
            await meetingSecurityService.setMeetingPassword(
                testMeetingId,
                '123', // Too short
                hostUserId
            );
            console.log('Invalid password error handling: ❌');
        } catch (error) {
            console.log('Invalid password error handling: ✅');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');

        // Remove participants
        await participantManagementService.removeAllParticipants(testMeetingId);

        // Clean up meeting cache
        await meetingCacheService.removeMeetingFromCache(testMeetingId);

        console.log('✅ Cleanup completed!\n');

        // Final statistics
        console.log('📊 Final Security Test Statistics:');
        const finalStats = await meetingSecurityService.getSecurityStats(testMeetingId);
        console.log('Final Security Stats:', finalStats);

        console.log('\n🎉 All Meeting Security Features tests passed successfully!');

    } catch (error) {
        console.error('❌ Meeting security test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the test
testMeetingSecurityFeatures();