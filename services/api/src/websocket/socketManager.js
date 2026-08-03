/**
 * Socket.io Manager
 * Real-time emergency communication layer
 *
 * Rooms:
 *   'responders'              — All online responders receive new incident broadcasts
 *   'admins'                  — Admin/coordinator dashboard
 *   'hospital:updates'        — Hospital capacity updates
 *   `incident:{id}`           — All parties in a specific incident (victim, responder, hospital)
 *   `user:{userId}`           — Direct messages to a specific user
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

let io;

const initSocketIO = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002', 'http://localhost:8081'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ---- Authentication middleware ----
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) return next(new Error('Authentication token required'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;
            next();
        } catch (err) {
            next(new Error('Invalid authentication token'));
        }
    });

    // ---- Connection handler ----
    io.on('connection', (socket) => {
        const { userId, userRole } = socket;
        logger.info('Socket connected', { socketId: socket.id, userId, userRole });

        // Auto-join role-based rooms
        socket.join(`user:${userId}`);
        if (userRole === 'responder') socket.join('responders');
        if (userRole === 'admin' || userRole === 'coordinator') {
            socket.join('admins');
            socket.join('responders'); // Admins see everything
        }
        if (userRole === 'hospital_staff') socket.join('hospital:updates');

        // ---- Join incident room ----
        socket.on('incident:join', ({ incidentId }) => {
            socket.join(`incident:${incidentId}`);
            logger.debug('User joined incident room', { userId, incidentId });
        });

        // ---- Leave incident room ----
        socket.on('incident:leave', ({ incidentId }) => {
            socket.leave(`incident:${incidentId}`);
        });

        // ---- Responder: location update (high-frequency) ----
        socket.on('location:update', ({ ambulanceId, lat, lng, heading, speedKmh }) => {
            // Forward to all watching this incident (handled by ambulance controller too)
            socket.to('admins').emit('ambulance:location', { ambulanceId, lat, lng, heading, speedKmh, timestamp: Date.now() });
        });

        // ---- Chat within incident (responder ↔ hospital) ----
        socket.on('incident:message', ({ incidentId, message, senderName }) => {
            io.to(`incident:${incidentId}`).emit('incident:message', {
                incidentId,
                message,
                senderName,
                senderRole: userRole,
                timestamp: new Date().toISOString(),
            });
        });

        // ---- Hospital status update ----
        socket.on('hospital:status', ({ hospitalId, icuAvailable, erAvailable }) => {
            if (userRole !== 'hospital_staff' && userRole !== 'admin') return;
            io.to('admins').emit('hospital:capacity', { hospitalId, icuAvailable, erAvailable, timestamp: Date.now() });
        });

        // ---- Ping/heartbeat ----
        socket.on('ping', (cb) => { if (typeof cb === 'function') cb({ timestamp: Date.now() }); });

        // ---- Disconnect ----
        socket.on('disconnect', (reason) => {
            logger.debug('Socket disconnected', { socketId: socket.id, userId, reason });
        });

        // ---- Error ----
        socket.on('error', (err) => {
            logger.error('Socket error', { socketId: socket.id, error: err.message });
        });

        // Notify admin dashboard of new connection
        io.to('admins').emit('system:user_online', { userId, role: userRole, timestamp: Date.now() });
    });

    logger.info(`Socket.io initialized on server`);
    return io;
};

const getSocketIO = () => io;

module.exports = { initSocketIO, getSocketIO };
