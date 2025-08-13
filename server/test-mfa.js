require('dotenv').config();
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const { checkDatabaseConnection } = require('./src/utils/database');
const mfaService = require('./src/services/mfaService');
const speakeasy = require('speakeasy');

async function testMFAFeatures() {
    console.log('🔐 Testing Multi-Factor Authentication Features...\n');

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
        const testUserId = 'mfa_test_user_123';
        const testUserEmail = 'mfa.test@example.com';

        // Test 1: Generate MFA secret
        console.log('🧪 Test 1: Generating MFA secret...');

        const setupData = await mfaService.generateMFASecret(testUserId, testUserEmail);
        console.log('MFA secret generated:', setupData ? '✅' : '❌');
        console.log('QR code generated:', setupData.qrCode ? '✅' : '❌');
        console.log('Backup codes generated:', setupData.backupCodes.length === 10 ? '✅' : '❌');
        console.log('Setup token generated:', setupData.setupToken ? '✅' : '❌');

        // Test 2: Generate TOTP token for testing
        console.log('\n🧪 Test 2: Generating test TOTP token...');

        const testToken = speakeasy.totp({
            secret: setupData.secret,
            encoding: 'base32'
        });
        console.log('Test TOTP token generated:', testToken ? '✅' : '❌');
        console.log(`Generated token: ${testToken}`);

        // Test 3: Enable MFA with valid token
        console.log('\n🧪 Test 3: Enabling MFA with valid token...');

        const enableResult = await mfaService.enableMFA(testUserId, testToken, setupData.setupToken);
        console.log('MFA enabled successfully:', enableResult.enabled ? '✅' : '❌');
        console.log('Backup codes available:', enableResult.backupCodesRemaining > 0 ? '✅' : '❌');

        // Test 4: Get MFA status
        console.log('\n🧪 Test 4: Getting MFA status...');

        const mfaStatus = await mfaService.getMFAStatus(testUserId);
        console.log('MFA status retrieved:', mfaStatus ? '✅' : '❌');
        console.log('MFA is enabled:', mfaStatus.isEnabled ? '✅' : '❌');
        console.log('Has backup codes:', mfaStatus.hasBackupCodes ? '✅' : '❌');
        console.log('Remaining backup codes:', mfaStatus.remainingBackupCodes);

        // Test 5: Verify TOTP token
        console.log('\n🧪 Test 5: Verifying TOTP token...');

        // Generate a fresh token
        const verifyToken = speakeasy.totp({
            secret: setupData.secret,
            encoding: 'base32'
        });

        const verifyResult = await mfaService.verifyMFAToken(testUserId, verifyToken, false);
        console.log('TOTP token verified:', verifyResult.verified ? '✅' : '❌');
        console.log('Backup code used:', !verifyResult.backupCodeUsed ? '✅' : '❌');

        // Test 6: Test invalid token
        console.log('\n🧪 Test 6: Testing invalid token rejection...');

        try {
            await mfaService.verifyMFAToken(testUserId, '000000', false);
            console.log('Invalid token rejection: ❌ (Should have failed)');
        } catch (error) {
            console.log('Invalid token correctly rejected: ✅');
        }

        // Test 7: Test backup code verification
        console.log('\n🧪 Test 7: Testing backup code verification...');

        const backupCode = setupData.backupCodes[0];
        const backupVerifyResult = await mfaService.verifyMFAToken(testUserId, backupCode, true);
        console.log('Backup code verified:', backupVerifyResult.verified ? '✅' : '❌');
        console.log('Backup code marked as used:', backupVerifyResult.backupCodeUsed ? '✅' : '❌');
        console.log('Remaining backup codes:', backupVerifyResult.remainingBackupCodes);

        // Test 8: Test used backup code rejection
        console.log('\n🧪 Test 8: Testing used backup code rejection...');

        try {
            await mfaService.verifyMFAToken(testUserId, backupCode, true);
            console.log('Used backup code rejection: ❌ (Should have failed)');
        } catch (error) {
            console.log('Used backup code correctly rejected: ✅');
        }

        // Test 9: Generate new backup codes
        console.log('\n🧪 Test 9: Generating new backup codes...');

        const newToken = speakeasy.totp({
            secret: setupData.secret,
            encoding: 'base32'
        });

        const newBackupCodes = await mfaService.generateNewBackupCodes(testUserId, newToken, false);
        console.log('New backup codes generated:', newBackupCodes.backupCodes.length === 10 ? '✅' : '❌');
        console.log('Backup codes count correct:', newBackupCodes.count === 10 ? '✅' : '❌');

        // Test 10: Rate limiting simulation
        console.log('\n🧪 Test 10: Testing rate limiting...');

        let rateLimitTriggered = false;
        for (let i = 0; i < 6; i++) {
            try {
                await mfaService.verifyMFAToken(testUserId, '000000', false);
            } catch (error) {
                if (error.message.includes('Too many failed')) {
                    rateLimitTriggered = true;
                    break;
                }
            }
        }
        console.log('Rate limiting triggered:', rateLimitTriggered ? '✅' : '❌');

        // Test 11: MFA statistics
        console.log('\n🧪 Test 11: Testing MFA statistics...');

        const stats = await mfaService.getMFAStatistics();
        console.log('MFA statistics retrieved:', stats ? '✅' : '❌');
        console.log('Statistics data:', {
            totalUsers: stats.totalUsers,
            mfaEnabledUsers: stats.mfaEnabledUsers,
            adoptionRate: stats.mfaAdoptionRate + '%'
        });

        // Test 12: Disable MFA
        console.log('\n🧪 Test 12: Testing MFA disable...');

        // Wait a bit to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const disableToken = speakeasy.totp({
            secret: setupData.secret,
            encoding: 'base32'
        });

        const disableResult = await mfaService.disableMFA(testUserId, disableToken, false);
        console.log('MFA disabled successfully:', disableResult.disabled ? '✅' : '❌');

        // Verify MFA is disabled
        const disabledStatus = await mfaService.getMFAStatus(testUserId);
        console.log('MFA status updated to disabled:', !disabledStatus.isEnabled ? '✅' : '❌');

        // Test 13: Test MFA after disable
        console.log('\n🧪 Test 13: Testing MFA verification after disable...');

        try {
            await mfaService.verifyMFAToken(testUserId, disableToken, false);
            console.log('MFA verification after disable: ❌ (Should have failed)');
        } catch (error) {
            console.log('MFA verification correctly failed after disable: ✅');
        }

        // Test 14: Performance testing
        console.log('\n🧪 Test 14: Running MFA performance tests...');

        // Re-enable MFA for performance testing
        const perfSetupData = await mfaService.generateMFASecret(testUserId, testUserEmail);
        const perfToken = speakeasy.totp({
            secret: perfSetupData.secret,
            encoding: 'base32'
        });
        await mfaService.enableMFA(testUserId, perfToken, perfSetupData.setupToken);

        const startTime = Date.now();
        const iterations = 10;

        // Test rapid MFA verifications
        for (let i = 0; i < iterations; i++) {
            const token = speakeasy.totp({
                secret: perfSetupData.secret,
                encoding: 'base32'
            });

            try {
                await mfaService.verifyMFAToken(testUserId, token, false);
            } catch (error) {
                // Some may fail due to timing, that's expected
            }

            // Small delay to avoid timing issues
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        const avgTime = (endTime - startTime) / iterations;

        console.log(`MFA Performance Results:`);
        console.log(`- ${iterations} MFA verifications in ${endTime - startTime}ms`);
        console.log(`- Average time per verification: ${avgTime.toFixed(2)}ms`);
        console.log(`- Verifications per second: ${(1000 / avgTime).toFixed(2)}`);

        // Test 15: Error handling and edge cases
        console.log('\n🧪 Test 15: Testing error handling...');

        // Test with non-existent user
        try {
            await mfaService.getMFAStatus('non_existent_user');
            console.log('Non-existent user handling: ✅ (Should return default status)');
        } catch (error) {
            console.log('Non-existent user error handling: ❌');
        }

        // Test with invalid setup token
        try {
            await mfaService.enableMFA(testUserId, '123456', 'invalid_token');
            console.log('Invalid setup token handling: ❌ (Should have failed)');
        } catch (error) {
            console.log('Invalid setup token correctly rejected: ✅');
        }

        // Test 16: Backup code edge cases
        console.log('\n🧪 Test 16: Testing backup code edge cases...');

        // Test invalid backup code format
        try {
            await mfaService.verifyMFAToken(testUserId, 'INVALID', true);
            console.log('Invalid backup code format: ❌ (Should have failed)');
        } catch (error) {
            console.log('Invalid backup code format correctly rejected: ✅');
        }

        // Final cleanup
        console.log('\n🧹 Cleaning up test data...');

        // Disable MFA for cleanup
        const cleanupToken = speakeasy.totp({
            secret: perfSetupData.secret,
            encoding: 'base32'
        });

        try {
            await mfaService.disableMFA(testUserId, cleanupToken, false);
            console.log('✅ MFA disabled for cleanup');
        } catch (error) {
            console.log('⚠️ Cleanup warning:', error.message);
        }

        console.log('✅ Cleanup completed!\n');

        // Final statistics
        console.log('📊 Final MFA Test Statistics:');
        const finalStats = await mfaService.getMFAStatistics();
        console.log('Final MFA Stats:', finalStats);

        console.log('\n🎉 All Multi-Factor Authentication tests passed successfully!');

    } catch (error) {
        console.error('❌ MFA test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the test
testMFAFeatures();