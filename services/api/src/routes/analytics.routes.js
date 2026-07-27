/**
 * Analytics Routes — Admin/Public dashboards
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/analytics/summary — Public stats
router.get('/summary', optionalAuth, async (req, res, next) => {
    try {
        const [incidentStats, hospitalStats, ambulanceStats] = await Promise.all([
            query(`SELECT
                COUNT(*) AS total_incidents,
                COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
                COUNT(*) FILTER (WHERE status NOT IN ('resolved','cancelled','false_alarm')) AS active,
                COUNT(*) FILTER (WHERE ai_crash_detected = TRUE) AS ai_detected,
                ROUND(AVG(EXTRACT(EPOCH FROM (responder_arrived_at - created_at))/60)::NUMERIC, 1) AS avg_response_mins
             FROM incidents WHERE created_at >= NOW() - INTERVAL '30 days'`),
            query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_on_sers_network) AS on_network FROM hospitals`),
            query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'available') AS available FROM ambulances WHERE is_active = TRUE`),
        ]);

        res.json({
            success: true,
            data: {
                incidents: incidentStats.rows[0],
                hospitals: hospitalStats.rows[0],
                ambulances: ambulanceStats.rows[0],
            },
        });
    } catch (error) { next(error); }
});

// GET /api/analytics/incidents-by-type — Chart data
router.get('/incidents-by-type', optionalAuth, async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const result = await query(
            `SELECT type, COUNT(*) AS count
             FROM incidents WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
             GROUP BY type ORDER BY count DESC`,
            [days]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

// GET /api/analytics/incidents-by-hour — Heatmap data
router.get('/incidents-by-hour', optionalAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS count
             FROM incidents WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY hour ORDER BY hour`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

// GET /api/analytics/hotspots — Current hotspot predictions
router.get('/hotspots', optionalAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, latitude, longitude, radius_meters, risk_score, risk_label, predicted_for_date, predicted_for_hour
             FROM hotspot_predictions
             WHERE predicted_for_date >= CURRENT_DATE
             ORDER BY risk_score DESC LIMIT 50`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

// GET /api/analytics/response-times — Admin trend
router.get('/response-times', authenticate, authorize('admin', 'coordinator'), async (req, res, next) => {
    try {
        const result = await query(
            `SELECT
                DATE_TRUNC('day', created_at) AS day,
                ROUND(AVG(EXTRACT(EPOCH FROM (responder_arrived_at - created_at))/60)::NUMERIC, 1) AS avg_response_mins,
                COUNT(*) AS total_incidents
             FROM incidents
             WHERE created_at >= NOW() - INTERVAL '30 days' AND responder_arrived_at IS NOT NULL
             GROUP BY day ORDER BY day ASC`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

// GET /api/analytics/active-incidents-map — Live map data
router.get('/active-incidents-map', optionalAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, incident_number, type, severity, status, latitude, longitude, created_at
             FROM incidents
             WHERE status NOT IN ('resolved','cancelled','false_alarm')
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

module.exports = router;
