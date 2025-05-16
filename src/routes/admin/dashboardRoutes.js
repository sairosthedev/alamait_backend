const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { 
    getDashboardStats, 
    getStudentAndIncomeStats,
    getPaymentIncomeStats 
} = require('../../controllers/admin/dashboardController');

// Get overall dashboard statistics
router.get('/stats', auth, checkRole('admin'), getDashboardStats);

// Get student count and total income statistics
router.get('/student-income-stats', auth, checkRole('admin'), getStudentAndIncomeStats);

// Get detailed payment income statistics
router.get('/payment-income-stats', auth, checkRole('admin'), getPaymentIncomeStats);

module.exports = router; 