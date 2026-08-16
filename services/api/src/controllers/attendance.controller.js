/**
 * Attendance & Duty Roster Controller
 * Tracks real-time availability of Doctors/Specialists and Ambulance Drivers
 */

const { query } = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

/**
 * GET /api/attendance
 * List on-duty personnel for today (or specified date)
 */
const listAttendance = async (req, res, next) => {
    try {
        const {
            date,
            staff_type,
            department,
            status,
            hospital_id,
            limit = 100,
            offset = 0,
        } = req.query;

        const user = req.user || { role: 'admin' };
        const targetHospitalId = hospital_id || user.hospitalId;

        let sql = `
            SELECT a.*, h.name AS hospital_name
            FROM duty_attendance a
            LEFT JOIN hospitals h ON a.hospital_id = h.id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (date) {
            sql += ` AND a.duty_date = $${paramIdx++}`;
            params.push(date);
        } else {
            sql += ` AND a.duty_date = CURRENT_DATE`;
        }

        if (staff_type) {
            sql += ` AND a.staff_type = $${paramIdx++}`;
            params.push(staff_type);
        }

        if (department) {
            sql += ` AND a.department ILIKE $${paramIdx++}`;
            params.push(`%${department}%`);
        }

        if (status) {
            sql += ` AND a.status = $${paramIdx++}`;
            params.push(status);
        }

        if (user.role === 'hospital_staff' && targetHospitalId) {
            sql += ` AND a.hospital_id = $${paramIdx++}`;
            params.push(targetHospitalId);
        } else if (targetHospitalId) {
            sql += ` AND a.hospital_id = $${paramIdx++}`;
            params.push(targetHospitalId);
        }

        sql += ` ORDER BY a.status ASC, a.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await query(sql, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: result.rows.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/attendance
 * Check-in a doctor, specialist, or driver on duty
 */
const markAttendance = async (req, res, next) => {
    try {
        const {
            hospital_id,
            staff_type,
            name,
            phone,
            department,
            specialization,
            assigned_vehicle_reg,
            shift = 'Morning (08:00 - 16:00)',
            status = 'on_duty',
            notes,
        } = req.body;

        if (!staff_type || !name) {
            throw new ApiError(400, 'staff_type and name are required');
        }

        const user = req.user || {};
        const effectiveHospitalId = hospital_id || user.hospitalId || null;

        const result = await query(
            `INSERT INTO duty_attendance 
                (hospital_id, staff_type, name, phone, department, specialization, assigned_vehicle_reg, shift, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                effectiveHospitalId,
                staff_type,
                name.trim(),
                phone ? phone.trim() : null,
                department ? department.trim() : null,
                specialization ? specialization.trim() : null,
                assigned_vehicle_reg ? assigned_vehicle_reg.trim() : null,
                shift,
                status,
                notes ? notes.trim() : null,
            ]
        );

        logger.info('Duty attendance marked', { id: result.rows[0].id, staff_type, name });

        res.status(201).json({
            success: true,
            message: 'Duty attendance recorded successfully',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/attendance/:id/status
 * Update real-time status (on_duty, in_ot, on_call, off_duty)
 */
const updateAttendanceStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            throw new ApiError(400, 'Status is required');
        }

        let sql = `UPDATE duty_attendance SET status = $1, updated_at = NOW()`;
        const params = [status, id];

        if (status === 'off_duty') {
            sql += `, check_out_time = NOW()`;
        }
        if (notes !== undefined) {
            sql += `, notes = $3 WHERE id = $2 RETURNING *`;
            params.splice(2, 0, notes);
        } else {
            sql += ` WHERE id = $2 RETURNING *`;
        }

        const result = await query(sql, params);

        if (result.rows.length === 0) {
            throw new ApiError(404, 'Attendance record not found');
        }

        res.json({
            success: true,
            message: 'Duty status updated',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/attendance/my-status
 * Get current doctor/nurse's active duty status today
 */
const getMyAttendanceStatus = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.query.userId;
        if (!userId) {
            return res.json({ success: true, data: null });
        }

        const result = await query(
            `SELECT a.*, h.name AS hospital_name
             FROM duty_attendance a
             LEFT JOIN hospitals h ON a.hospital_id = h.id
             WHERE a.user_id = $1 AND a.duty_date = CURRENT_DATE
             ORDER BY a.created_at DESC LIMIT 1`,
            [userId]
        );

        res.json({
            success: true,
            data: result.rows[0] || null,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/attendance/toggle-my-status
 * 1-Tap status toggle for logged in doctor/nurse (on_duty, in_ot, on_call, off_duty)
 */
const toggleMyAttendanceStatus = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { status, shift, department, specialization, notes } = req.body;

        if (!status) {
            throw new ApiError(400, 'status is required (on_duty, in_ot, on_call, off_duty)');
        }

        const userRes = await query(
            `SELECT u.id, u.name, u.phone, u.hospital_id, u.staff_title, u.department, u.specialization, h.name AS hospital_name
             FROM users u
             LEFT JOIN hospitals h ON u.hospital_id = h.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            throw new ApiError(404, 'User not found');
        }

        const user = userRes.rows[0];

        // Check if there is already an entry for today
        const existing = await query(
            `SELECT id FROM duty_attendance WHERE user_id = $1 AND duty_date = CURRENT_DATE ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        let resultRecord;
        if (existing.rows.length > 0) {
            let updateSql = `UPDATE duty_attendance SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()`;
            const params = [status, notes || null];
            if (status === 'off_duty') {
                updateSql += `, check_out_time = NOW()`;
            }
            updateSql += ` WHERE id = $3 RETURNING *`;
            params.push(existing.rows[0].id);

            const updateRes = await query(updateSql, params);
            resultRecord = updateRes.rows[0];
        } else {
            const insertRes = await query(
                `INSERT INTO duty_attendance (
                    user_id, hospital_id, staff_type, name, phone, department, specialization,
                    shift, status, notes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    userId,
                    user.hospital_id,
                    'doctor',
                    user.name,
                    user.phone,
                    department || user.department || 'Emergency & Trauma',
                    specialization || user.specialization || user.staff_title || 'Emergency Medical Staff',
                    shift || 'Morning (08:00 - 16:00)',
                    status,
                    notes || null
                ]
            );
            resultRecord = insertRes.rows[0];
        }

        logger.info('Doctor duty status updated', { userId, status, name: user.name });

        res.json({
            success: true,
            message: `Duty status updated to ${status.replace('_', ' ').toUpperCase()}`,
            data: {
                ...resultRecord,
                hospital_name: user.hospital_name
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/attendance/:id
 * Remove record
 */
const deleteAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM duty_attendance WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            throw new ApiError(404, 'Attendance record not found');
        }

        res.json({
            success: true,
            message: 'Attendance record deleted',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listAttendance,
    markAttendance,
    updateAttendanceStatus,
    deleteAttendance,
    getMyAttendanceStatus,
    toggleMyAttendanceStatus,
};

