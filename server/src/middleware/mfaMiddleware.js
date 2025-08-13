import mfaService from '../services/mfaService.js';
import { z } from 'zod';

// Validation schemas
const mfaTokenSchema = z.object({
    token: z.string().min(6, 'Token must be at least 6 characters').max(8, 'Token too long'),
    isBackupCode: z.boolean().optional()
});

// Middleware to require MFA verification
async function requireMFA(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check if user has MFA enabled
        const mfaStatus = await mfaService.getMFAStatus(userId);

        if (!mfaStatus.isEnabled) {
            return res.status(403).json({
                error: {
                    code: 'MFA_REQUIRED',
                    message: 'Multi-factor authentication is required for this action',
                    mfaSetupRequired: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check if MFA token was provided
        const { token, isBackupCode } = req.body;

        if (!token) {
            return res.status(401).json({
                error: {
                    code: 'MFA_TOKEN_REQUIRED',
                    message: 'MFA verification token is required',
                    mfaRequired: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate token format
        try {
            mfaTokenSchema.parse({ token, isBackupCode });
        } catch (validationError) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_TOKEN_FORMAT',
                    message: 'Invalid MFA token format',
                    details: validationError.errors,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify MFA token
        try {
            const verificationResult = await mfaService.verifyMFAToken(userId, token, isBackupCode);

            if (!verificationResult.verified) {
                return res.status(401).json({
                    error: {
                        code: 'INVALID_MFA_TOKEN',
                        message: 'Invalid MFA verification token',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Add MFA verification info to request
            req.mfaVerified = true;
            req.mfaVerification = verificationResult;

            next();

        } catch (error) {
            return res.status(401).json({
                error: {
                    code: 'MFA_VERIFICATION_FAILED',
                    message: error.message || 'MFA verification failed',
                    timestamp: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('MFA middleware error:', error);
        res.status(500).json({
            error: {
                code: 'MFA_MIDDLEWARE_ERROR',
                message: 'MFA verification system error',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Middleware to check if MFA is enabled (but not require verification)
async function checkMFAStatus(req, res, next) {
    try {
        const userId = req.user?.id;

        if (userId) {
            const mfaStatus = await mfaService.getMFAStatus(userId);
            req.mfaStatus = mfaStatus;
        } else {
            req.mfaStatus = {
                isEnabled: false,
                hasBackupCodes: false,
                remainingBackupCodes: 0
            };
        }

        next();

    } catch (error) {
        console.error('MFA status check error:', error);
        req.mfaStatus = {
            isEnabled: false,
            hasBackupCodes: false,
            remainingBackupCodes: 0
        };
        next();
    }
}

// Middleware to require MFA for sensitive operations (optional verification)
async function requireMFAForSensitiveOps(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check if user has MFA enabled
        const mfaStatus = await mfaService.getMFAStatus(userId);

        if (!mfaStatus.isEnabled) {
            // MFA not enabled, continue without verification
            req.mfaVerified = false;
            return next();
        }

        // MFA is enabled, require verification
        const { token, isBackupCode } = req.body;

        if (!token) {
            return res.status(401).json({
                error: {
                    code: 'MFA_TOKEN_REQUIRED',
                    message: 'MFA verification token is required for this sensitive operation',
                    mfaRequired: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify MFA token
        try {
            const verificationResult = await mfaService.verifyMFAToken(userId, token, isBackupCode);

            req.mfaVerified = true;
            req.mfaVerification = verificationResult;
            next();

        } catch (error) {
            return res.status(401).json({
                error: {
                    code: 'MFA_VERIFICATION_FAILED',
                    message: error.message || 'MFA verification failed',
                    timestamp: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('MFA sensitive ops middleware error:', error);
        res.status(500).json({
            error: {
                code: 'MFA_MIDDLEWARE_ERROR',
                message: 'MFA verification system error',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Rate limiting middleware for MFA operations
function createMFARateLimit(maxAttempts = 10, windowMs = 15 * 60 * 1000) {
    const attempts = new Map();

    return (req, res, next) => {
        const identifier = req.user?.id || req.ip || 'anonymous';
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old attempts
        if (attempts.has(identifier)) {
            const userAttempts = attempts.get(identifier).filter(time => time > windowStart);
            attempts.set(identifier, userAttempts);
        }

        // Check current attempts
        const currentAttempts = attempts.get(identifier) || [];

        if (currentAttempts.length >= maxAttempts) {
            return res.status(429).json({
                error: {
                    code: 'MFA_RATE_LIMIT_EXCEEDED',
                    message: 'Too many MFA attempts. Please try again later.',
                    retryAfter: Math.ceil(windowMs / 1000),
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Record this attempt
        currentAttempts.push(now);
        attempts.set(identifier, currentAttempts);

        next();
    };
}

// Middleware to validate MFA setup requirements
async function validateMFASetup(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Check if MFA is already enabled
        const mfaStatus = await mfaService.getMFAStatus(userId);

        if (mfaStatus.isEnabled) {
            return res.status(409).json({
                error: {
                    code: 'MFA_ALREADY_ENABLED',
                    message: 'MFA is already enabled for this user',
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();

    } catch (error) {
        console.error('MFA setup validation error:', error);
        res.status(500).json({
            error: {
                code: 'MFA_SETUP_VALIDATION_ERROR',
                message: 'MFA setup validation failed',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Middleware to ensure MFA is enabled before certain operations
async function ensureMFAEnabled(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const mfaStatus = await mfaService.getMFAStatus(userId);

        if (!mfaStatus.isEnabled) {
            return res.status(403).json({
                error: {
                    code: 'MFA_NOT_ENABLED',
                    message: 'MFA must be enabled to perform this operation',
                    mfaSetupRequired: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();

    } catch (error) {
        console.error('Ensure MFA enabled error:', error);
        res.status(500).json({
            error: {
                code: 'MFA_CHECK_ERROR',
                message: 'MFA status check failed',
                timestamp: new Date().toISOString()
            }
        });
    }
}

export {
    requireMFA,
    checkMFAStatus,
    requireMFAForSensitiveOps,
    createMFARateLimit,
    validateMFASetup,
    ensureMFAEnabled
};