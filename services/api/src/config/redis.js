/**
 * Redis Connection (ioredis)
 * Used for: session cache, live ambulance positions, rate limiting
 */

const Redis = require('ioredis');
const logger = require('./logger');

let redis = null;
const memoryCache = new Map();
const memorySets = new Map();

const connectRedis = async () => {
    try {
        if (process.env.REDIS_URL) {
            redis = new Redis(process.env.REDIS_URL, {
                retryStrategy: (times) => {
                    if (times > 3) return null;
                    return Math.min(times * 100, 1000);
                },
                enableReadyCheck: true,
                maxRetriesPerRequest: 1,
                connectTimeout: 4000,
            });
        } else {
            redis = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                retryStrategy: (times) => {
                    if (times > 3) return null;
                    return Math.min(times * 100, 1000);
                },
                enableReadyCheck: true,
                maxRetriesPerRequest: 1,
                connectTimeout: 4000,
            });
        }

        redis.on('error', (err) => logger.warn('Redis notice:', err.message));

        await Promise.race([
            redis.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000))
        ]);

        logger.info('✅ Redis connected');
        return redis;
    } catch (err) {
        logger.warn(`⚠️ Redis offline (${err.message}). Using high-performance in-memory cache fallback.`);
        redis = null;
        return null;
    }
};

const getRedis = () => {
    return redis;
};

const getRedisClient = () => {
    return redis;
};

// ---- Convenience helpers with automatic fallback ----

/**
 * Cache ambulance position (expires in 30 seconds)
 */
const setAmbulancePosition = async (ambulanceId, lat, lng, heading, speed) => {
    const val = JSON.stringify({ lat, lng, heading, speed, updatedAt: Date.now() });
    if (redis && redis.status === 'ready') {
        try {
            await redis.setex(`ambulance:pos:${ambulanceId}`, 30, val);
            return;
        } catch {}
    }
    memoryCache.set(`ambulance:pos:${ambulanceId}`, { val, expiresAt: Date.now() + 30000 });
};

const getAmbulancePosition = async (ambulanceId) => {
    if (redis && redis.status === 'ready') {
        try {
            const data = await redis.get(`ambulance:pos:${ambulanceId}`);
            return data ? JSON.parse(data) : null;
        } catch {}
    }
    const item = memoryCache.get(`ambulance:pos:${ambulanceId}`);
    if (item && item.expiresAt > Date.now()) {
        return JSON.parse(item.val);
    }
    return null;
};

/**
 * Cache hospital capacity (expires in 60 seconds)
 */
const setHospitalCapacity = async (hospitalId, capacity) => {
    const val = JSON.stringify(capacity);
    if (redis && redis.status === 'ready') {
        try {
            await redis.setex(`hospital:capacity:${hospitalId}`, 60, val);
            return;
        } catch {}
    }
    memoryCache.set(`hospital:capacity:${hospitalId}`, { val, expiresAt: Date.now() + 60000 });
};

const getHospitalCapacity = async (hospitalId) => {
    if (redis && redis.status === 'ready') {
        try {
            const data = await redis.get(`hospital:capacity:${hospitalId}`);
            return data ? JSON.parse(data) : null;
        } catch {}
    }
    const item = memoryCache.get(`hospital:capacity:${hospitalId}`);
    if (item && item.expiresAt > Date.now()) {
        return JSON.parse(item.val);
    }
    return null;
};

/**
 * Store active incident rooms (for Socket.io room management)
 */
const addToIncidentRoom = async (incidentId, socketId) => {
    if (redis && redis.status === 'ready') {
        try {
            await redis.sadd(`incident:room:${incidentId}`, socketId);
            await redis.expire(`incident:room:${incidentId}`, 86400);
            return;
        } catch {}
    }
    if (!memorySets.has(incidentId)) memorySets.set(incidentId, new Set());
    memorySets.get(incidentId).add(socketId);
};

const removeFromIncidentRoom = async (incidentId, socketId) => {
    if (redis && redis.status === 'ready') {
        try {
            await redis.srem(`incident:room:${incidentId}`, socketId);
            return;
        } catch {}
    }
    if (memorySets.has(incidentId)) {
        memorySets.get(incidentId).delete(socketId);
    }
};

/**
 * Blacklist JWT tokens on logout
 */
const blacklistToken = async (token, expiresIn) => {
    if (redis && redis.status === 'ready') {
        try {
            await redis.setex(`blacklist:${token}`, expiresIn, '1');
            return;
        } catch {}
    }
    memoryCache.set(`blacklist:${token}`, { val: '1', expiresAt: Date.now() + (expiresIn * 1000) });
};

const isTokenBlacklisted = async (token) => {
    if (redis && redis.status === 'ready') {
        try {
            return !!(await redis.exists(`blacklist:${token}`));
        } catch {}
    }
    const item = memoryCache.get(`blacklist:${token}`);
    return !!(item && item.expiresAt > Date.now());
};

module.exports = {
    connectRedis,
    getRedis,
    getRedisClient,
    setAmbulancePosition,
    getAmbulancePosition,
    setHospitalCapacity,
    getHospitalCapacity,
    addToIncidentRoom,
    removeFromIncidentRoom,
    blacklistToken,
    isTokenBlacklisted,
};
