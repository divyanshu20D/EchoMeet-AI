import express from 'express';
import userController from '../controllers/userController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, validateParams, validatePagination } from '../middleware/validation.js';
import { userUpdateSchema } from '../schemas/user.model.js';
import { z } from 'zod';

const router = express.Router();

// User ID parameter validation
const userIdSchema = z.object({
    userId: z.string().min(1, 'User ID is required')
});

// Update user profile
router.put('/profile', authenticateToken, validateBody(userUpdateSchema), userController.updateProfile);

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(['ADMIN', 'SUPER_ADMIN']), validatePagination, userController.getAllUsers);

// Get user by ID (admin only)
router.get('/:userId', authenticateToken, requireRole(['ADMIN', 'SUPER_ADMIN']), validateParams(userIdSchema), userController.getUserById);

// Deactivate user (admin only)
router.post('/:userId/deactivate', authenticateToken, requireRole(['ADMIN', 'SUPER_ADMIN']), validateParams(userIdSchema), userController.deactivateUser);

// Activate user (admin only)
router.post('/:userId/activate', authenticateToken, requireRole(['ADMIN', 'SUPER_ADMIN']), validateParams(userIdSchema), userController.activateUser);

export default router;