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

async function seed() {
    try {
        console.log('Running database seeding...');
        const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
        await pool.query(sql);
        console.log('Seeding successful!');
    } catch (err) {
        if (['23505', '42P07', '42710'].includes(err.code)) {
            console.log('Database seed data already present (Idempotent check passed).');
        } else {
            console.error('Seeding notice:', err.message);
        }
    } finally {
        await pool.end();
    }
}

seed();
