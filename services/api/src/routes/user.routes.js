/**
 * User Routes — Profile management
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/users/profile
router.get('/profile', authenticate, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT u.id, u.name, u.phone, u.email, u.role, u.preferred_language,
                    u.abha_id, u.abha_address, u.emergency_consent, u.abdm_linked_at,
                    u.profile_picture_url, u.created_at,
                    mp.blood_group, mp.allergies, mp.medications, mp.conditions,
                    mp.emergency_contacts, mp.is_organ_donor, mp.responder_notes,
                    mp.abdm_synced, mp.abdm_last_sync
             FROM users u
             LEFT JOIN medical_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
});

// PUT /api/users/profile
router.put('/profile', authenticate, [
    body('name').optional().trim().isLength({ min: 2, max: 150 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('preferredLanguage').optional().isIn(['en','hi','kn','ta','te','ml','mr']),
    validate,
], async (req, res, next) => {
    try {
        const { name, email, preferredLanguage } = req.body;
        const updates = [];
        const params = [];
        let idx = 1;

        if (name) { updates.push(`name = $${idx++}`); params.push(name); }
        if (email) { updates.push(`email = $${idx++}`); params.push(email); }
        if (preferredLanguage) { updates.push(`preferred_language = $${idx++}`); params.push(preferredLanguage); }

        if (!updates.length) throw new ApiError(400, 'No fields to update');

        updates.push('updated_at = NOW()');
        params.push(req.user.id);

        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) { next(error); }
});

// PUT /api/users/medical-profile
router.put('/medical-profile', authenticate, [
    body('bloodGroup').optional().isIn(['A+','A-','B+','B-','O+','O-','AB+','AB-']),
    body('allergies').optional().isArray(),
    body('medications').optional().isArray(),
    body('conditions').optional().isArray(),
    body('emergencyContacts').optional().isArray().isLength({ max: 5 }),
    body('isOrganDonor').optional().isBoolean(),
    validate,
], async (req, res, next) => {
    try {
        const { bloodGroup, allergies, medications, conditions, emergencyContacts, isOrganDonor, responderNotes } = req.body;
        const updates = [];
        const params = [];
        let idx = 1;

        if (bloodGroup !== undefined) { updates.push(`blood_group = $${idx++}`); params.push(bloodGroup); }
        if (allergies !== undefined) { updates.push(`allergies = $${idx++}`); params.push(allergies); }
        if (medications !== undefined) { updates.push(`medications = $${idx++}`); params.push(medications); }
        if (conditions !== undefined) { updates.push(`conditions = $${idx++}`); params.push(conditions); }
        if (emergencyContacts !== undefined) { updates.push(`emergency_contacts = $${idx++}`); params.push(JSON.stringify(emergencyContacts)); }
        if (isOrganDonor !== undefined) { updates.push(`is_organ_donor = $${idx++}`); params.push(isOrganDonor); }
        if (responderNotes !== undefined) { updates.push(`responder_notes = $${idx++}`); params.push(responderNotes); }

        if (!updates.length) throw new ApiError(400, 'No fields to update');
        updates.push('updated_at = NOW()');
        params.push(req.user.id);

        await query(`UPDATE medical_profiles SET ${updates.join(', ')} WHERE user_id = $${idx}`, params);
        res.json({ success: true, message: 'Medical profile updated' });
    } catch (error) { next(error); }
});

// PUT /api/users/location — Update last known location
router.put('/location', authenticate, [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    validate,
], async (req, res, next) => {
    try {
        const { lat, lng } = req.body;
        await query(
            'UPDATE users SET last_known_lat = $1, last_known_lng = $2, last_location_update = NOW() WHERE id = $3',
            [lat, lng, req.user.id]
        );
        res.json({ success: true });
    } catch (error) { next(error); }
});

// POST /api/users/attendance/clock-in — Stub for responder attendance
router.post('/attendance/clock-in', authenticate, async (req, res, next) => {
    try {
        // In a real app, this would write to an attendance table or update a duty_status column on the user
        res.json({ success: true, message: 'Attendance marked for duty.' });
    } catch (error) { next(error); }
});

// GET /api/users/:id/medical-profile — For responders/hospitals viewing victim profile
router.get('/:id/medical-profile', authenticate, async (req, res, next) => {
    try {
        // Only responders/hospital staff/admin can view others' profiles
        if (req.params.id !== req.user.id && !['responder','hospital_staff','admin'].includes(req.user.role)) {
            throw new ApiError(403, 'Not authorized to view this profile');
        }

        const result = await query(
            `SELECT u.name, u.phone, mp.blood_group, mp.allergies, mp.medications,
                    mp.conditions, mp.emergency_contacts, mp.is_organ_donor, mp.responder_notes,
                    u.abha_id, u.emergency_consent
             FROM users u LEFT JOIN medical_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1`,
            [req.params.id]
        );
        if (!result.rows.length) throw new ApiError(404, 'User not found');
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
});

module.exports = router;
