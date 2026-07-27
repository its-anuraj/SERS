/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/notifications — User's notifications
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { limit = 20, unreadOnly = false } = req.query;
        let sql = `SELECT * FROM notifications WHERE user_id = $1`;
        if (unreadOnly === 'true') sql += ' AND is_read = FALSE';
        sql += ` ORDER BY created_at DESC LIMIT $2`;

        const result = await query(sql, [req.user.id, parseInt(limit)]);
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res, next) => {
    try {
        await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) { next(error); }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res, next) => {
    try {
        await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
        res.json({ success: true });
    } catch (error) { next(error); }
});

module.exports = router;
