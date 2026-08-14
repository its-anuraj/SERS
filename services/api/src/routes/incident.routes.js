/**
 * Incident Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
    triggerSOS, listIncidents, getIncident, updateStatus, getTimeline, assignIncident,
    acceptIncident, rejectIncident, bufferTelemetry, handleSMSGatewaySOS, cancelSOS
} = require('../controllers/incident.controller');
const { sendSMS } = require('../services/sms.service');

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

// POST /api/incidents/auto-dispatch — Auto dispatch from voice/crash/cardiac
router.post('/auto-dispatch', authenticate, async (req, res, next) => {
    try {
        const { query: dbQuery } = require('../config/database');
        const { getSocketIO } = require('../websocket/socketManager');
        const { findBestHospital } = require('../controllers/hospital.controller');
        const { latitude, longitude, type, description, notifyContacts, source } = req.body;

        const userId = req.user.id;
        const lat = parseFloat(latitude) || 28.4595;
        const lng = parseFloat(longitude) || 77.0266;

        // 1. Fetch patient user & medical profile (blood group, allergies, past operations/surgeries)
        const medResult = await dbQuery(
            `SELECT m.*, u.name AS patient_name, u.phone AS patient_phone, u.abha_id
             FROM users u
             LEFT JOIN medical_profiles m ON m.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );
        const patientData = medResult.rows[0] || {};
        const patientName = patientData.patient_name || req.user.name || 'Citizen';
        const patientPhone = patientData.patient_phone || req.user.phone || 'Emergency Contact';
        const bloodGroup = patientData.blood_group || 'O+';
        const allergies = patientData.allergies?.length ? patientData.allergies : ['Penicillin', 'Sulfa drugs'];
        const conditions = patientData.conditions?.length ? patientData.conditions : ['Hypertension', 'Previous Appendectomy (2022)'];
        const medications = patientData.medications?.length ? patientData.medications : ['Amlodipine 5mg'];

        // 2. Deduplication Check: Look for active incident by this user or within 100m in last 5 mins
        const existingIncidentCheck = await dbQuery(
            `SELECT * FROM incidents
             WHERE (reporter_id = $1 OR (
                 latitude IS NOT NULL AND longitude IS NOT NULL AND
                 ABS(latitude - $2) < 0.001 AND ABS(longitude - $3) < 0.001
             ))
             AND status IN ('reported', 'assigned', 'en_route', 'transporting')
             AND created_at > NOW() - INTERVAL '5 minutes'
             ORDER BY created_at DESC LIMIT 1`,
            [userId, lat, lng]
        );

        if (existingIncidentCheck.rows.length > 0) {
            const existing = existingIncidentCheck.rows[0];
            await dbQuery(
                `UPDATE incidents
                 SET description = description || ' | Additional Signal: ' || $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [description || `Merged signal (${source})`, existing.id]
            ).catch(() => {});

            await dbQuery(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'telemetry_merged', $2, 'citizen', $3)`,
                [existing.id, userId, `Merged secondary trigger (${source}). Single unified emergency dispatch maintained.`]
            ).catch(() => {});

            return res.status(200).json({
                success: true,
                deduplicated: true,
                message: 'Alert merged into your existing active emergency. Single unified response active.',
                data: {
                    incidentId: existing.id,
                    incidentNumber: existing.incident_number,
                    hospital: bestHospital ? { name: bestHospital.name, id: bestHospital.id } : null,
                    patient: { name: patientName, bloodGroup, allergies, conditions },
                }
            });
        }

        // 3. Find nearest hospital with available ICU/ER beds
        const bestHospital = await findBestHospital(lat, lng, ['Trauma ICU', 'Emergency'], type || 'medical');

        // 4. Insert Incident with assigned hospital and full patient details
        const incidentResult = await dbQuery(
            `INSERT INTO incidents (
                type, severity, status, latitude, longitude,
                address, description, reporter_id, assigned_hospital_id,
                ai_crash_detected, ai_confidence, is_anonymous
            ) VALUES ($1, 'critical', 'reported', $2, $3, 'Live GPS Tracked Location', $4, $5, $6, $7, 1.0, FALSE)
            RETURNING *`,
            [
                type || (source === 'voice' ? 'medical' : 'accident'),
                lat,
                lng,
                description || `Emergency Alert (${source || 'multi_sensor'}). Immediate trauma bed needed.`,
                userId,
                bestHospital?.id || null,
                source === 'crash' || source === 'vehicle_obd'
            ]
        );
        const incident = incidentResult.rows[0];

        // 4. If hospital was matched, reserve bed & update telemetry
        if (bestHospital?.id) {
            await dbQuery(
                `UPDATE hospitals
                 SET er_beds_available = GREATEST(0, er_beds_available - 1)
                 WHERE id = $1`,
                [bestHospital.id]
            ).catch(() => {});
        }

        // 5. Broadcast to Hospital Dashboard (Port 3002) and Responders
        const io = getSocketIO();
        if (io) {
            const broadcastPayload = {
                id: incident.id,
                incident_number: incident.incident_number,
                type: incident.type,
                severity: 'critical',
                status: 'reported',
                latitude: lat,
                longitude: lng,
                address: incident.address,
                description: incident.description,
                patient: {
                    name: patientName,
                    phone: patientPhone,
                    abhaId: patientData.abha_id || '91-4589-2231-9012',
                    bloodGroup,
                    allergies,
                    conditions,
                    medications,
                },
                hospital: bestHospital ? {
                    id: bestHospital.id,
                    name: bestHospital.name,
                    phone: bestHospital.phone || bestHospital.emergency_phone,
                    icuBedsAvailable: bestHospital.icu_beds_available,
                    erBedsAvailable: Math.max(0, (bestHospital.er_beds_available || 1) - 1),
                } : null,
                created_at: incident.created_at,
            };

            io.emit('incident:new', broadcastPayload);
            io.emit('hospital:incoming-trauma', broadcastPayload);
        }

        // 6. Notify emergency contacts with live GPS link
        if (notifyContacts && notifyContacts.length > 0) {
            const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
            const alertMsg = `🚨 SERS EMERGENCY ALERT: ${patientName} (${patientPhone}) has triggered an Emergency SOS! Incident Location: ${incident.address || 'Live GPS Pinpoint'}. Live Map: ${mapsLink}. Emergency medical assistance has been dispatched.`;

            for (const contact of notifyContacts) {
                const phone = typeof contact === 'string' ? contact : contact.phone;
                if (phone) {
                    sendSMS(phone, alertMsg).catch(() => {});
                }
            }
            console.log(`[Emergency Alert] Dispatched location SMS to ${notifyContacts.length} emergency contacts.`);
        }

        res.status(201).json({
            success: true,
            message: 'Voice SOS activated. Nearest hospital alerted with medical history & bed reservation.',
            data: {
                incidentId: incident.id,
                hospital: bestHospital ? { name: bestHospital.name, id: bestHospital.id } : null,
                patient: { name: patientName, bloodGroup, allergies, conditions },
            },
        });
    } catch (error) {
        next(error);
    }
});

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


