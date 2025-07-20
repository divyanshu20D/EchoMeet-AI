const userService = require('../services/userService');

class UserController {
    async updateProfile(req, res) {
        try {
            const user = await userService.updateUserProfile(req.user.id, req.body);

            res.json({
                message: 'Profile updated successfully',
                user
            });
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({
                error: {
                    code: 'PROFILE_UPDATE_FAILED',
                    message: 'Failed to update profile',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getAllUsers(req, res) {
        try {
            const result = await userService.getAllUsers(req.query);

            res.json(result);
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                error: {
                    code: 'USERS_FETCH_FAILED',
                    message: 'Failed to fetch users',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getUserById(req, res) {
        try {
            const { userId } = req.params;
            const user = await userService.getUserById(userId);

            res.json({
                user
            });
        } catch (error) {
            console.error('Get user error:', error);

            if (error.message === 'USER_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'USER_FETCH_FAILED',
                    message: 'Failed to fetch user',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async deactivateUser(req, res) {
        try {
            const { userId } = req.params;
            const user = await userService.deactivateUser(userId, req.user.id);

            res.json({
                message: 'User deactivated successfully',
                user
            });
        } catch (error) {
            console.error('User deactivation error:', error);

            if (error.message === 'CANNOT_DEACTIVATE_SELF') {
                return res.status(400).json({
                    error: {
                        code: 'CANNOT_DEACTIVATE_SELF',
                        message: 'Cannot deactivate your own account',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'USER_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'USER_DEACTIVATION_FAILED',
                    message: 'Failed to deactivate user',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async activateUser(req, res) {
        try {
            const { userId } = req.params;
            const user = await userService.activateUser(userId);

            res.json({
                message: 'User activated successfully',
                user
            });
        } catch (error) {
            console.error('User activation error:', error);

            if (error.message === 'USER_NOT_FOUND') {
                return res.status(404).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'USER_ACTIVATION_FAILED',
                    message: 'Failed to activate user',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}

module.exports = new UserController();