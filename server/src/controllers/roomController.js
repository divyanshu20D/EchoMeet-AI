const roomService = require('../services/roomService');

class RoomController {
    async createRoom(req, res) {
        try {
            const { hostName, hostId } = req.body;
            const result = roomService.createRoom(hostName, hostId);

            res.json(result);
        } catch (error) {
            console.error('Room creation error:', error);
            res.status(500).json({
                error: {
                    code: 'ROOM_CREATION_FAILED',
                    message: 'Failed to create room',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getRoomById(req, res) {
        try {
            const { roomId } = req.params;
            const result = roomService.getRoomById(roomId);

            res.json(result);
        } catch (error) {
            console.error('Get room error:', error);

            if (error.message === 'ROOM_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'ROOM_NOT_FOUND',
                        message: 'Room not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'ROOM_FETCH_FAILED',
                    message: 'Failed to fetch room',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getRoomParticipants(req, res) {
        try {
            const { roomId } = req.params;
            const result = roomService.getRoomParticipants(roomId);

            res.json(result);
        } catch (error) {
            console.error('Get room participants error:', error);

            if (error.message === 'ROOM_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'ROOM_NOT_FOUND',
                        message: 'Room not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'PARTICIPANTS_FETCH_FAILED',
                    message: 'Failed to fetch participants',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}

module.exports = new RoomController();