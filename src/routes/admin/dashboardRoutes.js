const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { 
    getDashboardStats
} = require('../../controllers/admin/dashboardController');
const { getExecutiveDashboard } = require('../../controllers/admin/executiveDashboardController');

// Get overall dashboard statistics
router.get('/stats', auth, checkRole('admin'), getDashboardStats);

// Get comprehensive executive dashboard data
router.get('/executive', auth, checkRole(['admin', 'ceo', 'finance', 'finance_admin']), getExecutiveDashboard);

module.exports = router; 