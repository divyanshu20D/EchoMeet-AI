import express from 'express';
import meetingController from '../controllers/meetingController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateParams, validatePagination } from '../middleware/validation.js';
import { meetingCreationSchema, meetingUpdateSchema } from '../schemas/meeting.model.js';
import { z } from 'zod';

const router = express.Router();

// Meeting ID parameter validation
const meetingIdSchema = z.object({
    meetingId: z.string().min(1, 'Meeting ID is required')
});

// Create a new meeting
router.post('/', authenticateToken, validateBody(meetingCreationSchema), meetingController.createMeeting);

// Get user's meetings
router.get('/', authenticateToken, meetingController.getUserMeetings);

// Get meeting by ID
router.get('/:meetingId', optionalAuth, validateParams(meetingIdSchema), meetingController.getMeetingById);

// Update meeting
router.put('/:meetingId', authenticateToken, validateParams(meetingIdSchema), validateBody(meetingUpdateSchema), meetingController.updateMeeting);

// Delete meeting
router.delete('/:meetingId', authenticateToken, validateParams(meetingIdSchema), meetingController.deleteMeeting);

// Start meeting
router.post('/:meetingId/start', authenticateToken, validateParams(meetingIdSchema), meetingController.startMeeting);

// End meeting
router.post('/:meetingId/end', authenticateToken, validateParams(meetingIdSchema), meetingController.endMeeting);

// Get meeting info for joining (public endpoint)
router.get('/:meetingId/info', validateParams(meetingIdSchema), meetingController.getMeetingInfo);

// Validate meeting access
router.post('/validate-access', meetingController.validateMeetingAccess);

// Join meeting
router.post('/:meetingId/join', authenticateToken, validateParams(meetingIdSchema), meetingController.joinMeeting);

// Leave meeting
router.post('/:meetingId/leave', authenticateToken, validateParams(meetingIdSchema), meetingController.leaveMeeting);

// Get meeting participants
router.get('/:meetingId/participants', authenticateToken, validateParams(meetingIdSchema), meetingController.getMeetingParticipants);

export default router;