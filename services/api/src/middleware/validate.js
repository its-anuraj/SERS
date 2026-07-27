/**
 * Validation Middleware (express-validator)
 */

const { validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(e => `${e.path}: ${e.msg}`).join(', ');
        return next(new ApiError(400, `Validation failed: ${messages}`, errors.array()));
    }
    next();
};

module.exports = { validate };
