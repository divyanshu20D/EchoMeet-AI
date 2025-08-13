// API utility functions for making HTTP requests
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Token refresh utility
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.map(callback => callback(token));
    refreshSubscribers = [];
};

const refreshAuthToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
        // Clear tokens if refresh fails
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new Error('Token refresh failed');
    }

    const data = await response.json();
    const newToken = data.data.accessToken;
    localStorage.setItem('accessToken', newToken);
    return newToken;
};

// Main API call function
export const apiCall = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // Default headers
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    // Merge headers
    const headers = {
        ...defaultHeaders,
        ...options.headers,
    };

    // Add auth token if available and not already present
    const token = localStorage.getItem('accessToken');
    if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
    }

    // Make the request
    const config = {
        ...options,
        headers,
    };

    try {
        let response = await fetch(url, config);

        // Handle 401 Unauthorized - attempt token refresh
        if (response.status === 401 && token && !endpoint.includes('/auth/refresh')) {
            if (!isRefreshing) {
                isRefreshing = true;

                try {
                    const newToken = await refreshAuthToken();
                    onRefreshed(newToken);

                    // Retry the original request with new token
                    headers.Authorization = `Bearer ${newToken}`;
                    response = await fetch(url, { ...config, headers });
                } catch (refreshError) {
                    // Refresh failed, redirect to login
                    window.location.href = '/login';
                    throw new APIError('Authentication failed', 401, null);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Wait for ongoing refresh to complete
                return new Promise((resolve) => {
                    subscribeTokenRefresh((newToken) => {
                        headers.Authorization = `Bearer ${newToken}`;
                        resolve(fetch(url, { ...config, headers }));
                    });
                });
            }
        }

        return response;
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }

        // Network or other errors
        throw new APIError(
            error.message || 'Network error occurred',
            0,
            null
        );
    }
};

// Convenience methods for different HTTP verbs
export const api = {
    get: (endpoint, options = {}) =>
        apiCall(endpoint, { ...options, method: 'GET' }),

    post: (endpoint, data, options = {}) =>
        apiCall(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        }),

    put: (endpoint, data, options = {}) =>
        apiCall(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    patch: (endpoint, data, options = {}) =>
        apiCall(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (endpoint, options = {}) =>
        apiCall(endpoint, { ...options, method: 'DELETE' }),
};

// File upload utility
export const uploadFile = async (endpoint, file, additionalData = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    // Add additional form data
    Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
    });

    const token = localStorage.getItem('accessToken');
    const headers = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return apiCall(endpoint, {
        method: 'POST',
        headers,
        body: formData,
    });
};

// WebSocket connection utility
export const createWebSocketConnection = (endpoint, protocols = []) => {
    const wsUrl = endpoint.startsWith('ws')
        ? endpoint
        : `${API_BASE_URL.replace('http', 'ws')}${endpoint}`;

    const token = localStorage.getItem('accessToken');
    const wsEndpoint = token ? `${wsUrl}?token=${token}` : wsUrl;

    return new WebSocket(wsEndpoint, protocols);
};

// Request interceptor for adding common headers or logging
export const addRequestInterceptor = (interceptor) => {
    // This would be implemented if we were using axios
    // For now, we can extend the apiCall function
    console.warn('Request interceptors not implemented for fetch API');
};

// Response interceptor for handling common response patterns
export const addResponseInterceptor = (interceptor) => {
    // This would be implemented if we were using axios
    console.warn('Response interceptors not implemented for fetch API');
};

export { APIError };