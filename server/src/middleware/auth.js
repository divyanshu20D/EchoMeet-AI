const { verifyToken, getUserSession } = require('../utils/auth');
const { getPrismaClient } = require('../utils/database');

// Authentication middleware
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Access token is required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Verify token
        const decoded = verifyToken(token);

        // Get user from database to ensure they still exist and are active
        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                organizationId: true,
                isActive: true
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not found or inactive',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: error.message || 'Invalid token',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Optional authentication middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            const prisma = getPrismaClient();
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    organizationId: true,
                    isActive: true
                }
            });

            if (user && user.isActive) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
}

// Role-based authorization middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];

        if (!userRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions',
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();
    };
}

// Organization access middleware
function requireOrganization(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                timestamp: new Date().toISOString()
            }
        });
    }

    if (!req.user.organizationId) {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Organization membership required',
                timestamp: new Date().toISOString()
            }
        });
    }

    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireOrganization
};