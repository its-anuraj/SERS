/**
 * SERS — Smart Emergency Response System
 * Main API Entry Point
 */

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocketIO } = require('./websocket/socketManager');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to PostgreSQL
        try {
            await connectDB();
            logger.info('✅ PostgreSQL connected');
        } catch (dbErr) {
            logger.error('❌ PostgreSQL connection error:', dbErr.message);
        }

        // Connect to Redis (optional fallback)
        try {
            await connectRedis();
        } catch (redisErr) {
            logger.warn('⚠️ Redis startup notice:', redisErr.message);
        }

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize Socket.io
        try {
            initSocketIO(server);
            logger.info('✅ Socket.io initialized');
        } catch (wsErr) {
            logger.warn('⚠️ Socket.io notice:', wsErr.message);
        }

        // Start listening
        server.listen(PORT, () => {
            logger.info(`🚀 SERS API running on port ${PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
            logger.info(`📡 WebSocket ready for real-time emergency comms`);
        });

        // Graceful shutdown
        const shutdown = (signal) => {
            logger.info(`${signal} received. Shutting down gracefully...`);
            server.close(() => {
                logger.info('HTTP server closed.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
