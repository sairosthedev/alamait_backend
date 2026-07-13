const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { 
    getDashboardStats
} = require('../../controllers/admin/dashboardController');
const { executiveDashboardHandler } = require('../../middleware/dashboardExecutiveGateway');

// Get overall dashboard statistics
router.get('/stats', auth, checkRole('admin'), getDashboardStats);

// Admin executive dashboard (admin role; legacy /api/admin path also accepts finance/ceo via handler)
router.get('/executive', auth, executiveDashboardHandler);

module.exports = router; 