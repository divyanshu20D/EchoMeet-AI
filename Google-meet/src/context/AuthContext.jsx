import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mfaStatus, setMfaStatus] = useState({
        isEnabled: false,
        isRequired: false,
        backupCodesCount: 0
    });

    // Check authentication status on app load
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setIsLoading(false);
                return;
            }

            // Verify token with backend
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData.user);
                setIsAuthenticated(true);

                // Check MFA status
                await checkMFAStatus(userData.user.id);
            } else {
                // Token is invalid, clear it
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const checkMFAStatus = async (userId) => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/mfa/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const mfaData = await response.json();
                setMfaStatus(mfaData);
            }
        } catch (error) {
            console.error('MFA status check failed:', error);
        }
    };

    const login = async (email, password, mfaToken = null) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, mfaToken })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                setUser(data.user);
                setIsAuthenticated(true);

                // Check MFA status
                await checkMFAStatus(data.user.id);

                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error occurred' };
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.error || 'Registration failed' };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error occurred' };
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (token) {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and state regardless of API call success
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
            setIsAuthenticated(false);
            setMfaStatus({
                isEnabled: false,
                isRequired: false,
                backupCodesCount: 0
            });
        }
    };

    const refreshToken = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                return data.accessToken;
            } else {
                throw new Error('Token refresh failed');
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            await logout();
            throw error;
        }
    };

    const updateUser = (updatedUser) => {
        setUser(updatedUser);
    };

    const updateMFAStatus = (newMfaStatus) => {
        setMfaStatus(newMfaStatus);
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        mfaStatus,
        login,
        register,
        logout,
        refreshToken,
        updateUser,
        updateMFAStatus,
        checkAuthStatus
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;