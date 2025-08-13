import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the server directory
const envPath = join(__dirname, '.env');
console.log('Looking for .env file at:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });
// console.log('Dotenv result:', result);
// console.log('Environment loaded. DATABASE_URL exists:', !!process.env.DATABASE_URL);
// console.log('DATABASE_URL value:', process.env.DATABASE_URL);

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Import utilities and middleware
import {
  initializePrisma,
  checkDatabaseConnection,
} from "./src/utils/database.js";
import { initializeRedis, checkRedisConnection } from "./src/utils/redis.js";
import { cleanupExpiredSessions } from "./src/utils/auth.js";
import roomService from "./src/services/roomService.js";
import sessionService from "./src/services/sessionService.js";
import sessionCacheService from "./src/services/sessionCacheService.js";
import meetingCacheService from "./src/services/meetingCacheService.js";
import participantManagementService from "./src/services/participantManagementService.js";

// Import routes
import authRoutes from "./src/routes/authRoute.js";
import meetingRoutes from "./src/routes/meetingsRoute.js";
import userRoutes from "./src/routes/usersRoute.js";
import roomRoutes from "./src/routes/roomsRoute.js";
import participantsRoutes from "./src/routes/participantsRoute.js";
import meetingSecurityRoutes from "./src/routes/meetingSecurityRoute.js";
import mfaRoutes from "./src/routes/mfaRoute.js";

// Enhanced Socket.IO server handles all socket connections

const app = express();
const server = createServer(app);

// Configure trust proxy more securely for development
if (process.env.NODE_ENV === 'production') {
  app.set("trust proxy", 1); // Trust first proxy
} else {
  app.set("trust proxy", false); // Don't trust proxy in development
}

// Initialize Enhanced Socket.IO Server
import EnhancedSocketServer from "./src/services/enhancedSocketServer.js";
const enhancedSocketServer = new EnhancedSocketServer(server);
const io = enhancedSocketServer.getIO();

// Initialize database and Redis
initializePrisma();
initializeRedis();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later.",
      timestamp: new Date().toISOString(),
    },
  },
  // Skip rate limiting in development to avoid trust proxy issues
  skip: process.env.NODE_ENV === 'development' ? () => true : () => false,
});

app.use("/api/", limiter);

// CORS configuration
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     credentials: true,
//   })
// );

app.use(cors())

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api", participantsRoutes);
app.use("/api/security", meetingSecurityRoutes);
app.use("/api/mfa", mfaRoutes);
app.use("/api/participants", participantsRoutes);

// Health check endpoint
app.get("/health", async (req, res) => {
  const dbStatus = await checkDatabaseConnection();
  const redisStatus = await checkRedisConnection();
  const roomStats = roomService.getStats();
  const sessionStats = await sessionService.getSessionStats();
  const sessionCacheStats = await sessionCacheService.getSessionStats();
  const meetingCacheStats = await meetingCacheService.getMeetingCacheStats();
  const socketMetrics = enhancedSocketServer.getMetrics();
  const webrtcStats = await enhancedSocketServer.getWebRTCStats();
  const participantStats = await participantManagementService.getParticipantStats();

  res.json({
    status: "OK",
    timestamp: new Date(),
    activeRooms: roomStats.activeRooms,
    activeParticipants: roomStats.activeParticipants,
    activeSessions: sessionStats.totalSessions,
    activeUsers: sessionStats.activeUsers,
    cache: {
      sessions: sessionCacheStats,
      meetings: meetingCacheStats,
    },
    realtime: {
      socket: socketMetrics,
      webrtc: webrtcStats,
    },
    participants: participantStats,
    database: dbStatus,
    redis: redisStatus,
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Video Conferencing API",
    version: "1.0.0",
    status: "active",
    endpoints: {
      auth: "/api/auth",
      meetings: "/api/meetings",
      users: "/api/users",
      rooms: "/api/rooms",
      participants: "/api/participants",
      health: "/health",
    },
  });
});

// Socket.IO is now handled by EnhancedSocketServer
// Connection handling is automatically set up in the constructor

// Cleanup expired sessions and cache every hour
setInterval(async () => {
  try {
    await cleanupExpiredSessions();
    await sessionCacheService.cleanupExpiredSessions();
    await meetingCacheService.cleanupExpiredMeetings();
    await participantManagementService.cleanupExpiredInvitations();
    console.log("Expired sessions, cache, and invitations cleaned up");
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}, 60 * 60 * 1000); // 1 hour

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `🌐 CORS enabled for ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`📚 API documentation at http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket server ready for real-time communication`);
});
