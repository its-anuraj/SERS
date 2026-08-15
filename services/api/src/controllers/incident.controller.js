/**
 * Incident Controller — The heart of SERS
 * Handles SOS triggers, status updates, assignment, and queries
 */

const { query, withTransaction } = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const { getSocketIO } = require('../websocket/socketManager');
const logger = require('../config/logger');
const { findNearestAvailableAmbulance } = require('./ambulance.controller');
const { findBestHospital } = require('./hospital.controller');
const { sendSMS } = require('../services/sms.service');
const { calculateCrashConfidence } = require('../services/afdp.service');

/**
 * POST /api/incidents/sos
 * Primary SOS trigger — creates incident, auto-assigns ambulance
 */
const triggerSOS = async (req, res, next) => {
    try {
        const {
            latitude, longitude,
            type = 'other',
            description = '',
            landmark = '',
            aiCrashDetected = false,
            aiSeverityScore = null,
            aiConfidence = null,
            maxMagnitude,
            preImpactSpeedKmh,
            postImpactSpeedKmh,
            speedDropKmh,
            bluetoothConnected,
            audioCrashScore,
        } = req.body;

        const reporterId = req.user?.id || 'b0000000-0000-0000-0000-000000000001';

        // AFDP Confidence Calculation
        const afdpResult = calculateCrashConfidence({
            maxMagnitude: maxMagnitude || (aiCrashDetected ? 28 : 0),
            preImpactSpeedKmh: preImpactSpeedKmh || 0,
            postImpactSpeedKmh: postImpactSpeedKmh || 0,
            speedDropKmh: speedDropKmh || 0,
            bluetoothConnected: bluetoothConnected !== false,
            audioCrashScore: audioCrashScore || 0.5,
            aiSeverityScore: aiSeverityScore || 5,
        });

        // Filter out accidental drops (Confidence < 0.40)
        if (aiCrashDetected && afdpResult.tier === 'AUTO_CANCELLED') {
            logger.info('SOS auto-cancelled by AFDP filter (Phone drop / Accidental noise)', {
                reporterId,
                afdpResult,
            });
            return res.status(200).json({
                success: true,
                autoCancelled: true,
                message: 'Event filtered: Phone drop or accidental movement detected. Emergency dispatch cancelled.',
                data: { afdpResult },
            });
        }

        // 0. Deduplication Check: Look for active incident within 100 meters reported in last 5 mins
        const nearbyExisting = await query(
            `SELECT id, incident_number, severity FROM incidents
             WHERE status NOT IN ('resolved', 'cancelled', 'false_alarm')
               AND created_at > NOW() - INTERVAL '5 minutes'
               AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 100)
             LIMIT 1`,
            [longitude, latitude]
        );

        if (nearbyExisting.rows.length > 0) {
            const existing = nearbyExisting.rows[0];
            logger.info('SOS deduplicated — linked to active nearby emergency', {
                existingIncidentId: existing.id,
                reporterId,
            });

            await query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'updated', $2, $3, $4)`,
                [existing.id, reporterId, req.user.role, `Additional SOS report received nearby for this crash scene.`]
            );

            return res.status(200).json({
                success: true,
                deduplicated: true,
                message: 'SOS linked to active nearby emergency dispatch.',
                data: {
                    incidentId: existing.id,
                    incidentNumber: existing.incident_number,
                    status: 'assigned',
                },
            });
        }

        const incident = await withTransaction(async (client) => {
            // 1. Create the incident
            const incidentResult = await client.query(
                `INSERT INTO incidents (
                    type, severity, status, latitude, longitude,
                    address, landmark, reporter_id,
                    ai_crash_detected, ai_severity_score, ai_confidence,
                    description
                ) VALUES ($1, $2, 'reported', $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    type,
                    aiSeverityScore >= 7 ? 'critical' : aiSeverityScore >= 4 ? 'moderate' : 'minor',
                    latitude, longitude,
                    '', // address (reverse geocode async)
                    landmark, reporterId,
                    aiCrashDetected, aiSeverityScore, aiConfidence,
                    description,
                ]
            );
            const incident = incidentResult.rows[0];

            // 2. Log creation event
            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'created', $2, $3, $4)`,
                [incident.id, reporterId, req.user.role,
                    `Incident reported via ${aiCrashDetected ? 'AI crash detection' : 'SOS button'}`]
            );

            return incident;
        });

        logger.info('SOS triggered', {
            incidentId: incident.id,
            reporterId,
            lat: latitude,
            lng: longitude,
            aiDetected: aiCrashDetected,
        });

        // 3. Broadcast to all responders via Socket.io (async)
        const io = getSocketIO();
        if (io) {
            io.to('responders').emit('incident:new', {
                id: incident.id,
                incidentNumber: incident.incident_number,
                type: incident.type,
                severity: incident.severity,
                latitude,
                longitude,
                landmark,
                description,
                aiCrashDetected,
                reportedAt: incident.created_at,
            });
        }

        // 4. Auto-assign nearest ambulance (async, don't block response)
        autoAssignAmbulance(incident.id, latitude, longitude).catch(err =>
            logger.error('Auto-assign failed', { incidentId: incident.id, error: err.message })
        );

        // 5. Alert emergency contacts (async)
        alertEmergencyContacts(req.user.id, incident.id, latitude, longitude).catch(err =>
            logger.error('Emergency contact alert failed', { error: err.message })
        );

        res.status(201).json({
            success: true,
            message: 'SOS triggered. Help is on the way.',
            data: {
                incidentId: incident.id,
                incidentNumber: incident.incident_number,
                status: incident.status,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Auto-assign nearest available ambulance to an incident
 */
const autoAssignAmbulance = async (incidentId, latitude, longitude) => {
    try {
        let ambulance = null;
        let hospital = null;

        await withTransaction(async (client) => {
            // Find nearest available ambulance using PostGIS row locking
            ambulance = await findNearestAvailableAmbulance(latitude, longitude, 15000, client);
            if (!ambulance) {
                logger.warn('No available ambulances for incident', { incidentId });
                return;
            }

            // Find best hospital
            hospital = await findBestHospital(latitude, longitude);

            // Assign ambulance + hospital to incident
            await client.query(
                `UPDATE incidents SET
                    assigned_ambulance_id = $1,
                    assigned_responder_id = $2,
                    assigned_hospital_id = $3,
                    status = 'assigned',
                    updated_at = NOW()
                 WHERE id = $4`,
                [ambulance.id, ambulance.driver_id, hospital?.id || null, incidentId]
            );

            // Update ambulance status
            await client.query(
                `UPDATE ambulances SET status = 'en_route', updated_at = NOW() WHERE id = $1`,
                [ambulance.id]
            );

            // Log assignment event
            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, description, metadata)
                 VALUES ($1, 'assigned', $2, $3)`,
                [
                    incidentId,
                    `Ambulance ${ambulance.registration_number} assigned. ${hospital ? `Destination: ${hospital.name}` : ''}`,
                    JSON.stringify({ ambulanceId: ambulance.id, hospitalId: hospital?.id })
                ]
            );
        });

        if (!ambulance) return;

        // Notify assigned responder via Socket.io
        const io = getSocketIO();
        if (io && ambulance.driver_id) {
            io.to(`user:${ambulance.driver_id}`).emit('incident:assigned', {
                incidentId,
                latitude,
                longitude,
                hospital: hospital ? { id: hospital.id, name: hospital.name, lat: hospital.latitude, lng: hospital.longitude } : null,
            });
        }

        logger.info('Ambulance auto-assigned', {
            incidentId,
            ambulanceId: ambulance.id,
            hospitalId: hospital?.id,
        });

        // Schedule driver acceptance timeout cascade (30 seconds)
        scheduleDriverReassignment(incidentId, ambulance.id, latitude, longitude, 30000);
    } catch (error) {
        logger.error('autoAssignAmbulance error', { incidentId, error: error.message });
    }
};

/**
 * 30-Second Timeout Cascade for Driver Response
 */
const scheduleDriverReassignment = (incidentId, ambulanceId, latitude, longitude, timeoutMs = 30000) => {
    setTimeout(async () => {
        try {
            const check = await query(
                `SELECT status, assigned_ambulance_id FROM incidents WHERE id = $1`,
                [incidentId]
            );
            if (!check.rows.length) return;
            const inc = check.rows[0];

            // If still in 'assigned' status with same ambulance, driver did not accept in time
            if (inc.status === 'assigned' && inc.assigned_ambulance_id === ambulanceId) {
                logger.warn('Driver response timeout. Triggering auto-reassignment cascade...', { incidentId, ambulanceId });

                await withTransaction(async (client) => {
                    // Release un-responsive ambulance back to available
                    await client.query(
                        `UPDATE ambulances SET status = 'available', updated_at = NOW() WHERE id = $1`,
                        [ambulanceId]
                    );

                    // Reset incident assignment
                    await client.query(
                        `UPDATE incidents SET assigned_ambulance_id = NULL, assigned_responder_id = NULL, status = 'reported', updated_at = NOW() WHERE id = $1`,
                        [incidentId]
                    );

                    // Log event
                    await client.query(
                        `INSERT INTO incident_events (incident_id, event_type, description)
                         VALUES ($1, 'driver_timeout', 'Assigned driver did not respond within 30 seconds. Re-routing dispatch.')`,
                        [incidentId]
                    );
                });

                // Cascade: Auto-assign next nearest available ambulance
                await autoAssignAmbulance(incidentId, latitude, longitude);
            }
        } catch (err) {
            logger.error('scheduleDriverReassignment error', { incidentId, error: err.message });
        }
    }, timeoutMs);
};

/**
 * POST /api/incidents/:id/accept — Responder accepts assignment
 */
const acceptIncident = async (req, res, next) => {
    try {
        const { id } = req.params;

        await withTransaction(async (client) => {
            await client.query(
                `UPDATE incidents SET status = 'en_route', updated_at = NOW() WHERE id = $1`,
                [id]
            );

            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'status_change', $2, $3, 'Driver accepted emergency dispatch')`,
                [id, req.user?.id || null, req.user?.role || 'responder']
            );
        });

        const io = getSocketIO();
        if (io) {
            io.to(`incident:${id}`).emit('incident:status', { incidentId: id, status: 'en_route' });
        }

        res.json({ success: true, message: 'Dispatch accepted successfully' });
    } catch (error) { next(error); }
};

/**
 * POST /api/incidents/:id/reject — Responder declines assignment
 */
const rejectIncident = async (req, res, next) => {
    try {
        const { id } = req.params;

        const incRes = await query(`SELECT latitude, longitude, assigned_ambulance_id FROM incidents WHERE id = $1`, [id]);
        if (!incRes.rows.length) throw new ApiError(404, 'Incident not found');
        const { latitude, longitude, assigned_ambulance_id } = incRes.rows[0];

        await withTransaction(async (client) => {
            if (assigned_ambulance_id) {
                await client.query(`UPDATE ambulances SET status = 'available', updated_at = NOW() WHERE id = $1`, [assigned_ambulance_id]);
            }
            await client.query(
                `UPDATE incidents SET assigned_ambulance_id = NULL, assigned_responder_id = NULL, status = 'reported', updated_at = NOW() WHERE id = $1`,
                [id]
            );
            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'driver_rejected', $2, $3, 'Driver declined dispatch. Re-routing emergency dispatch.')`,
                [id, req.user?.id || null, req.user?.role || 'responder']
            );
        });

        // Trigger immediate auto-assign to next nearest ambulance
        autoAssignAmbulance(id, parseFloat(latitude), parseFloat(longitude)).catch(() => {});

        res.json({ success: true, message: 'Dispatch declined. Re-routing emergency response.' });
    } catch (error) { next(error); }
};

/**
 * Alert emergency contacts via SMS + push
 */
const alertEmergencyContacts = async (userId, incidentId, latitude, longitude) => {
    const result = await query(
        `SELECT mp.emergency_contacts, u.name
         FROM medical_profiles mp JOIN users u ON u.id = mp.user_id
         WHERE mp.user_id = $1`,
        [userId]
    );
    if (!result.rows.length) return;

    const { emergency_contacts, name } = result.rows[0];
    const contacts = Array.isArray(emergency_contacts) ? emergency_contacts : [];
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
    const message = `🚨 SERS ALERT: ${name} has triggered an emergency SOS. Location: ${mapsLink}. Please check on them immediately.`;

    for (const contact of contacts.slice(0, 5)) {
        if (contact.phone) {
            sendSMS(contact.phone, message).catch(() => {});
        }
    }
};

/**
 * GET /api/incidents
 * List incidents (role-filtered)
 */
const listIncidents = async (req, res, next) => {
    try {
        const { status, type, limit = 50, offset = 0, lat, lng, radius = 10000 } = req.query;
        const user = req.user || { role: 'admin' };

        let baseQuery = `SELECT i.*, 
            u.name AS reporter_name, u.phone AS reporter_phone,
            r.name AS responder_name,
            h.name AS hospital_name,
            a.registration_number AS ambulance_reg
         FROM incidents i
         LEFT JOIN users u ON i.reporter_id = u.id
         LEFT JOIN users r ON i.assigned_responder_id = r.id
         LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
         LEFT JOIN ambulances a ON i.assigned_ambulance_id = a.id
         WHERE 1=1`;

        const params = [];
        let paramIdx = 1;

        // Role-based filtering
        const { assignedToMe } = req.query;
        if (user.role === 'citizen') {
            baseQuery += ` AND i.reporter_id = $${paramIdx++}`;
            params.push(user.id);
        } else if (user.role === 'responder') {
            if (assignedToMe === 'true') {
                // Only incidents assigned to this responder that are still active
                baseQuery += ` AND i.assigned_responder_id = $${paramIdx++} AND i.status NOT IN ('resolved','cancelled','false_alarm')`;
                params.push(user.id);
            } else {
                baseQuery += ` AND (i.assigned_responder_id = $${paramIdx++} OR i.status = 'reported')`;
                params.push(user.id);
            }
        }

        if (status) {
            baseQuery += ` AND i.status = $${paramIdx++}`;
            params.push(status);
        }
        if (type) {
            baseQuery += ` AND i.type = $${paramIdx++}`;
            params.push(type);
        }

        // Geo filter
        if (lat && lng) {
            baseQuery += ` AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint($${paramIdx++}, $${paramIdx++}), 4326)::geography, $${paramIdx++})`;
            params.push(parseFloat(lng), parseFloat(lat), parseFloat(radius));
        }

        baseQuery += ` ORDER BY i.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await query(baseQuery, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: { limit: parseInt(limit), offset: parseInt(offset), count: result.rows.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/incidents/:id
 */
const getIncident = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT i.*,
                u.name AS reporter_name, u.phone AS reporter_phone,
                r.name AS responder_name, r.phone AS responder_phone,
                h.name AS hospital_name, h.emergency_phone AS hospital_phone,
                h.latitude AS hospital_lat, h.longitude AS hospital_lng,
                a.registration_number AS ambulance_reg,
                a.current_lat AS ambulance_lat, a.current_lng AS ambulance_lng,
                a.driver_id AS driver_id
             FROM incidents i
             LEFT JOIN users u ON i.reporter_id = u.id
             LEFT JOIN users r ON i.assigned_responder_id = r.id
             LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
             LEFT JOIN ambulances a ON i.assigned_ambulance_id = a.id
             WHERE i.id = $1`,
            [id]
        );
        if (!result.rows.length) throw new ApiError(404, 'Incident not found');

        // Get event timeline
        const events = await query(
            `SELECT ie.*, u.name AS actor_name
             FROM incident_events ie
             LEFT JOIN users u ON ie.actor_id = u.id
             WHERE ie.incident_id = $1
             ORDER BY ie.timestamp ASC`,
            [id]
        );

        res.json({
            success: true,
            data: { ...result.rows[0], timeline: events.rows },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/incidents/:id/status
 * Update incident status (responder/admin/hospital)
 */
const updateStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes, responderNotes } = req.body;

        const userRole = req.user?.role || 'admin';
        const userId = req.user?.id || 'b0000000-0000-0000-0000-000000000006';

        const validTransitions = {
            responder: ['en_route', 'arrived', 'transporting', 'resolved'],
            hospital_staff: ['resolved'],
            admin: ['assigned', 'en_route', 'arrived', 'transporting', 'resolved', 'cancelled', 'false_alarm'],
            coordinator: ['assigned', 'en_route', 'arrived', 'transporting', 'resolved', 'cancelled', 'false_alarm'],
        };

        const allowed = validTransitions[userRole] || [];
        if (!allowed.includes(status)) {
            throw new ApiError(403, `Role '${userRole}' cannot set status to '${status}'`);
        }

        await withTransaction(async (client) => {
            const updateFields = ['status = $1', 'updated_at = NOW()'];
            const params = [status];
            let idx = 2;

            if (status === 'resolved') {
                updateFields.push(`resolved_at = NOW()`);
            }
            if (responderNotes) {
                updateFields.push(`responder_notes = $${idx++}`);
                params.push(responderNotes);
            }
            params.push(id);

            await client.query(
                `UPDATE incidents SET ${updateFields.join(', ')} WHERE id = $${idx}`,
                params
            );

            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'status_change', $2, $3, $4)`,
                [id, userId, userRole, notes || `Status updated to ${status}`]
            );

            // If resolved, free up ambulance
            if (status === 'resolved' || status === 'false_alarm') {
                await client.query(
                    `UPDATE ambulances SET status = 'available', updated_at = NOW()
                     WHERE id = (SELECT assigned_ambulance_id FROM incidents WHERE id = $1)`,
                    [id]
                );
            }
        });

        // Broadcast status change via Socket.io
        const io = getSocketIO();
        if (io) {
            io.to(`incident:${id}`).emit('incident:status', { incidentId: id, status, updatedBy: req.user.id });
        }

        res.json({ success: true, message: `Incident status updated to ${status}` });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/incidents/:id/timeline
 */
const getTimeline = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT ie.*, u.name AS actor_name, u.role AS actor_role_name
             FROM incident_events ie
             LEFT JOIN users u ON ie.actor_id = u.id
             WHERE ie.incident_id = $1
             ORDER BY ie.timestamp ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/incidents/:id/assign
 * Responder self-assigns to an open incident
 */
const assignIncident = async (req, res, next) => {
    try {
        const { id } = req.params;
        const responderId = req.user.id;

        // Fetch incident
        const incidentResult = await query(
            `SELECT i.*, a.id AS ambulance_id, a.registration_number
             FROM incidents i
             LEFT JOIN ambulances a ON a.driver_id = $1 AND a.is_active = TRUE
             WHERE i.id = $2`,
            [responderId, id]
        );
        if (!incidentResult.rows.length) throw new ApiError(404, 'Incident not found');

        const incident = incidentResult.rows[0];
        if (!['reported', 'assigned'].includes(incident.status)) {
            throw new ApiError(409, `Cannot assign to incident with status '${incident.status}'`);
        }

        const ambulanceId = incident.ambulance_id || null;

        await withTransaction(async (client) => {
            await client.query(
                `UPDATE incidents SET
                    assigned_responder_id = $1,
                    assigned_ambulance_id = COALESCE($2, assigned_ambulance_id),
                    status = 'assigned',
                    updated_at = NOW()
                 WHERE id = $3`,
                [responderId, ambulanceId, id]
            );

            if (ambulanceId) {
                await client.query(
                    `UPDATE ambulances SET status = 'en_route', updated_at = NOW() WHERE id = $1`,
                    [ambulanceId]
                );
            }

            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'assigned', $2, 'responder', $3)`,
                [id, responderId, `Responder self-assigned to incident.`]
            );
        });

        // Broadcast update
        const io = getSocketIO();
        if (io) {
            io.to(`incident:${id}`).emit('incident:status', { incidentId: id, status: 'assigned', updatedBy: responderId });
        }

        res.json({ success: true, message: 'Incident assigned successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/incidents/telemetry
 * Buffers continuous pre-impact telemetry to prevent data loss if device dies on impact
 */
const telemetryBuffer = new Map();

const bufferTelemetry = async (req, res, next) => {
    try {
        const { deviceId, latitude, longitude, speedKmh, accelMagnitude } = req.body;
        if (!deviceId) throw new ApiError(400, 'deviceId is required');

        const frame = {
            timestamp: Date.now(),
            lat: latitude,
            lng: longitude,
            speedKmh: speedKmh || 0,
            accelMagnitude: accelMagnitude || 0,
        };

        const existing = telemetryBuffer.get(deviceId) || [];
        existing.push(frame);
        // Keep last 10 frames (rolling window)
        if (existing.length > 10) existing.shift();
        telemetryBuffer.set(deviceId, existing);

        res.json({ success: true, bufferedFrames: existing.length });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/incidents/sms-gateway
 * Ingests offline SMS payloads when mobile data is unavailable
 */
const handleSMSGatewaySOS = async (req, res, next) => {
    try {
        const { senderPhone, messageText, _rawPayload } = req.body;
        logger.info('SMS Gateway SOS Ingested', { senderPhone, messageText });

        // Parse payload format: SERS_SOS,<lat>,<lng>,<type>,<accel>
        let lat = 0.0, lng = 0.0, emergencyType = 'accident';
        if (messageText && messageText.includes('SERS_SOS')) {
            const parts = messageText.split(',');
            if (parts.length >= 3) {
                lat = parseFloat(parts[1]) || 0.0;
                lng = parseFloat(parts[2]) || 0.0;
                if (parts[3]) emergencyType = parts[3].trim();
            }
        }

        const incidentResult = await query(
            `INSERT INTO incidents (
                type, severity, status, latitude, longitude,
                address, description, is_anonymous
            ) VALUES ($1, 'critical', 'reported', $2, $3, 'Offline SMS Relay', $4, TRUE)
            RETURNING *`,
            [
                emergencyType, lat, lng,
                `Offline SMS SOS received from ${senderPhone || 'Unknown Mobile'}. Payload: ${messageText}`
            ]
        );
        const incident = incidentResult.rows[0];

        // Broadcast to responders
        const io = getSocketIO();
        if (io) {
            io.to('responders').emit('incident:new', {
                id: incident.id,
                incidentNumber: incident.incident_number,
                type: incident.type,
                severity: incident.severity,
                latitude: lat,
                longitude: lng,
                description: incident.description,
                source: 'sms_offline_gateway',
            });
        }

        // Auto-assign ambulance if lat/lng available
        if (lat !== 0 && lng !== 0) {
            autoAssignAmbulance(incident.id, lat, lng).catch(err =>
                logger.error('SMS SOS Auto-assign failed', { incidentId: incident.id, error: err.message })
            );
        }

        res.status(201).json({
            success: true,
            message: 'Offline SMS SOS processed successfully',
            incidentId: incident.id,
            incidentNumber: incident.incident_number,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/incidents/:id/cancel
 * Cancel false alarm within countdown timer
 */
const cancelSOS = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason = 'User cancelled countdown false alarm' } = req.body;

        await withTransaction(async (client) => {
            await client.query(
                `UPDATE incidents SET status = 'false_alarm', updated_at = NOW() WHERE id = $1`,
                [id]
            );

            await client.query(
                `INSERT INTO incident_events (incident_id, event_type, actor_id, actor_role, description)
                 VALUES ($1, 'status_change', $2, $3, $4)`,
                [id, req.user?.id || null, req.user?.role || 'citizen', `False alarm cancelled: ${reason}`]
            );

            // Free up assigned ambulance if any
            await client.query(
                `UPDATE ambulances SET status = 'available', updated_at = NOW()
                 WHERE id = (SELECT assigned_ambulance_id FROM incidents WHERE id = $1)`,
                [id]
            );
        });

        const io = getSocketIO();
        if (io) {
            io.to(`incident:${id}`).emit('incident:status', { incidentId: id, status: 'false_alarm' });
        }

        res.json({ success: true, message: 'SOS alert cancelled successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    triggerSOS,
    listIncidents,
    getIncident,
    updateStatus,
    getTimeline,
    autoAssignAmbulance,
    assignIncident,
    acceptIncident,
    rejectIncident,
    bufferTelemetry,
    handleSMSGatewaySOS,
    cancelSOS,
};

