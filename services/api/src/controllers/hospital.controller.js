/**
 * Hospital Controller
 */

const { query } = require('../config/database');
const { getHospitalCapacity, setHospitalCapacity } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const { callMLService } = require('../services/ml.service');
const logger = require('../config/logger');

/**
 * Find the best hospital for an incident using ML scoring
 * Score = (0.4 × Proximity) + (0.3 × Bed Availability) + (0.2 × Specialty Match) + (0.1 × History)
 */
const findBestHospital = async (latitude, longitude, requiredSpecialties = [], emergencyType = 'general') => {
    try {
        // Get hospitals within 20km with PostGIS
        const result = await query(
            `SELECT h.*,
                ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
             FROM hospitals h
             WHERE h.is_active = TRUE AND h.is_on_sers_network = TRUE
               AND ST_DWithin(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 20000)
             ORDER BY distance_meters ASC
             LIMIT 10`,
            [longitude, latitude]
        );

        if (!result.rows.length) return null;

        // Try ML service for smart scoring
        try {
            const scored = await callMLService('POST', '/hospital-match', {
                latitude, longitude,
                hospitals: result.rows.map(h => ({
                    id: h.id,
                    distanceMeters: h.distance_meters,
                    icuBedsAvailable: h.icu_beds_available,
                    erBedsAvailable: h.er_beds_available,
                    specialties: h.specialties,
                })),
                requiredSpecialties,
                emergencyType,
            });
            if (scored?.rankedHospitals?.length) {
                const bestId = scored.rankedHospitals[0].id;
                return result.rows.find(h => h.id === bestId) || result.rows[0];
            }
        } catch (mlError) {
            logger.warn('ML hospital matching unavailable, using distance fallback', { error: mlError.message });
        }

        // Fallback: nearest hospital with available beds
        return result.rows.find(h => h.er_beds_available > 0) || result.rows[0];

    } catch (error) {
        logger.error('findBestHospital error', { error: error.message });
        return null;
    }
};

/**
 * GET /api/hospitals/nearest
 * Returns ranked list of nearest hospitals for citizen app
 */
const getNearestHospitals = async (req, res, next) => {
    try {
        const { lat, lng, radius = 50000, specialty, limit = 20 } = req.query;
        if (!lat || !lng) throw new ApiError(400, 'lat and lng are required');

        let sql = `
            SELECT h.*,
                ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
                ROUND(ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 * 60 / 35) AS eta_mins
            FROM hospitals h
            WHERE h.is_active = TRUE
              AND ST_DWithin(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        `;
        const params = [parseFloat(lng), parseFloat(lat), parseFloat(radius)];

        if (specialty) {
            sql += ` AND $4 = ANY(h.specialties)`;
            params.push(specialty);
        }

        sql += ` ORDER BY distance_meters ASC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        let result = await query(sql, params);

        // If radius is too strict, return all active hospitals sorted by actual distance
        if (!result.rows.length) {
            let fallbackSql = `
                SELECT h.*,
                    ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
                    ROUND(ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 * 60 / 35) AS eta_mins
                FROM hospitals h
                WHERE h.is_active = TRUE
            `;
            const fallbackParams = [parseFloat(lng), parseFloat(lat)];
            if (specialty) {
                fallbackSql += ` AND $3 = ANY(h.specialties)`;
                fallbackParams.push(specialty);
            }
            fallbackSql += ` ORDER BY distance_meters ASC LIMIT $${fallbackParams.length + 1}`;
            fallbackParams.push(parseInt(limit));
            result = await query(fallbackSql, fallbackParams);
        }

        res.json({
            success: true,
            data: result.rows.map(h => ({
                id: h.id,
                name: h.name,
                type: h.type,
                address: h.address,
                latitude: h.latitude,
                longitude: h.longitude,
                distanceMeters: Math.round(h.distance_meters),
                distanceKm: (h.distance_meters / 1000).toFixed(1),
                etaMins: Math.max(1, parseInt(h.eta_mins) || 5),
                emergencyPhone: h.emergency_phone,
                icuBedsAvailable: h.icu_beds_available,
                erBedsAvailable: h.er_beds_available,
                specialties: h.specialties,
                hasTraumaCenter: h.has_trauma_center,
                isAbdmRegistered: h.is_abdm_registered,
            })),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/hospitals/:id
 */
const getHospital = async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM hospitals WHERE id = $1 AND is_active = TRUE', [req.params.id]);
        if (!result.rows.length) throw new ApiError(404, 'Hospital not found');
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/hospitals/:id/availability
 * Real-time capacity (Redis cache → DB fallback)
 */
const getAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check Redis cache first
        const cached = await getHospitalCapacity(id);
        if (cached) {
            return res.json({ success: true, data: cached, source: 'cache' });
        }

        const result = await query(
            `SELECT id, name, icu_beds_total, icu_beds_available,
                    er_beds_total, er_beds_available,
                    general_beds_total, general_beds_available,
                    blood_inventory, capacity_updated_at
             FROM hospitals WHERE id = $1`,
            [id]
        );
        if (!result.rows.length) throw new ApiError(404, 'Hospital not found');

        const capacity = result.rows[0];
        await setHospitalCapacity(id, capacity);

        res.json({ success: true, data: capacity, source: 'db' });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/hospitals/:id/capacity
 * Update hospital capacity (hospital_staff only)
 */
const updateCapacity = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { icuBedsAvailable, erBedsAvailable, generalBedsAvailable, bloodInventory } = req.body;

        const updates = [];
        const params = [];
        let idx = 1;

        if (icuBedsAvailable !== undefined) { updates.push(`icu_beds_available = $${idx++}`); params.push(icuBedsAvailable); }
        if (erBedsAvailable !== undefined) { updates.push(`er_beds_available = $${idx++}`); params.push(erBedsAvailable); }
        if (generalBedsAvailable !== undefined) { updates.push(`general_beds_available = $${idx++}`); params.push(generalBedsAvailable); }
        if (bloodInventory !== undefined) { updates.push(`blood_inventory = $${idx++}`); params.push(JSON.stringify(bloodInventory)); }

        updates.push('capacity_updated_at = NOW()', 'updated_at = NOW()');
        params.push(id);

        await query(`UPDATE hospitals SET ${updates.join(', ')} WHERE id = $${idx}`, params);

        // Broadcast updated capacity via Socket.io
        const { getSocketIO } = require('../websocket/socketManager');
        const io = getSocketIO();
        if (io) {
            io.to('hospital:updates').emit('hospital:capacity', { hospitalId: id, icuBedsAvailable, erBedsAvailable });
        }

        res.json({ success: true, message: 'Hospital capacity updated' });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/hospitals (admin)
 */
const listHospitals = async (req, res, next) => {
    try {
        const { city, onNetwork, limit = 50 } = req.query;
        let sql = 'SELECT * FROM hospitals WHERE is_active = TRUE';
        const params = [];
        let idx = 1;

        if (city) { sql += ` AND city ILIKE $${idx++}`; params.push(`%${city}%`); }
        if (onNetwork !== undefined) { sql += ` AND is_on_sers_network = $${idx++}`; params.push(onNetwork === 'true'); }

        sql += ` ORDER BY name ASC LIMIT $${idx}`;
        params.push(parseInt(limit));

        const result = await query(sql, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/hospitals/:id/reserve-bed
 * Active Bed Reservation Handshake — Temporarily locks bed for incoming emergency
 */
const reserveHospitalBed = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { incidentId, bedType = 'er' } = req.body;

        const bedColumn = bedType === 'icu' ? 'icu_beds_available' : 'er_beds_available';

        const result = await query(
            `UPDATE hospitals 
             SET ${bedColumn} = GREATEST(0, ${bedColumn} - 1), capacity_updated_at = NOW()
             WHERE id = $1 AND ${bedColumn} > 0
             RETURNING id, name, ${bedColumn}`,
            [id]
        );

        if (!result.rows.length) {
            throw new ApiError(409, `No ${bedType.toUpperCase()} beds currently available at this hospital`);
        }

        // Broadcast real-time urgent handshake ping to ER staff
        const { getSocketIO } = require('../websocket/socketManager');
        const io = getSocketIO();
        if (io) {
            io.to(`hospital:${id}`).emit('hospital:bed_reserved', {
                hospitalId: id,
                incidentId,
                bedType,
                reservedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            });
        }

        res.json({
            success: true,
            message: `1 ${bedType.toUpperCase()} bed locked for 15 minutes. Awaiting hospital staff handshake.`,
            data: {
                hospitalId: id,
                hospitalName: result.rows[0].name,
                remainingBeds: result.rows[0][bedColumn],
                reservedUntil: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/hospitals/:id/confirm-handshake
 * Hospital staff confirms or rejects bed reservation
 */
const confirmBedHandshake = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { incidentId, accepted, reason, bedType = 'er' } = req.body;

        const { getSocketIO } = require('../websocket/socketManager');
        const io = getSocketIO();

        if (accepted) {
            await query(
                `UPDATE incidents SET assigned_hospital_id = $1, status = 'assigned', updated_at = NOW() WHERE id = $2`,
                [id, incidentId]
            );

            if (io) {
                io.to(`incident:${incidentId}`).emit('hospital:handshake_confirmed', {
                    hospitalId: id,
                    incidentId,
                    status: 'accepted',
                });
            }

            return res.json({ success: true, message: 'Hospital handshake confirmed. Bed locked for emergency.' });
        } else {
            // Restore bed count if rejected
            const bedColumn = bedType === 'icu' ? 'icu_beds_available' : 'er_beds_available';
            await query(
                `UPDATE hospitals SET ${bedColumn} = ${bedColumn} + 1, capacity_updated_at = NOW() WHERE id = $1`,
                [id]
            );

            if (io) {
                io.to(`incident:${incidentId}`).emit('hospital:handshake_rejected', {
                    hospitalId: id,
                    incidentId,
                    reason: reason || 'Bed unavailable or specialist off-shift',
                    status: 'rejected',
                });
            }

            return res.json({ success: true, message: 'Handshake rejected. System initiating auto-reroute to next hospital.' });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    findBestHospital,
    getNearestHospitals,
    getHospital,
    getAvailability,
    updateCapacity,
    listHospitals,
    reserveHospitalBed,
    confirmBedHandshake,
};

