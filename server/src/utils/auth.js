import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from './database.js';
import sessionService from '../services/sessionService.js';

// Hash password
async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
function generateToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '15m') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

// Generate refresh token
function generateRefreshToken(payload, expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d') {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

// Verify refresh token
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}

// Create user session in Redis and database (backup)
async function createUserSession(userId, token, expiresAt, userInfo = {}) {
    const prisma = getPrismaClient();

    // Create in Redis (primary)
    await sessionService.createSession(userId, token, expiresAt, userInfo);

    // Create in database (backup)
    return await prisma.userSession.create({
        data: {
            userId,
            token,
            expiresAt,
            isActive: true
        }
    });
}

// Invalidate user session
async function invalidateUserSession(token) {
    const prisma = getPrismaClient();

    // Invalidate in Redis (primary)
    await sessionService.invalidateSession(token);

    // Invalidate in database (backup)
    return await prisma.userSession.updateMany({
        where: { token },
        data: { isActive: false }
    });
}

// Get active user session
async function getUserSession(token) {
    // Try Redis first (primary)
    const redisSession = await sessionService.getSession(token);
    if (redisSession) {
        return {
            userId: redisSession.userId,
            token: redisSession.token,
            expiresAt: new Date(redisSession.expiresAt),
            isActive: redisSession.isActive,
            user: {
                id: redisSession.userId,
                email: redisSession.userInfo.email,
                name: redisSession.userInfo.name,
                role: redisSession.userInfo.role,
                organizationId: redisSession.userInfo.organizationId,
                isActive: true
            }
        };
    }

    // Fallback to database
    const prisma = getPrismaClient();
    return await prisma.userSession.findFirst({
        where: {
            token,
            isActive: true,
            expiresAt: {
                gt: new Date()
            }
        },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    organizationId: true,
                    isActive: true
                }
            }
        }
    });
}

// Clean up expired sessions
async function cleanupExpiredSessions() {
    const prisma = getPrismaClient();

    // Cleanup Redis sessions (primary)
    const redisCleanedCount = await sessionService.cleanupExpiredSessions();

    // Cleanup database sessions (backup)
    const dbResult = await prisma.userSession.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { isActive: false }
            ]
        }
    });

    console.log(`Cleaned up ${redisCleanedCount} Redis sessions and ${dbResult.count} database sessions`);
    return dbResult;
}

// Generate token pair (access + refresh)
async function generateTokenPair(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
    };

    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Calculate expiration date for refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

    // Store refresh token in Redis and database
    await createUserSession(user.id, refreshToken, refreshExpiresAt, {
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
    });

    return {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    };
}

export {
    hashPassword,
    verifyPassword,
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    createUserSession,
    invalidateUserSession,
    getUserSession,
    cleanupExpiredSessions,
    generateTokenPair
};