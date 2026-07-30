const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5433,
    database: process.env.DB_NAME || 'sers_db',
    user: process.env.DB_USER || 'sers_user',
    password: process.env.DB_PASSWORD || 'sers_secret_password',
});

async function run() {
    try {
        await pool.query(`
            INSERT INTO incidents (
                id, incident_number, type, severity, status,
                latitude, longitude, address, landmark,
                ai_crash_detected, ai_severity_score, description, created_at
            ) VALUES (
                'd0000000-0000-0000-0000-000000000004', 'SERS-2026-000004',
                'accident', 'critical', 'en_route',
                12.9172, 77.6228,
                'Silk Board Junction, Hosur Road, Bengaluru', 'Near Silk Board Flyover',
                TRUE, 9.8,
                'AUTOMATED AIRBAG CRASH ALERT: 100% Confirmed Real Crash. Airbag pressure pulse (+28 hPa), Impact magnitude 36.2G, Engine Stall (0 RPM). AFDP v2 Confidence: 99% · Smartwatch HR: 158 BPM (CRITICAL_TACHYCARDIA)',
                NOW() - INTERVAL '4 minutes'
            ) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;
        `);

        await pool.query(`
            INSERT INTO incidents (
                id, incident_number, type, severity, status,
                latitude, longitude, address, landmark,
                ai_crash_detected, ai_severity_score, description, created_at
            ) VALUES (
                'd0000000-0000-0000-0000-000000000005', 'SERS-2026-000005',
                'cardiac', 'critical', 'assigned',
                12.9352, 77.6245,
                'Koramangala 4th Block, Bengaluru', 'Near Wipro Park',
                FALSE, 9.4,
                'AUTOMATED CARDIAC ALERT: Smartwatch detected critical pulse rate of 165 BPM (CRITICAL_TACHYCARDIA). Patient responsive.',
                NOW() - INTERVAL '2 minutes'
            ) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;
        `);

        console.log('✅ Live authentic telemetry dataset seeded into PostgreSQL!');
    } catch (e) {
        console.error('Seed Error:', e.message);
    } finally {
        await pool.end();
    }
}

run();
