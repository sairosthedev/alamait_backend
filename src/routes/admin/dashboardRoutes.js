const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { 
    getDashboardStats
} = require('../../controllers/admin/dashboardController');
const { getDashboardBadges } = require('../../controllers/finance/dashboardController');
const { executiveDashboardHandler } = require('../../middleware/dashboardExecutiveGateway');

// Get overall dashboard statistics
router.get('/stats', auth, checkRole('admin'), getDashboardStats);

// Admin executive dashboard (admin role; legacy /api/admin path also accepts finance/ceo via handler)
router.get('/executive', auth, executiveDashboardHandler);

// Badge counts (same payload as finance; frontend polls /api/admin/dashboard/badges)
router.get('/badges',
    auth,
    checkRole(['admin', 'admin_ceo', 'finance', 'finance_admin', 'ceo']),
    getDashboardBadges
);

module.exports = router; 