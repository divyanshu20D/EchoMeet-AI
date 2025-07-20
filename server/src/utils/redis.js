const Redis = require('ioredis');

let redisClient;
let redisSubscriber;
let redisPublisher;

// Redis connection configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'video_conf:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnClusterDown: 300,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    showFriendlyErrorStack: true
};

// Initialize Redis client
function initializeRedis() {
    if (!redisClient) {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
            console.log('🔴 Redis client connected');
        });

        redisClient.on('ready', () => {
            console.log('🔴 Redis client ready');
        });

        redisClient.on('error', (error) => {
            console.error('🔴 Redis client error:', error);
        });

        redisClient.on('close', () => {
            console.log('🔴 Redis client connection closed');
        });

        redisClient.on('reconnecting', () => {
            console.log('🔴 Redis client reconnecting...');
        });
    }

    return redisClient;
}

// Get Redis client instance
function getRedisClient() {
    if (!redisClient) {
        return initializeRedis();
    }
    return redisClient;
}

// Initialize Redis subscriber (for pub/sub)
function getRedisSubscriber() {
    if (!redisSubscriber) {
        redisSubscriber = new Redis(redisConfig);

        redisSubscriber.on('connect', () => {
            console.log('🔴 Redis subscriber connected');
        });

        redisSubscriber.on('error', (error) => {
            console.error('🔴 Redis subscriber error:', error);
        });
    }

    return redisSubscriber;
}

// Initialize Redis publisher (for pub/sub)
function getRedisPublisher() {
    if (!redisPublisher) {
        redisPublisher = new Redis(redisConfig);

        redisPublisher.on('connect', () => {
            console.log('🔴 Redis publisher connected');
        });

        redisPublisher.on('error', (error) => {
            console.error('🔴 Redis publisher error:', error);
        });
    }

    return redisPublisher;
}

// Health check for Redis connection
async function checkRedisConnection() {
    try {
        const client = getRedisClient();
        const result = await client.ping();
        return {
            status: result === 'PONG' ? 'connected' : 'disconnected',
            timestamp: new Date(),
            response: result
        };
    } catch (error) {
        console.error('Redis health check error:', error);
        return {
            status: 'error',
            error: error.message,
            timestamp: new Date()
        };
    }
}

// Graceful shutdown
async function disconnectRedis() {
    const promises = [];

    if (redisClient) {
        promises.push(redisClient.disconnect());
        redisClient = null;
    }

    if (redisSubscriber) {
        promises.push(redisSubscriber.disconnect());
        redisSubscriber = null;
    }

    if (redisPublisher) {
        promises.push(redisPublisher.disconnect());
        redisPublisher = null;
    }

    await Promise.all(promises);
    console.log('🔴 All Redis connections closed');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, closing Redis connections...');
    await disconnectRedis();
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing Redis connections...');
    await disconnectRedis();
});

module.exports = {
    initializeRedis,
    getRedisClient,
    getRedisSubscriber,
    getRedisPublisher,
    checkRedisConnection,
    disconnectRedis
};