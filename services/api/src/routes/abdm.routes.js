/**
 * ABDM Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
    initiateAbhaLinking, verifyAbhaOTP, fetchEmergencyHealthRecords, createUnconsciousEmergencyProfile
} = require('../abdm/abdm.service');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/abdm/link-abha — Initiate ABHA linking via Aadhaar OTP
router.post('/link-abha', authenticate, [
    body('aadhaarNumber').matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
    validate,
], async (req, res, next) => {
    try {
        const result = await initiateAbhaLinking(req.body.aadhaarNumber);
        res.json({ success: true, data: result });
    } catch (error) { next(error); }
});

// POST /api/abdm/verify-otp — Complete ABHA linking
router.post('/verify-otp', authenticate, [
    body('otp').isLength({ min: 4, max: 6 }),
    body('txnId').notEmpty(),
    validate,
], async (req, res, next) => {
    try {
        const result = await verifyAbhaOTP(req.user.id, req.body.otp, req.body.txnId);
        res.json({ success: true, data: result });
    } catch (error) { next(error); }
});

// POST /api/abdm/emergency-override — Trauma mode for unconscious victim (No OTP)
router.post('/emergency-override', authenticate, [
    body('incidentId').notEmpty(),
    validate,
], async (req, res, next) => {
    try {
        if (!['responder', 'hospital_staff', 'admin', 'coordinator'].includes(req.user.role)) {
            throw new ApiError(403, 'Not authorized for emergency trauma override');
        }
        const result = await createUnconsciousEmergencyProfile(req.body.incidentId, req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (error) { next(error); }
});

// GET /api/abdm/health-records/:userId — Fetch records for emergency
router.get('/health-records/:userId', authenticate, async (req, res, next) => {
    try {
        // Only responders/hospital staff/admin can fetch patient records
        if (!['responder', 'hospital_staff', 'admin', 'coordinator'].includes(req.user.role)) {
            throw new ApiError(403, 'Not authorized to fetch health records');
        }
        const { incidentId } = req.query;
        const result = await fetchEmergencyHealthRecords(req.params.userId, incidentId);
        res.json({ success: true, data: result });
    } catch (error) { next(error); }
});

// PUT /api/abdm/emergency-consent — Toggle emergency pre-authorization
router.put('/emergency-consent', authenticate, [
    body('consent').isBoolean(),
    validate,
], async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        await query(
            'UPDATE users SET emergency_consent = $1, updated_at = NOW() WHERE id = $2',
            [req.body.consent, req.user.id]
        );
        res.json({ success: true, message: `Emergency consent ${req.body.consent ? 'granted' : 'revoked'}` });
    } catch (error) { next(error); }
});

// GET /api/abdm/gateway-health — Live NHA Gateway Diagnostic & Health Check
router.get('/gateway-health', async (req, res, _next) => {
    try {
        const { getGatewayToken } = require('../abdm/abdm.service');
        const token = await getGatewayToken();
        const mode = process.env.ABDM_CLIENT_ID ? 'PRODUCTION_SANDBOX' : 'MOCK_SIMULATOR';

        res.json({
            success: true,
            gatewayStatus: 'ACTIVE',
            integrationMode: mode,
            targetGatewayUrl: process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway',
            tokenActive: !!token,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            gatewayStatus: 'DEGRADED',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/abdm/status — Check ABDM linking status for current user
router.get('/status', authenticate, async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        const result = await query(
            'SELECT abha_id, abha_address, emergency_consent, abdm_linked_at FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
});

module.exports = router;


