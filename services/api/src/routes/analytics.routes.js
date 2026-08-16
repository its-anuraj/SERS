/**
 * Analytics Routes — Admin/Public dashboards
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/analytics/summary — Hospital / Public stats
router.get('/summary', optionalAuth, async (req, res, next) => {
    try {
        const hospitalId = req.query.hospitalId || req.user?.hospitalId || null;

        let incidentSql = `SELECT
            COUNT(*) AS total_incidents,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
            COUNT(*) FILTER (WHERE status NOT IN ('resolved','cancelled','false_alarm')) AS active,
            COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','cancelled','false_alarm')) AS critical_active,
            COUNT(*) FILTER (WHERE ai_crash_detected = TRUE) AS ai_detected,
            ROUND(AVG(EXTRACT(EPOCH FROM (responder_arrived_at - created_at))/60)::NUMERIC, 1) AS avg_response_mins
         FROM incidents WHERE created_at >= NOW() - INTERVAL '30 days'`;

        const incidentParams = [];
        if (hospitalId) {
            incidentSql += ` AND assigned_hospital_id = $1`;
            incidentParams.push(hospitalId);
        }

        const [incidentStats, hospitalStats, ambulanceStats, staffStats] = await Promise.all([
            query(incidentSql, incidentParams),
            hospitalId
                ? query(`SELECT id, name, city, address, icu_beds_total, icu_beds_available, er_beds_total, er_beds_available, blood_inventory, is_on_sers_network FROM hospitals WHERE id = $1`, [hospitalId])
                : query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_on_sers_network) AS on_network, SUM(icu_beds_available) AS total_icu_avail FROM hospitals`),
            hospitalId
                ? query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'available') AS available, COUNT(*) FILTER (WHERE status = 'en_route') AS en_route FROM ambulances WHERE hospital_id = $1 AND is_active = TRUE`, [hospitalId])
                : query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'available') AS available, COUNT(*) FILTER (WHERE status = 'en_route') AS en_route FROM ambulances WHERE is_active = TRUE`),
            hospitalId
                ? query(`SELECT COUNT(*) FILTER (WHERE status = 'on_duty') AS on_duty, COUNT(*) FILTER (WHERE status = 'in_ot') AS in_ot, COUNT(*) FILTER (WHERE status = 'on_call') AS on_call, COUNT(*) AS total FROM duty_attendance WHERE hospital_id = $1 AND duty_date = CURRENT_DATE`, [hospitalId])
                : query(`SELECT COUNT(*) FILTER (WHERE status = 'on_duty') AS on_duty, COUNT(*) AS total FROM duty_attendance WHERE duty_date = CURRENT_DATE`),
        ]);

        res.json({
            success: true,
            data: {
                incidents: incidentStats.rows[0],
                hospitals: hospitalId ? hospitalStats.rows[0] : hospitalStats.rows[0],
                hospitalProfile: hospitalId ? hospitalStats.rows[0] : null,
                ambulances: ambulanceStats.rows[0],
                onDutyStaff: staffStats.rows[0],
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
        const totalInc = parseInt(stats.total) || 0;
        const resolvedInc = parseInt(stats.resolved) || 0;
        const aiInc = parseInt(stats.ai_detected) || 0;
        const avgResp = stats.avg_response_mins ? `${stats.avg_response_mins} minutes` : 'N/A';

        if (q.includes('response time') || q.includes('average time')) {
            answer = `**Average Response Time (last 30 days): ${avgResp}.** Total incidents analyzed: ${totalInc}.`;
        } else if (q.includes('active') || q.includes('ongoing')) {
            answer = `**Currently active incidents: ${stats.active || 0}.** Of these, ${stats.critical_count || 0} are critical severity. ${amb.en_route || 0} ambulances are currently en route.`;
        } else if (q.includes('ambulance') || q.includes('fleet')) {
            answer = `**Ambulance Fleet Status:** ${amb.available || 0} of ${amb.total || 0} ambulances are available. ${amb.en_route || 0} currently en route to incidents.`;
        } else if (q.includes('hospital') || q.includes('icu') || q.includes('bed')) {
            answer = `**Hospital Network:** ${hosp.on_network || 0} of ${hosp.total || 0} hospitals are on the SERS network. ${hosp.has_icu || 0} hospitals currently have ICU beds available.`;
        } else if (q.includes('ai') || q.includes('crash') || q.includes('detect')) {
            const aiPct = totalInc > 0 ? ((aiInc / totalInc) * 100).toFixed(1) : '0';
            answer = `**AI Crash Detections (last 30 days): ${aiInc} incidents** were automatically detected by the on-device crash detection engine (${aiPct}% of total incidents).`;
        } else if (q.includes('week') || q.includes('7 day') || q.includes('last week')) {
            answer = `**Last 7 days: ${stats.last_7_days || 0} incidents** recorded.${ctx.type_breakdown.length > 0 ? ` Type breakdown: ${ctx.type_breakdown.slice(0,3).map(t => `${t.type} (${t.count})`).join(', ')}.` : ''}`;
        } else {
            const resolveRate = totalInc > 0 ? ((resolvedInc / totalInc) * 100).toFixed(0) : '0';
            answer = `**SERS Summary (last 30 days):** ${totalInc} total incidents, ${resolvedInc} resolved (${resolveRate}% resolution rate). Average response time: **${avgResp}**. ${amb.available || 0}/${amb.total || 0} ambulances available. ${hosp.on_network || 0} hospitals connected.\n\nFor a more specific answer, try asking about response times, active incidents, ambulance status, or hospital capacity.`;
        }

        res.json({ success: true, data: { answer, context: ctx, note: 'Gemini API key not configured — using rule-based response.' } });
    } catch (error) { next(error); }
});

module.exports = router;
