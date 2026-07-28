/**
 * Hospital Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
    getNearestHospitals, getHospital, getAvailability, updateCapacity, listHospitals,
    reserveHospitalBed, confirmBedHandshake
} = require('../controllers/hospital.controller');

// GET /api/hospitals — Admin list
router.get('/', authenticate, authorize('admin', 'coordinator'), listHospitals);

// GET /api/hospitals/nearest — Public (with optional auth for personalization)
router.get('/nearest', optionalAuth, getNearestHospitals);

// GET /api/hospitals/:id
router.get('/:id', optionalAuth, getHospital);

// GET /api/hospitals/:id/availability — Real-time capacity
router.get('/:id/availability', optionalAuth, getAvailability);

// POST /api/hospitals/:id/reserve-bed — Lock bed for incoming emergency
router.post('/:id/reserve-bed', authenticate, reserveHospitalBed);

// POST /api/hospitals/:id/confirm-handshake — Hospital staff confirm/reject
router.post('/:id/confirm-handshake', authenticate, authorize('hospital_staff', 'admin'), confirmBedHandshake);

// PUT /api/hospitals/:id/capacity — Hospital staff updates beds
router.put('/:id/capacity', authenticate, authorize('hospital_staff', 'admin'), [
    body('icuBedsAvailable').optional().isInt({ min: 0 }),
    body('erBedsAvailable').optional().isInt({ min: 0 }),
    body('generalBedsAvailable').optional().isInt({ min: 0 }),
    validate,
], updateCapacity);

module.exports = router;

