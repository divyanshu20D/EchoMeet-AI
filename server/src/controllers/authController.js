import authService from '../services/authService.js';

class AuthController {
    async register(req, res) {
        try {
            const result = await authService.registerUser(req.body);

            res.status(201).json({
                message: 'User registered successfully',
                user: result.user,
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresIn: result.tokens.expiresIn
            });
        } catch (error) {
            console.error('Registration error:', error);

            if (error.message === 'USER_EXISTS') {
                return res.status(409).json({
                    error: {
                        code: 'USER_EXISTS',
                        message: 'User with this email already exists',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            if (error.message === 'INVALID_ORGANIZATION') {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_ORGANIZATION',
                        message: 'Organization not found',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'REGISTRATION_FAILED',
                    message: 'Failed to register user',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await authService.loginUser(email, password);

            res.json({
                message: 'Login successful',
                user: result.user,
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresIn: result.tokens.expiresIn
            });
        } catch (error) {
            console.error('Login error:', error);

            if (error.message === 'INVALID_CREDENTIALS') {
                return res.status(401).json({
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: 'Invalid email or password',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'LOGIN_FAILED',
                    message: 'Failed to login',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            const result = await authService.refreshToken(refreshToken);

            res.json({
                message: 'Token refreshed successfully',
                tokens: result.tokens
            });
        } catch (error) {
            console.error('Token refresh error:', error);

            const errorCode = error.message === 'MISSING_REFRESH_TOKEN' ? 'MISSING_REFRESH_TOKEN' : 'INVALID_REFRESH_TOKEN';
            const statusCode = error.message === 'MISSING_REFRESH_TOKEN' ? 400 : 401;

            res.status(statusCode).json({
                error: {
                    code: errorCode,
                    message: error.message === 'MISSING_REFRESH_TOKEN' ? 'Refresh token is required' : 'Invalid or expired refresh token',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async logout(req, res) {
        try {
            await authService.logoutUser(req.user.id);

            res.json({
                message: 'Logout successful'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                error: {
                    code: 'LOGOUT_FAILED',
                    message: 'Failed to logout',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            await authService.changePassword(req.user.id, currentPassword, newPassword);

            res.json({
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Password change error:', error);

            if (error.message === 'INVALID_CURRENT_PASSWORD') {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_CURRENT_PASSWORD',
                        message: 'Current password is incorrect',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            res.status(500).json({
                error: {
                    code: 'PASSWORD_CHANGE_FAILED',
                    message: 'Failed to change password',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await authService.getUserProfile(req.user.id);

            res.json({
                user
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                error: {
                    code: 'PROFILE_FETCH_FAILED',
                    message: 'Failed to fetch user profile',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async getMFAStatus(req, res) {
        try {
            // For now, return a simple MFA status
            // In a real app, you'd check the user's MFA settings from the database
            res.json({
                isEnabled: false,
                isRequired: false,
                backupCodesCount: 0
            });
        } catch (error) {
            console.error('Get MFA status error:', error);
            res.status(500).json({
                error: {
                    code: 'MFA_STATUS_FAILED',
                    message: 'Failed to get MFA status',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}
export default new AuthController();
