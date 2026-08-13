/**
 * Auth Controller — Register, Login, Refresh, Logout
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { blacklistToken } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Generate JWT token pair
 */
const generateTokens = (userId, role) => {
    const accessToken = jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const refreshToken = jwt.sign(
        { userId, role, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
    return { accessToken, refreshToken };
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const { name, phone, email, password, role = 'citizen', preferredLanguage = 'en', bloodGroup } = req.body;

        // Check if phone already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL',
            [phone]
        );
        if (existingUser.rows.length > 0) {
            throw new ApiError(409, 'Phone number already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create user + empty medical profile in transaction
        const { user, tokens } = await withTransaction(async (client) => {
            // Insert user
            const userResult = await client.query(
                `INSERT INTO users (name, phone, email, password_hash, role, preferred_language, is_active, is_verified)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
                 RETURNING id, name, phone, email, role, preferred_language, created_at`,
                [name, phone, email || null, passwordHash, role, preferredLanguage]
            );
            const newUser = userResult.rows[0];

            // Create medical profile
            await client.query(
                `INSERT INTO medical_profiles (user_id, blood_group) VALUES ($1, $2)`,
                [newUser.id, bloodGroup || null]
            );

            const tokens = generateTokens(newUser.id, newUser.role);
            return { user: newUser, tokens };
        });

        logger.info('New user registered', { userId: user.id, role: user.role, phone: user.phone });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    preferredLanguage: user.preferred_language,
                },
                tokens,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { phone, password } = req.body;

        // Find user
        const result = await query(
            `SELECT id, name, phone, email, role, password_hash, is_active, preferred_language, fcm_token
             FROM users WHERE phone = $1 AND deleted_at IS NULL`,
            [phone]
        );

        if (result.rows.length === 0) {
            throw new ApiError(401, 'Invalid phone or password');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            throw new ApiError(403, 'Account has been deactivated. Contact support.');
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            throw new ApiError(401, 'Invalid phone or password');
        }

        const tokens = generateTokens(user.id, user.role);

        logger.info('User logged in', { userId: user.id, role: user.role });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role,
                    preferredLanguage: user.preferred_language,
                },
                tokens,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new ApiError(400, 'Refresh token required');

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (decoded.type !== 'refresh') throw new ApiError(401, 'Invalid refresh token');

        // Verify user still exists
        const result = await query(
            'SELECT id, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
            [decoded.userId]
        );
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            throw new ApiError(401, 'User not found or deactivated');
        }

        const tokens = generateTokens(decoded.userId, decoded.role);

        res.json({ success: true, data: { tokens } });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return next(new ApiError(401, 'Invalid or expired refresh token'));
        }
        next(error);
    }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
    try {
        // Blacklist the current access token
        const token = req.token;
        const decoded = jwt.decode(token);
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
            await blacklistToken(token, expiresIn);
        }

        logger.info('User logged out', { userId: req.user.id });
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/fcm-token
 * Update Firebase push notification token
 */
const updateFcmToken = async (req, res, next) => {
    try {
        const { fcmToken } = req.body;
        await query(
            'UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2',
            [fcmToken, req.user.id]
        );
        res.json({ success: true, message: 'FCM token updated' });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login, refresh, logout, updateFcmToken };
