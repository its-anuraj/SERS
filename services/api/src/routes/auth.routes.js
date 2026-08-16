/**
 * Auth Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { register, login, refresh, logout, updateFcmToken, sendOTP, verifyOTP } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// POST /api/auth/send-otp
router.post('/send-otp', [
    body('identifier').trim().notEmpty().withMessage('Mobile number or Email address is required'),
    validate,
], sendOTP);

// POST /api/auth/verify-otp
router.post('/verify-otp', [
    body('identifier').trim().notEmpty().withMessage('Identifier is required'),
    body('otp').trim().notEmpty().isLength({ min: 4, max: 10 }).withMessage('Valid OTP code is required'),
    validate,
], verifyOTP);

// POST /api/auth/register
router.post('/register', [
    body('name').trim().notEmpty().isLength({ min: 2, max: 150 }),
    body('phone').trim().notEmpty().matches(/^\+[1-9]\d{9,14}$/),
    body('password').isLength({ min: 6 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['citizen', 'responder', 'hospital_staff']),
    body('preferredLanguage').optional().isIn(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'mr']),
    validate,
], register);

// POST /api/auth/login
router.post('/login', [
    body('password').notEmpty().withMessage('Password is required'),
    validate,
], login);

// POST /api/auth/refresh
router.post('/refresh', [
    body('refreshToken').notEmpty(),
    validate,
], refresh);

// POST /api/auth/logout (requires auth)
router.post('/logout', authenticate, logout);

// PUT /api/auth/fcm-token
router.put('/fcm-token', authenticate, [
    body('fcmToken').notEmpty(),
    validate,
], updateFcmToken);

module.exports = router;
