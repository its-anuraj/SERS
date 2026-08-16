/**
 * PostgreSQL Connection Pool (with PostGIS support)
 */

const { Pool } = require('pg');
const logger = require('./logger');

let pool;

const connectDB = async () => {
    const config = process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'sers_db',
            user: process.env.DB_USER || 'sers_user',
            password: process.env.DB_PASSWORD || 'sers_secret_password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        };

    pool = new Pool(config);

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT PostGIS_Version()');
    client.release();
    
    pool.on('error', (err) => {
        logger.error('Unexpected PostgreSQL pool error:', err);
    });

    // Auto-initialize schema & seed default credentials on cloud startup
    await autoSeedDatabase();
};

const autoSeedDatabase = async () => {
    try {
        const fs = require('fs');
        const path = require('path');
        const bcrypt = require('bcryptjs');

        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'users'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            logger.info('Initializing PostgreSQL database schema from schema.sql...');
            const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
            await pool.query(schemaSql).catch(e => logger.warn('Schema migration notice:', e.message));
        }

        // Ensure default admin & hospital staff seed accounts exist with verified password hash
        const userCheck = await pool.query("SELECT id FROM users WHERE email = 'admin@sers.in'");
        if (userCheck.rows.length === 0) {
            logger.info('Seeding default SERS authentication credentials...');
            const seedSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
            await pool.query(seedSql).catch(e => logger.warn('Seed notice:', e.message));
        }

        // Guarantee password hash for Test@1234 across all demo emails and phone numbers
        const defaultHash = await bcrypt.hash('Test@1234', 10);
        await pool.query(`
            UPDATE users SET password_hash = $1 
            WHERE LOWER(email) IN ('admin@sers.in', 'drmeera@demo.sers.in', 'drrajesh@demo.sers.in', 'arjun@demo.sers.in', 'ravi@demo.sers.in', 'priya@demo.sers.in', 'suresh@demo.sers.in', 'coord@sers.in')
               OR phone IN ('+919876500001', '+919876500002', '+919876500003', '+919876500004', '+919876500005', '+919876500006', '+919876500007')
        `, [defaultHash]).catch(() => {});

        logger.info('✅ Cloud Database schema & default authentication credentials verified');
    } catch (err) {
        logger.warn('Auto-seed warning:', err.message);
    }
};

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger.warn('Slow query detected', { text: text.substring(0, 100), duration });
        }
        return res;
    } catch (error) {
        logger.error('Database query error', { text: text.substring(0, 100), error: error.message });
        throw error;
    }
};

/**
 * Get a client for transactions
 */
const getClient = () => pool.connect();

/**
 * Execute inside a transaction
 * @param {Function} callback - async (client) => { ... }
 */
const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { connectDB, query, getClient, withTransaction };
