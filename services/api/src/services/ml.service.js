/**
 * ML Service Client
 * Calls the Python FastAPI ML microservice
 */

const logger = require('../config/logger');

const ML_BASE = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_API_KEY = process.env.ML_SERVICE_API_KEY || '';

const callMLService = async (method, path, body = null) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ML_API_KEY,
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${ML_BASE}${path}`, options);
        if (!response.ok) {
            throw new Error(`ML service returned ${response.status}`);
        }
        return response.json();
    } catch (error) {
        logger.warn('ML service call failed', { path, error: error.message });
        throw error;
    }
};

module.exports = { callMLService };
