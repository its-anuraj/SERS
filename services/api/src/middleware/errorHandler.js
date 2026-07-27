/**
 * Global Error Handler
 */

const logger = require('../config/logger');

class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }
}

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // PostgreSQL errors
    if (err.code === '23505') {
        statusCode = 409;
        message = 'Resource already exists (duplicate)';
    } else if (err.code === '23503') {
        statusCode = 400;
        message = 'Referenced resource does not exist';
    } else if (err.code === '22P02') {
        statusCode = 400;
        message = 'Invalid UUID format';
    }

    // Log 5xx errors
    if (statusCode >= 500) {
        logger.error('Server error:', {
            message: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            body: req.body,
            user: req.user?.id,
        });
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.url} not found`,
    });
};

module.exports = { ApiError, errorHandler, notFound };
