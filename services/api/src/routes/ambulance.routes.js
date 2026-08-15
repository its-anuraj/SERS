/**
 * Ambulance Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { listAmbulances, trackAmbulance, updateLocation, getAmbulance, createAmbulance, updateAmbulanceStatus } = require('../controllers/ambulance.controller');

// GET /api/ambulances — Admin/Coordinator fleet view
router.get('/', optionalAuth, listAmbulances);

// POST /api/ambulances — Register ambulance (admin or hospital setup)
router.post('/', optionalAuth, createAmbulance);

// PATCH /api/ambulances/:id/status — Update ambulance duty status
router.patch('/:id/status', authenticate, updateAmbulanceStatus);

// GET /api/ambulances/track/:id — Live tracking (citizen can track their assigned ambulance)
router.get('/track/:id', authenticate, trackAmbulance);

// GET /api/ambulances/:id
router.get('/:id', authenticate, getAmbulance);

// POST /api/ambulances/:id/location — Responder posts GPS updates
router.post('/:id/location', authenticate, authorize('responder', 'admin'), [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('speedKmh').optional().isFloat({ min: 0 }),
    validate,
], updateLocation);

module.exports = router;
