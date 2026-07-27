/**
 * Incident Routes
 */

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
    triggerSOS, listIncidents, getIncident, updateStatus, getTimeline, assignIncident
} = require('../controllers/incident.controller');

// POST /api/incidents/sos — SOS trigger (citizen + responder)
router.post('/sos', authenticate, [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('type').optional().isIn(['accident','medical','fire','cardiac','drowning','fall','assault','other']),
    body('aiCrashDetected').optional().isBoolean(),
    body('aiSeverityScore').optional().isFloat({ min: 0, max: 10 }),
    validate,
], triggerSOS);

// GET /api/incidents
router.get('/', authenticate, listIncidents);

// GET /api/incidents/:id
router.get('/:id', authenticate, getIncident);

// GET /api/incidents/:id/timeline
router.get('/:id/timeline', authenticate, getTimeline);

// POST /api/incidents/:id/assign — Responder self-assigns to an incident
router.post('/:id/assign', authenticate, authorize('responder'), assignIncident);

// PUT /api/incidents/:id/status — Admin/coordinator/hospital_staff update
router.put('/:id/status', authenticate, authorize('responder','hospital_staff','admin','coordinator'), [
    body('status').isIn(['en_route','arrived','transporting','resolved','cancelled','false_alarm','assigned']),
    validate,
], updateStatus);

// PATCH /api/incidents/:id/status — Alias used by mobile responder app
router.patch('/:id/status', authenticate, authorize('responder','hospital_staff','admin','coordinator'), [
    body('status').isIn(['en_route','arrived','transporting','resolved','cancelled','false_alarm','assigned']),
    validate,
], updateStatus);

module.exports = router;

