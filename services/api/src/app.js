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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
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
// Health Check (no auth required)
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SERS API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
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
