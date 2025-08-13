import express from 'express';
import authController from '../controllers/authController.js';
import { validateBody } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import { userRegistrationSchema, userLoginSchema, passwordChangeSchema } from '../schemas/user.model.js';

const router = express.Router();

// Register new user
router.post('/register', validateBody(userRegistrationSchema), authController.register);

// Login user
router.post('/login', validateBody(userLoginSchema), authController.login);

// Refresh token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authenticateToken, authController.logout);

// Change password
router.post('/change-password', authenticateToken, validateBody(passwordChangeSchema), authController.changePassword);

// Get current user profile
router.get('/me', authenticateToken, authController.getProfile);

// MFA status endpoint
router.get('/mfa/status', authenticateToken, authController.getMFAStatus);

export default router;