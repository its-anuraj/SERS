/**
 * Redis Connection (ioredis)
 * Used for: session cache, live ambulance positions, rate limiting
 */

const Redis = require('ioredis');
const logger = require('./logger');

let redis;

const connectRedis = async () => {
    if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, {
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.error('Redis connection failed after 10 retries');
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
        });
    } else {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.error('Redis connection failed after 10 retries');
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
        });
    }

    await redis.ping();

    redis.on('error', (err) => logger.error('Redis error:', err.message));
    redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    return redis;
};

const getRedis = () => {
    if (!redis) throw new Error('Redis not initialized. Call connectRedis() first.');
    return redis;
};

// ---- Convenience helpers ----

/**
 * Cache ambulance position (expires in 30 seconds)
 */
const setAmbulancePosition = async (ambulanceId, lat, lng, heading, speed) => {
    const key = `ambulance:pos:${ambulanceId}`;
    await redis.setex(key, 30, JSON.stringify({ lat, lng, heading, speed, updatedAt: Date.now() }));
};

const getAmbulancePosition = async (ambulanceId) => {
    const data = await redis.get(`ambulance:pos:${ambulanceId}`);
    return data ? JSON.parse(data) : null;
};

/**
 * Cache hospital capacity (expires in 60 seconds)
 */
const setHospitalCapacity = async (hospitalId, capacity) => {
    await redis.setex(`hospital:capacity:${hospitalId}`, 60, JSON.stringify(capacity));
};

const getHospitalCapacity = async (hospitalId) => {
    const data = await redis.get(`hospital:capacity:${hospitalId}`);
    return data ? JSON.parse(data) : null;
};

/**
 * Store active incident rooms (for Socket.io room management)
 */
const addToIncidentRoom = async (incidentId, socketId) => {
    await redis.sadd(`incident:room:${incidentId}`, socketId);
    await redis.expire(`incident:room:${incidentId}`, 86400); // 24h
};

const removeFromIncidentRoom = async (incidentId, socketId) => {
    await redis.srem(`incident:room:${incidentId}`, socketId);
};

/**
 * Blacklist JWT tokens on logout
 */
const blacklistToken = async (token, expiresIn) => {
    await redis.setex(`blacklist:${token}`, expiresIn, '1');
};

const isTokenBlacklisted = async (token) => {
    return !!(await redis.exists(`blacklist:${token}`));
};

module.exports = {
    connectRedis,
    getRedis,
    setAmbulancePosition,
    getAmbulancePosition,
    setHospitalCapacity,
    getHospitalCapacity,
    addToIncidentRoom,
    removeFromIncidentRoom,
    blacklistToken,
    isTokenBlacklisted,
};
