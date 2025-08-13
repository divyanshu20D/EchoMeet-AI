import { getRedisClient } from '../utils/redis.js';

class CacheService {
    constructor() {
        this.redis = getRedisClient();
        this.defaultTTL = 3600; // 1 hour in seconds
    }

    // Generic cache operations
    async get(key) {
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.setex(key, ttl, serializedValue);
            } else {
                await this.redis.set(key, serializedValue);
            }
            return true;
        } catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }

    async del(key) {
        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
            return false;
        }
    }

    async exists(key) {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            console.error(`Cache exists error for key ${key}:`, error);
            return false;
        }
    }

    async expire(key, ttl) {
        try {
            await this.redis.expire(key, ttl);
            return true;
        } catch (error) {
            console.error(`Cache expire error for key ${key}:`, error);
            return false;
        }
    }

    async ttl(key) {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            console.error(`Cache TTL error for key ${key}:`, error);
            return -1;
        }
    }

    // Hash operations (for complex objects)
    async hget(key, field) {
        try {
            const value = await this.redis.hget(key, field);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Cache hget error for key ${key}, field ${field}:`, error);
            return null;
        }
    }

    async hset(key, field, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify(value);
            await this.redis.hset(key, field, serializedValue);
            if (ttl > 0) {
                await this.redis.expire(key, ttl);
            }
            return true;
        } catch (error) {
            console.error(`Cache hset error for key ${key}, field ${field}:`, error);
            return false;
        }
    }

    async hdel(key, field) {
        try {
            await this.redis.hdel(key, field);
            return true;
        } catch (error) {
            console.error(`Cache hdel error for key ${key}, field ${field}:`, error);
            return false;
        }
    }

    async hgetall(key) {
        try {
            const hash = await this.redis.hgetall(key);
            const result = {};
            for (const [field, value] of Object.entries(hash)) {
                result[field] = JSON.parse(value);
            }
            return result;
        } catch (error) {
            console.error(`Cache hgetall error for key ${key}:`, error);
            return {};
        }
    }

    // Set operations (for collections)
    async sadd(key, ...members) {
        try {
            const serializedMembers = members.map(member => JSON.stringify(member));
            await this.redis.sadd(key, ...serializedMembers);
            return true;
        } catch (error) {
            console.error(`Cache sadd error for key ${key}:`, error);
            return false;
        }
    }

    async srem(key, ...members) {
        try {
            const serializedMembers = members.map(member => JSON.stringify(member));
            await this.redis.srem(key, ...serializedMembers);
            return true;
        } catch (error) {
            console.error(`Cache srem error for key ${key}:`, error);
            return false;
        }
    }

    async smembers(key) {
        try {
            const members = await this.redis.smembers(key);
            return members.map(member => JSON.parse(member));
        } catch (error) {
            console.error(`Cache smembers error for key ${key}:`, error);
            return [];
        }
    }

    async sismember(key, member) {
        try {
            const serializedMember = JSON.stringify(member);
            const result = await this.redis.sismember(key, serializedMember);
            return result === 1;
        } catch (error) {
            console.error(`Cache sismember error for key ${key}:`, error);
            return false;
        }
    }

    // List operations (for ordered collections)
    async lpush(key, ...values) {
        try {
            const serializedValues = values.map(value => JSON.stringify(value));
            await this.redis.lpush(key, ...serializedValues);
            return true;
        } catch (error) {
            console.error(`Cache lpush error for key ${key}:`, error);
            return false;
        }
    }

    async rpush(key, ...values) {
        try {
            const serializedValues = values.map(value => JSON.stringify(value));
            await this.redis.rpush(key, ...serializedValues);
            return true;
        } catch (error) {
            console.error(`Cache rpush error for key ${key}:`, error);
            return false;
        }
    }

    async lrange(key, start = 0, stop = -1) {
        try {
            const values = await this.redis.lrange(key, start, stop);
            return values.map(value => JSON.parse(value));
        } catch (error) {
            console.error(`Cache lrange error for key ${key}:`, error);
            return [];
        }
    }

    async lrem(key, count, value) {
        try {
            const serializedValue = JSON.stringify(value);
            await this.redis.lrem(key, count, serializedValue);
            return true;
        } catch (error) {
            console.error(`Cache lrem error for key ${key}:`, error);
            return false;
        }
    }

    // Pattern-based operations
    async keys(pattern) {
        try {
            return await this.redis.keys(pattern);
        } catch (error) {
            console.error(`Cache keys error for pattern ${pattern}:`, error);
            return [];
        }
    }

    async deletePattern(pattern) {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            return keys.length;
        } catch (error) {
            console.error(`Cache deletePattern error for pattern ${pattern}:`, error);
            return 0;
        }
    }

    // Increment/Decrement operations
    async incr(key) {
        try {
            return await this.redis.incr(key);
        } catch (error) {
            console.error(`Cache incr error for key ${key}:`, error);
            return 0;
        }
    }

    async decr(key) {
        try {
            return await this.redis.decr(key);
        } catch (error) {
            console.error(`Cache decr error for key ${key}:`, error);
            return 0;
        }
    }

    async incrby(key, increment) {
        try {
            return await this.redis.incrby(key, increment);
        } catch (error) {
            console.error(`Cache incrby error for key ${key}:`, error);
            return 0;
        }
    }

    // Cache statistics
    async getStats() {
        try {
            const info = await this.redis.info('memory');
            const keyspace = await this.redis.info('keyspace');

            return {
                memory: info,
                keyspace: keyspace,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return null;
        }
    }

    // Flush operations (use with caution)
    async flushdb() {
        try {
            await this.redis.flushdb();
            return true;
        } catch (error) {
            console.error('Cache flushdb error:', error);
            return false;
        }
    }
}

export default new CacheService();