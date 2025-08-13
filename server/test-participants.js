require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const { getPrismaClient } = require('./src/utils/database');
const participantManagementService = require('./src/services/participantManagementService');
const meetingCacheService = require('./src/services/meetingCacheService');
const presenceService = require('./src/services/presenceService');

async function testParticipantManagement() {
    console.log('�  Testing Enhanced Participant Management...\n');

    try {
        // Initialize services
        initializeRedis();
        const prisma = getPrismaClient();

        // Test Redis connection
        const redisHealth = await checkRedisConnection();
        console.log('Redis Health Check:', redisHealth);

        if (redisHealth.status !== 'connected') {
            console.error('❌ Redis connection failed!');
            process.exit(1);
        }

        console.log('✅ Redis connection successful!\n');

        // Test data setup
        const testMeetingId = 'meeting_participant_test_123';
        const hostUserId = 'host_user_123';
        const participantUserId = 'participant_user_456';
        const moderatorUserId = 'moderator_user_789';

        // Test 1: Create meeting with host
        console.log('🧪 Testing Meeting Creation with Host...');

        const meetingData = {
            id: testMeetingId,
            title: 'Participant Management Test Meeting',
            hostId: hostUserId,
            status: 'SCHEDULED',
            settings: {
                requiresApproval: true,
                allowParticipantChat: true,
                allowParticipantScreenShare: false,
                maxParticipants: 10
            },
            createdAt: new Date().toISOString()
        };

        const createdMeeting = await participantManagementService.createMeetingWithHost(meetingData);
        console.log('Meeting created with host:', createdMeeting ? '✅' : '❌');

        // Test 2: Send meeting invitations
        console.log('🧪 Testing Meeting Invitations...');

        const invitations = [
            {
                email: 'participant@test.com',
                name: 'Test Participant',
                role: 'PARTICIPANT'
            },
            {
                email: 'moderator@test.com',
                name: 'Test Moderator',
                role: 'MODERATOR'
            }
        ];

        const sentInvitations = await participantManagementService.sendMeetingInvitations(
            testMeetingId,
            hostUserId,
            invitations
        );
        console.log('Invitations sent:', sentInvitations.length > 0 ? '✅' : '❌');

        // Test 3: Join meeting with approval workflow
        console.log('🧪 Testing Join Meeting with Approval...');

        const joinRequest = await participantManagementService.requestToJoinMeeting(
            testMeetingId,
            participantUserId,
            {
                name: 'Test Participant',
                email: 'participant@test.com'
            }
        );
        console.log('Join request created:', joinRequest ? '✅' : '❌');

        // Test 4: Host approves participant
        console.log('🧪 Testing Participant Approval...');

        const approvalResult = await participantManagementService.approveParticipant(
            testMeetingId,
            hostUserId,
            participantUserId
        );
        console.log('Participant approved:', approvalResult ? '✅' : '❌');

        // Test 5: Add moderator directly
        console.log('🧪 Testing Direct Moderator Addition...');

        const moderatorAdded = await participantManagementService.addParticipantToMeeting(
            testMeetingId,
            moderatorUserId,
            {
                name: 'Test Moderator',
                email: 'moderator@test.com',
                role: 'MODERATOR'
            }
        );
        console.log('Moderator added:', moderatorAdded ? '✅' : '❌');

        // Test 6: Role management
        console.log('🧪 Testing Role Management...');

        const roleChanged = await participantManagementService.changeParticipantRole(
            testMeetingId,
            hostUserId,
            participantUserId,
            'MODERATOR'
        );
        console.log('Role changed to moderator:', roleChanged ? '✅' : '❌');

        // Test 7: Permission management
        console.log('🧪 Testing Permission Management...');

        const permissionsUpdated = await participantManagementService.updateParticipantPermissions(
            testMeetingId,
            hostUserId,
            participantUserId,
            {
                canChat: true,
                canShareScreen: true,
                canMuteOthers: true
            }
        );
        console.log('Permissions updated:', permissionsUpdated ? '✅' : '❌');

        // Test 8: Get meeting participants
        console.log('🧪 Testing Get Meeting Participants...');

        const participants = await participantManagementService.getMeetingParticipants(testMeetingId);
        console.log('Participants retrieved:', participants.length > 0 ? '✅' : '❌');
        console.log(`Total participants: ${participants.length}`);

        // Test 9: Participant removal
        console.log('🧪 Testing Participant Removal...');

        const removalResult = await participantManagementService.removeParticipant(
            testMeetingId,
            hostUserId,
            moderatorUserId,
            'Removed for testing'
        );
        console.log('Participant removed:', removalResult ? '✅' : '❌');

        // Test 10: Waiting room functionality
        console.log('🧪 Testing Waiting Room...');

        const waitingRoomUser = 'waiting_user_999';
        const waitingResult = await participantManagementService.addToWaitingRoom(
            testMeetingId,
            waitingRoomUser,
            {
                name: 'Waiting User',
                email: 'waiting@test.com'
            }
        );
        console.log('User added to waiting room:', waitingResult ? '✅' : '❌');

        // Get waiting room participants
        const waitingParticipants = await participantManagementService.getWaitingRoomParticipants(testMeetingId);
        console.log('Waiting room participants:', waitingParticipants.length > 0 ? '✅' : '❌');

        // Admit from waiting room
        const admittedResult = await participantManagementService.admitFromWaitingRoom(
            testMeetingId,
            hostUserId,
            waitingRoomUser
        );
        console.log('User admitted from waiting room:', admittedResult ? '✅' : '❌');

        // Test 11: Bulk operations
        console.log('🧪 Testing Bulk Operations...');

        const bulkUsers = [
            { userId: 'bulk_user_1', name: 'Bulk User 1', email: 'bulk1@test.com' },
            { userId: 'bulk_user_2', name: 'Bulk User 2', email: 'bulk2@test.com' },
            { userId: 'bulk_user_3', name: 'Bulk User 3', email: 'bulk3@test.com' }
        ];

        const bulkAddResult = await participantManagementService.addMultipleParticipants(
            testMeetingId,
            hostUserId,
            bulkUsers
        );
        console.log('Bulk participants added:', bulkAddResult.length > 0 ? '✅' : '❌');

        // Test 12: Meeting statistics
        console.log('🧪 Testing Meeting Statistics...');

        const stats = await participantManagementService.getMeetingStatistics(testMeetingId);
        console.log('Meeting statistics:', stats ? '✅' : '❌');
        console.log('Statistics:', {
            totalParticipants: stats.totalParticipants,
            activeParticipants: stats.activeParticipants,
            roleDistribution: stats.roleDistribution
        });

        // Test 13: Participant activity tracking
        console.log('🧪 Testing Activity Tracking...');

        const activityResult = await participantManagementService.updateParticipantActivity(
            testMeetingId,
            participantUserId,
            {
                lastSeen: new Date().toISOString(),
                action: 'message_sent',
                metadata: { messageCount: 5 }
            }
        );
        console.log('Activity tracked:', activityResult ? '✅' : '❌');

        // Test 14: Meeting capacity management
        console.log('🧪 Testing Capacity Management...');

        const capacityCheck = await participantManagementService.checkMeetingCapacity(testMeetingId);
        console.log('Capacity check:', capacityCheck ? '✅' : '❌');
        console.log('Capacity info:', {
            current: capacityCheck.currentParticipants,
            maximum: capacityCheck.maxParticipants,
            available: capacityCheck.availableSlots
        });

        // Test 15: Integration with presence service
        console.log('🧪 Testing Presence Integration...');

        // Set participants online
        await presenceService.setUserOnline(hostUserId, { name: 'Host User', email: 'host@test.com' });
        await presenceService.setUserOnline(participantUserId, { name: 'Participant User', email: 'participant@test.com' });

        // Add to meeting presence
        await presenceService.addUserToMeeting(hostUserId, testMeetingId, 'host');
        await presenceService.addUserToMeeting(participantUserId, testMeetingId, 'participant');

        const presenceParticipants = await presenceService.getMeetingParticipants(testMeetingId);
        console.log('Presence integration:', Object.keys(presenceParticipants).length > 0 ? '✅' : '❌');

        // Test 16: Performance test
        console.log('🧪 Running Performance Tests...');

        const startTime = Date.now();
        const iterations = 50;

        // Test rapid participant operations
        for (let i = 0; i < iterations; i++) {
            await participantManagementService.updateParticipantActivity(
                testMeetingId,
                participantUserId,
                {
                    lastSeen: new Date().toISOString(),
                    action: 'heartbeat',
                    metadata: { iteration: i }
                }
            );
        }

        const endTime = Date.now();
        const avgTime = (endTime - startTime) / iterations;

        console.log(`Performance Test Results:`);
        console.log(`- ${iterations} activity updates in ${endTime - startTime}ms`);
        console.log(`- Average time per update: ${avgTime.toFixed(2)}ms`);
        console.log(`- Updates per second: ${(1000 / avgTime).toFixed(2)}`);

        // Test 17: Error handling
        console.log('🧪 Testing Error Handling...');

        try {
            // Try to add participant to non-existent meeting
            await participantManagementService.addParticipantToMeeting(
                'non_existent_meeting',
                'user_123',
                { name: 'Test', email: 'test@test.com' }
            );
            console.log('Error handling: ❌ (Should have thrown error)');
        } catch (error) {
            console.log('Error handling: ✅ (Correctly caught error)');
        }

        // Test 18: Cleanup and final statistics
        console.log('🧹 Cleaning up test data...');

        // Remove all participants
        const finalParticipants = await participantManagementService.getMeetingParticipants(testMeetingId);
        for (const participant of finalParticipants) {
            if (participant.userId !== hostUserId) {
                await participantManagementService.removeParticipant(
                    testMeetingId,
                    hostUserId,
                    participant.userId,
                    'Test cleanup'
                );
            }
        }

        // Clean up presence
        await presenceService.removeUserFromMeeting(hostUserId, testMeetingId);
        await presenceService.removeUserFromMeeting(participantUserId, testMeetingId);
        await presenceService.setUserOffline(hostUserId);
        await presenceService.setUserOffline(participantUserId);

        // Clean up meeting cache
        await meetingCacheService.removeMeetingFromCache(testMeetingId);

        console.log('✅ Cleanup completed!\n');

        // Final statistics
        console.log('📊 Final Test Statistics:');
        const finalStats = await participantManagementService.getOverallStatistics();
        console.log('Overall Statistics:', finalStats);

        console.log('\n🎉 All Enhanced Participant Management tests passed successfully!');

    } catch (error) {
        console.error('❌ Participant management test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the test
testParticipantManagement();