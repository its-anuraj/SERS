const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { optionalAuth, authenticate } = require('../middleware/auth');

router.get('/', optionalAuth, attendanceController.listAttendance);
router.post('/', optionalAuth, attendanceController.markAttendance);
router.patch('/:id/status', optionalAuth, attendanceController.updateAttendanceStatus);
router.delete('/:id', optionalAuth, attendanceController.deleteAttendance);

module.exports = router;
