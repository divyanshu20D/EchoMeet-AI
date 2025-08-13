import meetingService from '../services/meetingService.js';

class MeetingController {
    async createMeeting(req, res) {
        try {
            const meeting = await meetingService.createMeeting(req.user.id, req.body);

            res.status(201).json({
                message: 'Meeting created successfully',
                meeting
            });
        } catch (error) {
            console.error('Meeting creation error:', error);
            res.status(500).json({
                error: {
                    code: 'MEETING_CREATION_FAILED',
                    message: 'Failed to create meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getUserMeetings(req, res) {
        try {
            const pagination = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await meetingService.getUserMeetings(req.user.id, pagination);

            res.json(result);
        } catch (error) {
            console.error('Get meetings error:', error);
            res.status(500).json({
                error: {
                    code: 'MEETINGS_FETCH_FAILED',
                    message: 'Failed to fetch meetings',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getMeetingById(req, res) {
        try {
            const { meetingId } = req.params;
            const meeting = await meetingService.getMeetingById(meetingId, req.user?.id);

            res.json({
                meeting
            });
        } catch (error) {
            console.error('Get meeting error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'ACCESS_DENIED') {
                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Access denied to this meeting',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_FETCH_FAILED',
                    message: 'Failed to fetch meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async updateMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            const meeting = await meetingService.updateMeeting(meetingId, req.user.id, req.body);

            res.json({
                message: 'Meeting updated successfully',
                meeting
            });
        } catch (error) {
            console.error('Meeting update error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'ACCESS_DENIED') {
                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only the meeting host can update the meeting',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_UPDATE_FAILED',
                    message: 'Failed to update meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async deleteMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            await meetingService.deleteMeeting(meetingId, req.user.id);

            res.json({
                message: 'Meeting deleted successfully'
            });
        } catch (error) {
            console.error('Meeting deletion error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'ACCESS_DENIED') {
                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only the meeting host can delete the meeting',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_DELETION_FAILED',
                    message: 'Failed to delete meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async startMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            const meeting = await meetingService.startMeeting(meetingId, req.user.id);

            res.json({
                message: 'Meeting started successfully',
                meeting
            });
        } catch (error) {
            console.error('Meeting start error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'ACCESS_DENIED') {
                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only the meeting host can start the meeting',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'MEETING_ALREADY_ACTIVE') {
                return res.status(400).json({
                    error: {
                        code: 'MEETING_ALREADY_ACTIVE',
                        message: 'Meeting is already active',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_START_FAILED',
                    message: 'Failed to start meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async endMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            const meeting = await meetingService.endMeeting(meetingId, req.user.id);

            res.json({
                message: 'Meeting ended successfully',
                meeting
            });
        } catch (error) {
            console.error('Meeting end error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'ACCESS_DENIED') {
                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only the meeting host can end the meeting',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'MEETING_ALREADY_ENDED') {
                return res.status(400).json({
                    error: {
                        code: 'MEETING_ALREADY_ENDED',
                        message: 'Meeting is already ended',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_END_FAILED',
                    message: 'Failed to end meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getMeetingInfo(req, res) {
        try {
            const { meetingId } = req.params;
            const meetingInfo = await meetingService.getMeetingInfo(meetingId);

            res.json({
                data: meetingInfo
            });
        } catch (error) {
            console.error('Get meeting info error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'MEETING_INFO_FAILED',
                    message: 'Failed to get meeting information',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async validateMeetingAccess(req, res) {
        try {
            const { meetingId, password, guestName } = req.body;

            if (!meetingId) {
                return res.status(400).json({
                    error: {
                        code: 'MISSING_MEETING_ID',
                        message: 'Meeting ID is required',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const result = await meetingService.validateMeetingAccess(
                meetingId,
                password,
                req.user?.id,
                guestName
            );

            res.json({
                message: 'Access validated successfully',
                data: result
            });
        } catch (error) {
            console.error('Validate meeting access error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'INVALID_PASSWORD') {
                return res.status(401).json({
                    error: {
                        code: 'INVALID_PASSWORD',
                        message: 'Invalid meeting password',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'MEETING_ENDED') {
                return res.status(400).json({
                    error: {
                        code: 'MEETING_ENDED',
                        message: 'This meeting has ended',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'ACCESS_VALIDATION_FAILED',
                    message: 'Failed to validate meeting access',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async joinMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            const result = await meetingService.joinMeeting(meetingId, req.user.id);

            res.json({
                message: 'Joined meeting successfully',
                data: result
            });
        } catch (error) {
            console.error('Join meeting error:', error);

            if (error.message === 'MEETING_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'MEETING_NOT_FOUND',
                        message: 'Meeting not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'MEETING_ENDED') {
                return res.status(400).json({
                    error: {
                        code: 'MEETING_ENDED',
                        message: 'This meeting has ended',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'JOIN_MEETING_FAILED',
                    message: 'Failed to join meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async leaveMeeting(req, res) {
        try {
            const { meetingId } = req.params;
            await meetingService.leaveMeeting(meetingId, req.user.id);

            res.json({
                message: 'Left meeting successfully'
            });
        } catch (error) {
            console.error('Leave meeting error:', error);

            res.status(500).json({
                error: {
                    code: 'LEAVE_MEETING_FAILED',
                    message: 'Failed to leave meeting',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getMeetingParticipants(req, res) {
        try {
            const { meetingId } = req.params;
            const participants = await meetingService.getMeetingParticipants(meetingId);

            res.json({
                participants
            });
        } catch (error) {
            console.error('Get meeting participants error:', error);

            res.status(500).json({
                error: {
                    code: 'GET_PARTICIPANTS_FAILED',
                    message: 'Failed to get meeting participants',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}

export default new MeetingController();