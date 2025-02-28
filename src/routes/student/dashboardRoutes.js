const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getDashboardData,
    getAvailableRooms,
    getNotifications,
    refreshDashboardData
} = require('../../controllers/student/dashboardController');

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Get dashboard data (profile, stats, etc)
router.get('/', getDashboardData);

// Get available rooms
router.get('/rooms', getAvailableRooms);

// Get notifications
router.get('/notifications', getNotifications);

// Refresh dashboard data
router.post('/refresh', refreshDashboardData);

module.exports = router; 