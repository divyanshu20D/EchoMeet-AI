import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import {
    validateMFASetup,
    ensureMFAEnabled,
    createMFARateLimit,
    checkMFAStatus
} from '../middleware/mfaMiddleware.js';
import mfaService from '../services/mfaService.js';

const router = express.Router();

// Rate limiting for MFA operations
const mfaRateLimit = createMFARateLimit(10, 15 * 60 * 1000); // 10 attempts per 15 minutes

// Validation schemas
const enableMFASchema = z.object({
    token: z.string().length(6, 'Token must be exactly 6 digits'),
    setupToken: z.string().min(1, 'Setup token is required')
});

const verifyMFASchema = z.object({
    token: z.string().min(6, 'Token must be at least 6 characters').max(8, 'Token too long'),
    isBackupCode: z.boolean().optional().default(false)
});

const disableMFASchema = z.object({
    token: z.string().min(6, 'Token must be at least 6 characters').max(8, 'Token too long'),
    isBackupCode: z.boolean().optional().default(false),
    confirmDisable: z.boolean().refine(val => val === true, 'Must confirm MFA disable')
});

// Setup MFA - Generate secret and QR code
router.post('/setup',
    authenticateToken,
    validateMFASetup,
    mfaRateLimit,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const userEmail = req.user.email;

            const setupData = await mfaService.generateMFASecret(userId, userEmail);

            res.json({
                success: true,
                message: 'MFA setup initiated. Scan the QR code with your authenticator app.',
                data: {
                    qrCode: setupData.qrCode,
                    backupCodes: setupData.backupCodes,
                    setupToken: setupData.setupToken,
                    instructions: {
                        step1: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
                        step2: 'Enter the 6-digit code from your app to complete setup',
                        step3: 'Save your backup codes in a secure location'
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('MFA setup API error:', error);
            res.status(500).json({
                error: {
                    code: 'MFA_SETUP_FAILED',
                    message: error.message || 'Failed to setup MFA',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Enable MFA - Verify setup and activate
router.post('/enable',
    authenticateToken,
    mfaRateLimit,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { token, setupToken } = enableMFASchema.parse(req.body);

            const result = await mfaService.enableMFA(userId, token, setupToken);

            res.json({
                success: true,
                message: 'MFA has been successfully enabled for your account.',
                data: {
                    enabled: result.enabled,
                    backupCodesRemaining: result.backupCodesRemaining,
                    warning: 'Please save your backup codes in a secure location. You will need them if you lose access to your authenticator app.'
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Enable MFA API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(400).json({
                error: {
                    code: 'MFA_ENABLE_FAILED',
                    message: error.message || 'Failed to enable MFA',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Verify MFA token
router.post('/verify',
    authenticateToken,
    mfaRateLimit,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { token, isBackupCode } = verifyMFASchema.parse(req.body);

            const result = await mfaService.verifyMFAToken(userId, token, isBackupCode);

            res.json({
                success: true,
                message: 'MFA token verified successfully',
                data: {
                    verified: result.verified,
                    backupCodeUsed: result.backupCodeUsed,
                    remainingBackupCodes: result.remainingBackupCodes
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Verify MFA API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(401).json({
                error: {
                    code: 'MFA_VERIFICATION_FAILED',
                    message: error.message || 'MFA verification failed',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Disable MFA
router.post('/disable',
    authenticateToken,
    ensureMFAEnabled,
    mfaRateLimit,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { token, isBackupCode, confirmDisable } = disableMFASchema.parse(req.body);

            const result = await mfaService.disableMFA(userId, token, isBackupCode);

            res.json({
                success: true,
                message: 'MFA has been disabled for your account.',
                data: {
                    disabled: result.disabled,
                    warning: 'Your account is now less secure. Consider re-enabling MFA for better protection.'
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Disable MFA API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(400).json({
                error: {
                    code: 'MFA_DISABLE_FAILED',
                    message: error.message || 'Failed to disable MFA',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Generate new backup codes
router.post('/backup-codes/regenerate',
    authenticateToken,
    ensureMFAEnabled,
    mfaRateLimit,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { token, isBackupCode } = verifyMFASchema.parse(req.body);

            const result = await mfaService.generateNewBackupCodes(userId, token, isBackupCode);

            res.json({
                success: true,
                message: 'New backup codes generated successfully.',
                data: {
                    backupCodes: result.backupCodes,
                    count: result.count,
                    warning: 'Your old backup codes are no longer valid. Please save these new codes in a secure location.'
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Generate backup codes API error:', error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(400).json({
                error: {
                    code: 'BACKUP_CODES_GENERATION_FAILED',
                    message: error.message || 'Failed to generate new backup codes',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Get MFA status
router.get('/status',
    authenticateToken,
    checkMFAStatus,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const status = await mfaService.getMFAStatus(userId);

            res.json({
                success: true,
                data: {
                    isEnabled: status.isEnabled,
                    enabledAt: status.enabledAt,
                    lastUsedAt: status.lastUsedAt,
                    hasBackupCodes: status.hasBackupCodes,
                    remainingBackupCodes: status.remainingBackupCodes,
                    recommendations: status.isEnabled ?
                        ['Keep your authenticator app secure', 'Store backup codes safely'] :
                        ['Enable MFA for better security', 'Use a trusted authenticator app']
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get MFA status API error:', error);
            res.status(500).json({
                error: {
                    code: 'MFA_STATUS_FAILED',
                    message: 'Failed to get MFA status',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Get MFA statistics (admin only)
router.get('/statistics',
    authenticateToken,
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Admin access required',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const stats = await mfaService.getMFAStatistics();

            res.json({
                success: true,
                data: {
                    ...stats,
                    insights: {
                        adoptionLevel: parseFloat(stats.mfaAdoptionRate) > 50 ? 'Good' :
                            parseFloat(stats.mfaAdoptionRate) > 25 ? 'Fair' : 'Low',
                        recommendation: parseFloat(stats.mfaAdoptionRate) < 50 ?
                            'Consider implementing MFA requirements for sensitive operations' :
                            'Good MFA adoption rate'
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get MFA statistics API error:', error);
            res.status(500).json({
                error: {
                    code: 'MFA_STATISTICS_FAILED',
                    message: 'Failed to get MFA statistics',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
);

// Test MFA endpoint (for development/testing)
if (process.env.NODE_ENV === 'development') {
    router.post('/test-token',
        authenticateToken,
        async (req, res) => {
            try {
                const { secret, token } = req.body;

                if (!secret || !token) {
                    return res.status(400).json({
                        error: {
                            code: 'MISSING_PARAMETERS',
                            message: 'Secret and token are required for testing',
                            timestamp: new Date().toISOString()
                        }
                    });
                }

                const speakeasy = require('speakeasy');
                const verified = speakeasy.totp.verify({
                    secret: secret,
                    encoding: 'base32',
                    token: token,
                    window: 2
                });

                res.json({
                    success: true,
                    data: {
                        verified,
                        message: verified ? 'Token is valid' : 'Token is invalid'
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                res.status(500).json({
                    error: {
                        code: 'TEST_TOKEN_FAILED',
                        message: error.message,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }
    );
}

export default router;