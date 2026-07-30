/**
 * Incident Routes
 */

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
    triggerSOS, listIncidents, getIncident, updateStatus, getTimeline, assignIncident,
    acceptIncident, rejectIncident, bufferTelemetry, handleSMSGatewaySOS, cancelSOS
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

// POST /api/incidents/telemetry — Pre-impact sensor buffering
router.post('/telemetry', bufferTelemetry);

// POST /api/incidents/sms-gateway — Ingest offline SMS payloads
router.post('/sms-gateway', handleSMSGatewaySOS);

// POST /api/incidents/:id/cancel — False alarm cancellation
router.post('/:id/cancel', authenticate, cancelSOS);


// GET /api/incidents
router.get('/', authenticate, listIncidents);

// GET /api/incidents/:id
router.get('/:id', authenticate, getIncident);

// GET /api/incidents/:id/timeline
router.get('/:id/timeline', authenticate, getTimeline);

// POST /api/incidents/:id/assign — Responder self-assigns to an incident
router.post('/:id/assign', authenticate, authorize('responder'), assignIncident);

// POST /api/incidents/:id/accept — Responder accepts dispatch assignment
router.post('/:id/accept', authenticate, authorize('responder'), acceptIncident);

// POST /api/incidents/:id/reject — Responder declines dispatch assignment
router.post('/:id/reject', authenticate, authorize('responder'), rejectIncident);

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

// POST /api/incidents/cad-webhook — Direct Webhook Integration for 108 Government Emergency CAD Software
router.post('/cad-webhook', async (req, res, next) => {
    try {
        const { cadIncidentId, latitude, longitude, emergencyType, callerNumber, priority } = req.body;
        const { query: dbQuery } = require('../config/database');
        const { getSocketIO } = require('../websocket/socketManager');
        const logger = require('../config/logger');

        logger.info('108 CAD Webhook Ingested', { cadIncidentId, emergencyType });

        const result = await dbQuery(
            `INSERT INTO incidents (
                type, severity, status, latitude, longitude,
                address, description, is_anonymous
            ) VALUES ($1, $2, 'reported', $3, $4, '108 CAD Dispatch Relay', $5, TRUE)
            RETURNING *`,
            [
                emergencyType || 'accident',
                priority === 'HIGH' ? 'critical' : 'moderate',
                latitude || 0.0, longitude || 0.0,
                `108 CAD Emergency #${cadIncidentId || 'EXT'}. Caller: ${callerNumber || 'N/A'}`
            ]
        );

        const incident = result.rows[0];
        const io = getSocketIO();
        if (io) {
            io.to('responders').emit('incident:new', {
                ...incident,
                cadIntegration: true,
                cadId: cadIncidentId,
            });
        }

        res.status(201).json({
            success: true,
            message: 'Incident ingested into SERS via 108 CAD Webhook',
            sersIncidentId: incident.id,
            incidentNumber: incident.incident_number,
        });
    } catch (error) { next(error); }
});

// POST /api/incidents/web-sos — Secured public web-based SOS
router.post('/web-sos', [
    body('type').optional().isIn(['accident','medical','fire','cardiac','drowning','fall','assault','other']),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('caller_phone').optional().matches(/^\+?[1-9]\d{9,14}$/).withMessage('Valid phone number format required'),
    validate,
], async (req, res, next) => {
    try {
        const { query: dbQuery } = require('../config/database');
        const { getSocketIO } = require('../websocket/socketManager');
        const { sendSMS } = require('../services/sms.service');
        const logger = require('../config/logger');

        const {
            type = 'other',
            latitude = null,
            longitude = null,
            description = '',
            landmark = '',
            manual_address = '',
            caller_phone = '',
            source = 'web',
            vitals = null,
            telemetry = null,
        } = req.body;

        const lat = latitude || 0.0;
        const lng = longitude || 0.0;

        const { calculateCrashConfidence } = require('../services/afdp.service');
        const afdpResult = telemetry ? calculateCrashConfidence(telemetry) : null;

        const vitalsSummary = vitals ? ` · Smartwatch HR: ${vitals.bpm} BPM (${vitals.pulseStatus})` : '';
        const afdpSummary = afdpResult ? ` · AFDP v2 Score: ${(afdpResult.confidenceScore * 100).toFixed(0)}% (${afdpResult.tier})` : '';

        // Create incident
        const result = await dbQuery(
            `INSERT INTO incidents (
                type, severity, status,
                latitude, longitude, address, landmark,
                description, reporter_id, is_anonymous
            ) VALUES ($1, $2, 'reported', $3, $4, $5, $6, $7, NULL, TRUE)
            RETURNING id, incident_number, type, status, created_at`,
            [
                type,
                afdpResult?.tier === 'INSTANT_DISPATCH' || vitals?.isEmergency ? 'critical' : 'unknown',
                lat, lng,
                manual_address, landmark || manual_address,
                (description || `Web SOS — ${type}${caller_phone ? ` · Callback: ${caller_phone}` : ''}`) + vitalsSummary + afdpSummary,
            ]
        );
        const incident = result.rows[0];

        // Log creation event
        await dbQuery(
            `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
             VALUES ($1, 'created', NULL, 'citizen', $2)`,
            [incident.id, `Web SOS submitted from browser (source: ${source})${vitalsSummary}${afdpSummary}`]
        );

        // Broadcast to responders & admin command center with vitals and AFDP v2 telemetry
        const io = getSocketIO();
        if (io) {
            io.to('responders').emit('incident:new', {
                ...incident,
                webSos: true,
                callerPhone: caller_phone,
                manualAddress: manual_address,
                vitals: vitals,
                telemetry: telemetry,
                afdpResult: afdpResult,
            });
        }

        logger.info('Web SOS triggered', { incidentId: incident.id, type, lat: latitude, lng: longitude });

        if (caller_phone) {
            sendSMS(caller_phone,
                `SERS: Your emergency (${incident.incident_number}) has been registered. Help is on the way.`
            ).catch(() => {});
        }

        res.status(201).json({
            success: true,
            data: {
                incident_number: incident.incident_number,
                id: incident.id,
                status: incident.status,
                message: 'Emergency registered. Responders have been alerted.',
            },
        });
    } catch (error) { next(error); }
});

module.exports = router;


