// Environment configuration
const config = {
    // API Configuration
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    socketUrl: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001',

    // WebRTC Configuration
    stunServers: (process.env.REACT_APP_STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
        .split(',')
        .map(url => ({ urls: url.trim() })),

    turnServers: process.env.REACT_APP_TURN_SERVERS
        ? process.env.REACT_APP_TURN_SERVERS.split(',').map(server => {
            const [urls, username, credential] = server.split('|');
            return { urls: urls.trim(), username, credential };
        })
        : [],

    // Feature Flags
    features: {
        analytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
        errorReporting: process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true',
        performanceMonitoring: process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true',
        themes: process.env.REACT_APP_ENABLE_THEMES === 'true',
        screenShare: process.env.REACT_APP_ENABLE_SCREEN_SHARE !== 'false',
        recording: process.env.REACT_APP_ENABLE_RECORDING !== 'false',
        soundNotifications: process.env.REACT_APP_ENABLE_SOUND_NOTIFICATIONS !== 'false'
    },

    // Environment
    environment: process.env.REACT_APP_ENVIRONMENT || process.env.NODE_ENV || 'development',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Security
    security: {
        enableHttps: process.env.REACT_APP_ENABLE_HTTPS === 'true',
        secureCookies: process.env.REACT_APP_SECURE_COOKIES === 'true'
    },

    // UI Configuration
    ui: {
        defaultTheme: process.env.REACT_APP_DEFAULT_THEME || 'dark',
        maxParticipants: parseInt(process.env.REACT_APP_MAX_PARTICIPANTS) || 100,
        notificationDuration: parseInt(process.env.REACT_APP_NOTIFICATION_DURATION) || 5000
    },

    // Media Configuration
    media: {
        defaultVideoQuality: process.env.REACT_APP_DEFAULT_VIDEO_QUALITY || '720p',
        defaultAudioQuality: process.env.REACT_APP_DEFAULT_AUDIO_QUALITY || 'high',

        videoConstraints: {
            '480p': { width: 640, height: 480 },
            '720p': { width: 1280, height: 720 },
            '1080p': { width: 1920, height: 1080 }
        },

        audioConstraints: {
            low: { sampleRate: 16000, echoCancellation: true },
            medium: { sampleRate: 44100, echoCancellation: true, noiseSuppression: true },
            high: {
                sampleRate: 44100,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        }
    },

    // Development
    debug: {
        enabled: process.env.REACT_APP_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development',
        mockApi: process.env.REACT_APP_MOCK_API === 'true'
    }
};

// Validate required configuration
const validateConfig = () => {
    const required = ['apiUrl', 'socketUrl'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
        console.error('Missing required configuration:', missing);
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};

// Initialize configuration
if (config.isProduction) {
    validateConfig();
}

// Debug logging in development
if (config.debug.enabled) {
    console.log('Application Configuration:', config);
}

export default config;