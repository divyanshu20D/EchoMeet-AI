const express = require('express');
const authController = require('../controllers/authController');
const { validateBody } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { userRegistrationSchema, userLoginSchema, passwordChangeSchema } = require('../schemas/user.model');

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

module.exports = router;