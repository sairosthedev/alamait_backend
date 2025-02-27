const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getOccupancyReport,
    getFinancialReport,
    getMaintenanceReport,
    getStudentActivityReport
} = require('../../controllers/admin/reportController');

// All routes require admin role
router.use(auth);
router.use(checkRole('admin'));

// Report routes
router.get('/occupancy', getOccupancyReport);
router.get('/financial', getFinancialReport);
router.get('/maintenance', getMaintenanceReport);
router.get('/student-activity', getStudentActivityReport);

module.exports = router; 