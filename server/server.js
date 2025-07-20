require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import utilities and middleware
const { initializePrisma, checkDatabaseConnection } = require('./src/utils/database');
const { initializeRedis, checkRedisConnection } = require('./src/utils/redis');
const { cleanupExpiredSessions } = require('./src/utils/auth');
const roomService = require('./src/services/roomService');
const sessionService = require('./src/services/sessionService');

// Import routes
const authRoutes = require('./src/routes/auth');
const meetingRoutes = require('./src/routes/meetings');
const userRoutes = require('./src/routes/users');
const roomRoutes = require('./src/routes/rooms');

// Import socket handler
const SocketHandler = require('./src/handlers/socketHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Initialize database and Redis
initializePrisma();
initializeRedis();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
            timestamp: new Date().toISOString()
        }
    }
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    const dbStatus = await checkDatabaseConnection();
    const redisStatus = await checkRedisConnection();
    const roomStats = roomService.getStats();
    const sessionStats = await sessionService.getSessionStats();

    res.json({
        status: 'OK',
        timestamp: new Date(),
        activeRooms: roomStats.activeRooms,
        activeParticipants: roomStats.activeParticipants,
        activeSessions: sessionStats.totalSessions,
        activeUsers: sessionStats.activeUsers,
        database: dbStatus,
        redis: redisStatus
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Video Conferencing API',
        version: '1.0.0',
        status: 'active',
        endpoints: {
            auth: '/api/auth',
            meetings: '/api/meetings',
            users: '/api/users',
            rooms: '/api/rooms',
            health: '/health'
        }
    });
});

// Socket.IO Connection Handling
const socketHandler = new SocketHandler(io);
io.on('connection', (socket) => {
    socketHandler.handleConnection(socket);
});

// Cleanup expired sessions every hour
setInterval(async () => {
    try {
        await cleanupExpiredSessions();
        console.log('Expired sessions cleaned up');
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
}, 60 * 60 * 1000); // 1 hour

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 CORS enabled for ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    console.log(`📚 API documentation at http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket server ready for real-time communication`);
});