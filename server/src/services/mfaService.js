import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPrismaClient } from '../utils/database.js';
import { getRedisClient } from '../utils/redis.js';
import cacheService from './cacheService.js';

class MFAService {
    constructor() {
        this.redis = getRedisClient();

        // Configuration
        this.serviceName = process.env.MFA_SERVICE_NAME || 'Video Conferencing Platform';
        this.issuer = process.env.MFA_ISSUER || 'VideoConf';
        this.backupCodeLength = 8;
        this.backupCodeCount = 10;
        this.verificationWindow = 2; // Allow 2 time steps (60 seconds)

        // Cache TTLs
        this.setupTokenTTL = 10 * 60; // 10 minutes
        this.verificationAttemptTTL = 5 * 60; // 5 minutes
        this.backupCodeTTL = 30 * 24 * 60 * 60; // 30 days
    }

    // Generate cache keys
    getMFASetupKey(userId) {
        return `mfa_setup:${userId}`;
    }

    getMFASecretKey(userId) {
        return `mfa_secret:${userId}`;
    }

    getBackupCodesKey(userId) {
        return `backup_codes:${userId}`;
    }

    getVerificationAttemptsKey(userId) {
        return `mfa_attempts:${userId}`;
    }

    getMFAStatusKey(userId) {
        return `mfa_status:${userId}`;
    }

    // Generate MFA secret for user
    async generateMFASecret(userId, userEmail) {
        try {
            const prisma = getPrismaClient();

            // Check if user already has MFA enabled
            const existingMFA = await prisma.userMFA.findUnique({
                where: { userId }
            });

            if (existingMFA && existingMFA.isEnabled) {
                throw new Error('MFA is already enabled for this user');
            }

            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `${this.serviceName} (${userEmail})`,
                issuer: this.issuer,
                length: 32
            });

            // Generate backup codes
            const backupCodes = this.generateBackupCodes();

            // Store setup data temporarily
            const setupData = {
                userId,
                secret: secret.base32,
                qrCodeUrl: secret.otpauth_url,
                backupCodes: backupCodes.map(code => ({
                    code,
                    hashedCode: this.hashBackupCode(code),
                    used: false
                })),
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.setupTokenTTL * 1000).toISOString()
            };

            // Cache setup data
            const setupKey = this.getMFASetupKey(userId);
            await cacheService.set(setupKey, setupData, this.setupTokenTTL);

            // Generate QR code
            const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

            return {
                secret: secret.base32,
                qrCode: qrCodeDataUrl,
                backupCodes: backupCodes,
                setupToken: this.generateSetupToken(userId)
            };

        } catch (error) {
            console.error('Generate MFA secret error:', error);
            throw error;
        }
    }

    // Verify and enable MFA
    async enableMFA(userId, token, setupToken) {
        try {
            const prisma = getPrismaClient();

            // Verify setup token
            if (!this.verifySetupToken(setupToken, userId)) {
                throw new Error('Invalid or expired setup token');
            }

            // Get setup data
            const setupKey = this.getMFASetupKey(userId);
            const setupData = await cacheService.get(setupKey);

            if (!setupData || setupData.userId !== userId) {
                throw new Error('MFA setup data not found or expired');
            }

            // Verify TOTP token
            const verified = speakeasy.totp.verify({
                secret: setupData.secret,
                encoding: 'base32',
                token: token,
                window: this.verificationWindow
            });

            if (!verified) {
                throw new Error('Invalid verification code');
            }

            // Save MFA configuration to database
            await prisma.userMFA.upsert({
                where: { userId },
                update: {
                    secret: setupData.secret,
                    backupCodes: setupData.backupCodes,
                    isEnabled: true,
                    enabledAt: new Date(),
                    lastUsedAt: new Date()
                },
                create: {
                    userId,
                    secret: setupData.secret,
                    backupCodes: setupData.backupCodes,
                    isEnabled: true,
                    enabledAt: new Date(),
                    lastUsedAt: new Date()
                }
            });

            // Cache MFA status
            const statusKey = this.getMFAStatusKey(userId);
            await cacheService.set(statusKey, {
                isEnabled: true,
                enabledAt: new Date().toISOString(),
                hasBackupCodes: true
            }, 24 * 60 * 60); // 24 hours

            // Clean up setup data
            await cacheService.del(setupKey);

            console.log(`MFA enabled for user ${userId}`);
            return {
                enabled: true,
                backupCodesRemaining: setupData.backupCodes.length
            };

        } catch (error) {
            console.error('Enable MFA error:', error);
            throw error;
        }
    }

    // Verify MFA token
    async verifyMFAToken(userId, token, isBackupCode = false) {
        try {
            const prisma = getPrismaClient();

            // Check verification attempts
            const canAttempt = await this.checkVerificationAttempts(userId);
            if (!canAttempt) {
                throw new Error('Too many failed verification attempts. Please try again later.');
            }

            // Get MFA configuration
            let mfaConfig = await this.getMFAConfig(userId);
            if (!mfaConfig || !mfaConfig.isEnabled) {
                throw new Error('MFA is not enabled for this user');
            }

            let verified = false;
            let backupCodeUsed = false;

            if (isBackupCode) {
                // Verify backup code
                const result = await this.verifyBackupCode(userId, token);
                verified = result.verified;
                backupCodeUsed = result.used;
            } else {
                // Verify TOTP token
                verified = speakeasy.totp.verify({
                    secret: mfaConfig.secret,
                    encoding: 'base32',
                    token: token,
                    window: this.verificationWindow
                });
            }

            if (verified) {
                // Reset verification attempts on success
                await this.resetVerificationAttempts(userId);

                // Update last used timestamp
                await prisma.userMFA.update({
                    where: { userId },
                    data: { lastUsedAt: new Date() }
                });

                // Update cache
                const statusKey = this.getMFAStatusKey(userId);
                const status = await cacheService.get(statusKey) || {};
                status.lastUsedAt = new Date().toISOString();
                await cacheService.set(statusKey, status, 24 * 60 * 60);

                return {
                    verified: true,
                    backupCodeUsed,
                    remainingBackupCodes: backupCodeUsed ?
                        await this.getRemainingBackupCodesCount(userId) : null
                };
            } else {
                // Increment failed attempts
                await this.incrementVerificationAttempts(userId);
                throw new Error('Invalid verification code');
            }

        } catch (error) {
            console.error('Verify MFA token error:', error);
            throw error;
        }
    }

    // Disable MFA
    async disableMFA(userId, token, isBackupCode = false) {
        try {
            const prisma = getPrismaClient();

            // Verify current token before disabling
            await this.verifyMFAToken(userId, token, isBackupCode);

            // Disable MFA in database
            await prisma.userMFA.update({
                where: { userId },
                data: {
                    isEnabled: false,
                    disabledAt: new Date(),
                    secret: null,
                    backupCodes: []
                }
            });

            // Update cache
            const statusKey = this.getMFAStatusKey(userId);
            await cacheService.set(statusKey, {
                isEnabled: false,
                disabledAt: new Date().toISOString(),
                hasBackupCodes: false
            }, 24 * 60 * 60);

            // Clean up related cache entries
            await cacheService.del(this.getMFASecretKey(userId));
            await cacheService.del(this.getBackupCodesKey(userId));
            await cacheService.del(this.getVerificationAttemptsKey(userId));

            console.log(`MFA disabled for user ${userId}`);
            return { disabled: true };

        } catch (error) {
            console.error('Disable MFA error:', error);
            throw error;
        }
    }

    // Generate new backup codes
    async generateNewBackupCodes(userId, token, isBackupCode = false) {
        try {
            const prisma = getPrismaClient();

            // Verify current token before generating new codes
            await this.verifyMFAToken(userId, token, isBackupCode);

            // Generate new backup codes
            const newBackupCodes = this.generateBackupCodes();
            const hashedCodes = newBackupCodes.map(code => ({
                code: uuidv4(),
                hashedCode: this.hashBackupCode(code),
                used: false,
                createdAt: new Date().toISOString()
            }));

            // Update database
            await prisma.userMFA.update({
                where: { userId },
                data: {
                    backupCodes: hashedCodes,
                    backupCodesGeneratedAt: new Date()
                }
            });

            // Update cache
            const backupCodesKey = this.getBackupCodesKey(userId);
            await cacheService.set(backupCodesKey, hashedCodes, this.backupCodeTTL);

            console.log(`New backup codes generated for user ${userId}`);
            return {
                backupCodes: newBackupCodes,
                count: newBackupCodes.length
            };

        } catch (error) {
            console.error('Generate new backup codes error:', error);
            throw error;
        }
    }

    // Get MFA status for user
    async getMFAStatus(userId) {
        try {
            // Try cache first
            const statusKey = this.getMFAStatusKey(userId);
            let status = await cacheService.get(statusKey);

            if (!status) {
                // Fallback to database
                const prisma = getPrismaClient();
                const mfaConfig = await prisma.userMFA.findUnique({
                    where: { userId }
                });

                if (mfaConfig) {
                    status = {
                        isEnabled: mfaConfig.isEnabled,
                        enabledAt: mfaConfig.enabledAt?.toISOString(),
                        lastUsedAt: mfaConfig.lastUsedAt?.toISOString(),
                        hasBackupCodes: mfaConfig.backupCodes?.length > 0,
                        remainingBackupCodes: mfaConfig.backupCodes?.filter(code => !code.used).length || 0
                    };

                    // Cache for future requests
                    await cacheService.set(statusKey, status, 24 * 60 * 60);
                } else {
                    status = {
                        isEnabled: false,
                        hasBackupCodes: false,
                        remainingBackupCodes: 0
                    };
                }
            }

            return status;

        } catch (error) {
            console.error('Get MFA status error:', error);
            return {
                isEnabled: false,
                hasBackupCodes: false,
                remainingBackupCodes: 0
            };
        }
    }

    // Helper methods
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < this.backupCodeCount; i++) {
            codes.push(this.generateBackupCode());
        }
        return codes;
    }

    generateBackupCode() {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < this.backupCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    hashBackupCode(code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }

    generateSetupToken(userId) {
        const payload = {
            userId,
            type: 'mfa_setup',
            timestamp: Date.now()
        };
        return Buffer.from(JSON.stringify(payload)).toString('base64');
    }

    verifySetupToken(token, userId) {
        try {
            const payload = JSON.parse(Buffer.from(token, 'base64').toString());
            return payload.userId === userId &&
                payload.type === 'mfa_setup' &&
                (Date.now() - payload.timestamp) < (this.setupTokenTTL * 1000);
        } catch (error) {
            return false;
        }
    }

    async getMFAConfig(userId) {
        try {
            const prisma = getPrismaClient();
            return await prisma.userMFA.findUnique({
                where: { userId }
            });
        } catch (error) {
            console.error('Get MFA config error:', error);
            return null;
        }
    }

    async verifyBackupCode(userId, code) {
        try {
            const prisma = getPrismaClient();
            const hashedCode = this.hashBackupCode(code);

            const mfaConfig = await prisma.userMFA.findUnique({
                where: { userId }
            });

            if (!mfaConfig || !mfaConfig.backupCodes) {
                return { verified: false, used: false };
            }

            // Find matching backup code
            const backupCodeIndex = mfaConfig.backupCodes.findIndex(
                bc => bc.hashedCode === hashedCode && !bc.used
            );

            if (backupCodeIndex === -1) {
                return { verified: false, used: false };
            }

            // Mark backup code as used
            const updatedBackupCodes = [...mfaConfig.backupCodes];
            updatedBackupCodes[backupCodeIndex].used = true;
            updatedBackupCodes[backupCodeIndex].usedAt = new Date().toISOString();

            await prisma.userMFA.update({
                where: { userId },
                data: { backupCodes: updatedBackupCodes }
            });

            return { verified: true, used: true };

        } catch (error) {
            console.error('Verify backup code error:', error);
            return { verified: false, used: false };
        }
    }

    async getRemainingBackupCodesCount(userId) {
        try {
            const mfaConfig = await this.getMFAConfig(userId);
            if (!mfaConfig || !mfaConfig.backupCodes) {
                return 0;
            }

            return mfaConfig.backupCodes.filter(code => !code.used).length;

        } catch (error) {
            console.error('Get remaining backup codes count error:', error);
            return 0;
        }
    }

    async checkVerificationAttempts(userId) {
        try {
            const attemptsKey = this.getVerificationAttemptsKey(userId);
            const attempts = await cacheService.get(attemptsKey) || 0;
            return attempts < 5; // Max 5 attempts
        } catch (error) {
            return true; // Allow on error
        }
    }

    async incrementVerificationAttempts(userId) {
        try {
            const attemptsKey = this.getVerificationAttemptsKey(userId);
            const attempts = await cacheService.get(attemptsKey) || 0;
            await cacheService.set(attemptsKey, attempts + 1, this.verificationAttemptTTL);
        } catch (error) {
            console.error('Increment verification attempts error:', error);
        }
    }

    async resetVerificationAttempts(userId) {
        try {
            const attemptsKey = this.getVerificationAttemptsKey(userId);
            await cacheService.del(attemptsKey);
        } catch (error) {
            console.error('Reset verification attempts error:', error);
        }
    }

    // Get MFA statistics
    async getMFAStatistics() {
        try {
            const prisma = getPrismaClient();

            const stats = await prisma.userMFA.aggregate({
                _count: {
                    userId: true
                },
                where: {
                    isEnabled: true
                }
            });

            const totalUsers = await prisma.user.count();
            const mfaEnabledUsers = stats._count.userId || 0;

            return {
                totalUsers,
                mfaEnabledUsers,
                mfaAdoptionRate: totalUsers > 0 ? ((mfaEnabledUsers / totalUsers) * 100).toFixed(2) : '0',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Get MFA statistics error:', error);
            return {
                totalUsers: 0,
                mfaEnabledUsers: 0,
                mfaAdoptionRate: '0',
                timestamp: new Date().toISOString()
            };
        }
    }
}

export default new MFAService();