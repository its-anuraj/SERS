/**
 * PostgreSQL Connection Pool (with PostGIS support)
 */

const { Pool } = require('pg');
const logger = require('./logger');

let pool;

const connectDB = async () => {
    pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'sers_db',
        user: process.env.DB_USER || 'sers_user',
        password: process.env.DB_PASSWORD || 'sers_secret_password',
        max: 20,                  // max pool connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT PostGIS_Version()');
    client.release();
    
    pool.on('error', (err) => {
        logger.error('Unexpected PostgreSQL pool error:', err);
    });
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
