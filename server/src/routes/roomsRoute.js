import express from 'express';
import roomController from '../controllers/roomController.js';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation.js';

const router = express.Router();

// Room creation schema
const roomCreationSchema = z.object({
    hostName: z.string().optional(),
    hostId: z.string().optional()
});

// Room ID parameter validation
const roomIdSchema = z.object({
    roomId: z.string().min(1, 'Room ID is required')
});

// Create a new room
router.post('/', validateBody(roomCreationSchema), roomController.createRoom);

// Check if room exists
router.get('/:roomId', validateParams(roomIdSchema), roomController.getRoomById);

// Get room participants
router.get('/:roomId/participants', validateParams(roomIdSchema), roomController.getRoomParticipants);

export default router;