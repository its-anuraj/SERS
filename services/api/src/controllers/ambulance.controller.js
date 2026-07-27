/**
 * Ambulance Controller
 */

const { query } = require('../config/database');
const { setAmbulancePosition, getAmbulancePosition } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const { getSocketIO } = require('../websocket/socketManager');
const logger = require('../config/logger');

/**
 * Find the nearest available ambulance using PostGIS
 */
const findNearestAvailableAmbulance = async (latitude, longitude, radiusMeters = 15000) => {
    const result = await query(
        `SELECT a.*, u.name AS driver_name, u.phone AS driver_phone
         FROM ambulances a
         LEFT JOIN users u ON a.driver_id = u.id
         WHERE a.status = 'available' AND a.is_active = TRUE
           AND a.current_lat IS NOT NULL
           AND ST_DWithin(
               a.current_location::geography,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               $3
           )
         ORDER BY ST_Distance(
             a.current_location::geography,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         ) ASC
         LIMIT 1`,
        [longitude, latitude, radiusMeters]
    );
    return result.rows[0] || null;
};

/**
 * GET /api/ambulances
 */
const listAmbulances = async (req, res, next) => {
    try {
        const { status, hospitalId } = req.query;
        let sql = `
            SELECT a.*, u.name AS driver_name, u.phone AS driver_phone, h.name AS hospital_name
            FROM ambulances a
            LEFT JOIN users u ON a.driver_id = u.id
            LEFT JOIN hospitals h ON a.hospital_id = h.id
            WHERE a.is_active = TRUE
        `;
        const params = [];
        let idx = 1;

        if (status) { sql += ` AND a.status = $${idx++}`; params.push(status); }
        if (hospitalId) { sql += ` AND a.hospital_id = $${idx++}`; params.push(hospitalId); }

        sql += ' ORDER BY a.registration_number ASC';

        const result = await query(sql, params);

        // Enrich with Redis live positions
        const ambulances = await Promise.all(result.rows.map(async (amb) => {
            const livePos = await getAmbulancePosition(amb.id);
            if (livePos) {
                return { ...amb, current_lat: livePos.lat, current_lng: livePos.lng, location_updated_at: new Date(livePos.updatedAt) };
            }
            return amb;
        }));

        res.json({ success: true, data: ambulances });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/ambulances/track/:id
 * Live ambulance position (Redis first)
 */
const trackAmbulance = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Try Redis first for freshest data
        const livePos = await getAmbulancePosition(id);
        if (livePos) {
            return res.json({
                success: true,
                data: { ambulanceId: id, ...livePos, source: 'live' },
            });
        }

        // Fall back to DB
        const result = await query(
            `SELECT id, registration_number, current_lat, current_lng, heading, speed_kmh, status, location_updated_at
             FROM ambulances WHERE id = $1`,
            [id]
        );
        if (!result.rows.length) throw new ApiError(404, 'Ambulance not found');

        const amb = result.rows[0];
        res.json({
            success: true,
            data: {
                ambulanceId: id,
                registrationNumber: amb.registration_number,
                lat: amb.current_lat,
                lng: amb.current_lng,
                heading: amb.heading,
                speedKmh: amb.speed_kmh,
                status: amb.status,
                updatedAt: amb.location_updated_at,
                source: 'db',
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/ambulances/:id/location
 * Responder app posts GPS updates every 5s
 */
const updateLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { lat, lng, heading, speedKmh } = req.body;

        // Update Redis cache (fast path)
        await setAmbulancePosition(id, lat, lng, heading, speedKmh);

        // Update DB every 30s (throttle writes)
        const shouldUpdateDB = !req.headers['x-skip-db'];
        if (shouldUpdateDB) {
            await query(
                `UPDATE ambulances SET
                    current_lat = $1, current_lng = $2, heading = $3, speed_kmh = $4,
                    location_updated_at = NOW(), updated_at = NOW()
                 WHERE id = $5`,
                [lat, lng, heading || 0, speedKmh || 0, id]
            );

            // Store location history
            await query(
                `INSERT INTO responder_locations (user_id, latitude, longitude, speed_kmh)
                 SELECT driver_id, $1, $2, $3 FROM ambulances WHERE id = $4 AND driver_id IS NOT NULL`,
                [lat, lng, speedKmh || 0, id]
            );
        }

        // Broadcast to incident room
        const io = getSocketIO();
        if (io) {
            // Find active incident for this ambulance
            const incidentResult = await query(
                `SELECT id FROM incidents WHERE assigned_ambulance_id = $1 AND status NOT IN ('resolved','cancelled','false_alarm')`,
                [id]
            );
            if (incidentResult.rows.length) {
                const incidentId = incidentResult.rows[0].id;
                io.to(`incident:${incidentId}`).emit('location:update', {
                    ambulanceId: id, lat, lng, heading, speedKmh,
                    timestamp: Date.now(),
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/ambulances/:id
 */
const getAmbulance = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT a.*, u.name AS driver_name, u.phone AS driver_phone, h.name AS hospital_name
             FROM ambulances a
             LEFT JOIN users u ON a.driver_id = u.id
             LEFT JOIN hospitals h ON a.hospital_id = h.id
             WHERE a.id = $1`,
            [req.params.id]
        );
        if (!result.rows.length) throw new ApiError(404, 'Ambulance not found');
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

module.exports = { findNearestAvailableAmbulance, listAmbulances, trackAmbulance, updateLocation, getAmbulance };
