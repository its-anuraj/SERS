/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { isTokenBlacklisted } = require('../config/redis');
const { ApiError } = require('./errorHandler');

/**
 * Verify JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new ApiError(401, 'Access token required');
        }

        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted (logged out)
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
            throw new ApiError(401, 'Token has been invalidated. Please login again.');
        }

        // Verify token
        const jwtSecret = process.env.JWT_SECRET || 'sers_super_secure_emergency_jwt_secret_key_2026';
        const decoded = jwt.verify(token, jwtSecret);

        // Fetch user from DB (ensures user still exists + is active)
        const result = await query(
            'SELECT id, name, phone, email, role, is_active, preferred_language, fcm_token FROM users WHERE id = $1 AND deleted_at IS NULL',
            [decoded.userId]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            throw new ApiError(401, 'User account not found or deactivated');
        }

        req.user = result.rows[0];
        req.token = token;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new ApiError(401, 'Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new ApiError(401, 'Token expired'));
        }
        next(error);
    }
};

/**
 * Role-based authorization
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Authentication required'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new ApiError(403, `Access denied. Required roles: ${roles.join(', ')}`));
        }
        next();
    };
};

/**
 * Optional auth — attaches user if token present, continues without if not
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    return authenticate(req, res, next);
};

module.exports = { authenticate, authorize, optionalAuth };
