require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sers_db',
    user: process.env.DB_USER || 'sers_user',
    password: process.env.DB_PASSWORD || 'sers_secret_password',
});

async function migrate() {
    try {
        console.log('Running database migrations...');
        const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(sql);
        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
migrate();
