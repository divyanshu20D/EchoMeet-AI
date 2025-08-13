import { PrismaClient } from '@prisma/client';

let prisma;

// Initialize Prisma client with connection pooling
function initializePrisma() {
    if (!prisma) {
        console.log('DATABASE_URL:', process.env.DATABASE_URL);
        console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('DATABASE')));

        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        });
    }
    return prisma;
}

// Get Prisma client instance
function getPrismaClient() {
    if (!prisma) {
        return initializePrisma();
    }
    return prisma;
}

// Graceful shutdown
async function disconnectPrisma() {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
    }
}

// Health check for database connection
async function checkDatabaseConnection() {
    try {
        const client = getPrismaClient();
        await client.$queryRaw`SELECT 1`;
        return { status: 'connected', timestamp: new Date() };
    } catch (error) {
        console.error('Database connection error:', error);
        return { status: 'disconnected', error: error.message, timestamp: new Date() };
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, closing database connection...');
    await disconnectPrisma();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing database connection...');
    await disconnectPrisma();
    process.exit(0);
});

export {
    initializePrisma,
    getPrismaClient,
    disconnectPrisma,
    checkDatabaseConnection
};