/**
 * Express App Configuration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const incidentRoutes = require('./routes/incident.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const ambulanceRoutes = require('./routes/ambulance.routes');
const abdmRoutes = require('./routes/abdm.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// ============================================================
// Security & Middleware
// ============================================================

app.use(helmet({
    contentSecurityPolicy: false, // Configured separately for web portals
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002', 'http://localhost:8081'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
}));

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Stricter rate limiter for SOS (should NOT be rate-limited heavily in production)
const sosLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'SOS rate limit reached.' },
});

// ============================================================
// ============================================================
// Root API Endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'SERS API Gateway',
        status: 'online',
        version: '1.0.0',
        health: '/api/health',
    });
});

// Health Check (no auth required)
// ============================================================

app.get('/api/health', async (req, res) => {
    try {
        const { query } = require('./config/database');
        const { getRedis } = require('./config/redis');

        let dbStatus = 'healthy';
        try {
            await query('SELECT 1');
        } catch (e) {
            dbStatus = 'degraded';
        }

        let redisStatus = 'healthy';
        try {
            const redis = getRedis();
            if (redis) await redis.ping();
            else redisStatus = 'mock_active';
        } catch (e) {
            redisStatus = 'degraded';
        }

        res.json({
            status: dbStatus === 'healthy' ? 'ok' : 'degraded',
            service: 'SERS API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            checks: {
                database: dbStatus,
                redis: redisStatus,
                websocket: 'active',
            },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// ============================================================
// Routes
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/abdm', abdmRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Apply stricter limit on SOS route
app.use('/api/incidents/sos', sosLimiter);

// ============================================================
// Error Handling
// ============================================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;
