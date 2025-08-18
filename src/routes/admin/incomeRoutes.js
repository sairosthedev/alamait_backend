const express = require('express');
const router = express.Router();
const { 
    getIncomeSummary, 
    getResidenceIncome, 
    getIncomeByDateRange 
} = require('../../controllers/admin/incomeController');
const { authenticateToken, authorizeRole } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(authorizeRole(['admin', 'manager']));

/**
 * @route   GET /api/admin/income/summary
 * @desc    Get income summary for all residences
 * @access  Admin/Manager
 */
router.get('/summary', getIncomeSummary);

/**
 * @route   GET /api/admin/income/residence/:residenceId
 * @desc    Get income for a specific residence
 * @access  Admin/Manager
 */
router.get('/residence/:residenceId', getResidenceIncome);

/**
 * @route   GET /api/admin/income/range
 * @desc    Get income by date range (with optional residence filter)
 * @access  Admin/Manager
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @query   residenceId - Optional residence ID filter
 */
router.get('/range', getIncomeByDateRange);

module.exports = router;
