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
router.get('/response-times', optionalAuth, async (req, res, next) => {
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

// POST /api/analytics/llm-query — Natural language dispatch analytics via Gemini
router.post('/llm-query', optionalAuth, async (req, res, next) => {
    try {
        const { query: userQuery } = req.body;
        if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length < 3) {
            return res.status(400).json({ success: false, error: 'A valid query string is required.' });
        }

        // Gather live context from DB
        const [incidentStats, hospitalStats, ambulanceStats, recentIncidents, typeBreakdown] = await Promise.all([
            query(`SELECT
                COUNT(*) AS total, COUNT(*) FILTER (WHERE status='resolved') AS resolved,
                COUNT(*) FILTER (WHERE status NOT IN ('resolved','cancelled','false_alarm')) AS active,
                COUNT(*) FILTER (WHERE ai_crash_detected=TRUE) AS ai_detected,
                ROUND(AVG(EXTRACT(EPOCH FROM (responder_arrived_at - created_at))/60)::NUMERIC,1) AS avg_response_mins,
                COUNT(*) FILTER (WHERE severity='critical') AS critical_count,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7_days
             FROM incidents WHERE created_at >= NOW() - INTERVAL '30 days'`),
            query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_on_sers_network) AS on_network,
                   COUNT(*) FILTER (WHERE icu_beds_available > 0) AS has_icu FROM hospitals`),
            query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='available') AS available,
                   COUNT(*) FILTER (WHERE status='en_route') AS en_route FROM ambulances WHERE is_active=TRUE`),
            query(`SELECT type, severity, status, created_at FROM incidents
                   WHERE created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 20`),
            query(`SELECT type, COUNT(*) AS count FROM incidents
                   WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY type ORDER BY count DESC`),
        ]);

        const ctx = {
            incidents_30d: incidentStats.rows[0],
            hospitals: hospitalStats.rows[0],
            ambulances: ambulanceStats.rows[0],
            recent_7d_summary: recentIncidents.rows,
            type_breakdown: typeBreakdown.rows,
        };

        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        if (GEMINI_KEY) {
            const prompt = `You are the SERS (Smart Emergency Response System) AI analytics assistant.
Use the following real-time dispatch data to answer the user's question in a concise, helpful way.
Format your response in plain text with markdown bold (**text**) for emphasis. Be specific with numbers.

## Live SERS Data Context:
${JSON.stringify(ctx, null, 2)}

## User Question:
${userQuery.trim()}

Respond in 2-4 sentences. Be precise, data-driven, and helpful. If the data doesn't cover the question, say so.`;

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
                    }),
                }
            );
            if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated.';
                return res.json({ success: true, data: { answer, context: ctx } });
            }
        }

        // Fallback: rule-based response from live DB data
        const stats = ctx.incidents_30d;
        const amb = ctx.ambulances;
        const hosp = ctx.hospitals;
        const q = userQuery.toLowerCase();

        let answer = '';
        if (q.includes('response time') || q.includes('average time')) {
            answer = `**Average Response Time (last 30 days): ${stats.avg_response_mins} minutes.** Total incidents analyzed: ${stats.total}. Peak response times occur during rush hours (8–10 AM, 5–8 PM).`;
        } else if (q.includes('active') || q.includes('ongoing')) {
            answer = `**Currently active incidents: ${stats.active}.** Of these, ${stats.critical_count} are critical severity. ${amb.en_route} ambulances are currently en route.`;
        } else if (q.includes('ambulance') || q.includes('fleet')) {
            answer = `**Ambulance Fleet Status:** ${amb.available} of ${amb.total} ambulances are available. ${amb.en_route} currently en route to incidents.`;
        } else if (q.includes('hospital') || q.includes('icu') || q.includes('bed')) {
            answer = `**Hospital Network:** ${hosp.on_network} of ${hosp.total} hospitals are on the SERS network. ${hosp.has_icu} hospitals currently have ICU beds available.`;
        } else if (q.includes('ai') || q.includes('crash') || q.includes('detect')) {
            answer = `**AI Crash Detections (last 30 days): ${stats.ai_detected} incidents** were automatically detected by the on-device crash detection engine (${((stats.ai_detected / stats.total) * 100).toFixed(1)}% of total incidents).`;
        } else if (q.includes('week') || q.includes('7 day') || q.includes('last week')) {
            answer = `**Last 7 days: ${stats.last_7_days} incidents** recorded. Type breakdown: ${ctx.type_breakdown.slice(0,3).map(t => `${t.type} (${t.count})`).join(', ')}.`;
        } else {
            answer = `**SERS Summary (last 30 days):** ${stats.total} total incidents, ${stats.resolved} resolved (${((stats.resolved/stats.total)*100).toFixed(0)}% resolution rate). Average response time: **${stats.avg_response_mins} minutes**. ${amb.available}/${amb.total} ambulances available. ${hosp.on_network} hospitals connected.\n\nFor a more specific answer, try asking about response times, active incidents, ambulance status, or hospital capacity.`;
        }

        res.json({ success: true, data: { answer, context: ctx, note: 'Gemini API key not configured — using rule-based response.' } });
    } catch (error) { next(error); }
});

module.exports = router;
