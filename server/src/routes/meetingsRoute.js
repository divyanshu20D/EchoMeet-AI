const express = require('express');
const meetingController = require('../controllers/meetingController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateBody, validateParams, validatePagination } = require('../middleware/validation');
const { meetingCreationSchema, meetingUpdateSchema } = require('../schemas/meeting');
const { z } = require('zod');

const router = express.Router();

// Meeting ID parameter validation
const meetingIdSchema = z.object({
    meetingId: z.string().min(1, 'Meeting ID is required')
});

// Create a new meeting
router.post('/', authenticateToken, validateBody(meetingCreationSchema), meetingController.createMeeting);

// Get user's meetings
router.get('/', authenticateToken, validatePagination, meetingController.getUserMeetings);

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

module.exports = router;