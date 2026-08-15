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
};
