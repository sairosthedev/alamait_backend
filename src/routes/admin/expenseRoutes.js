const express = require('express');
const router = express.Router();
const { 
    getExpenseSummary, 
    getResidenceExpenses, 
    getExpensesByDateRange 
} = require('../../controllers/admin/expenseController');
const { authenticateToken, authorizeRole } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(authorizeRole(['admin', 'manager']));

/**
 * @route   GET /api/admin/expenses/summary
 * @desc    Get expense summary for all residences
 * @access  Admin/Manager
 */
router.get('/summary', getExpenseSummary);

/**
 * @route   GET /api/admin/expenses/residence/:residenceId
 * @desc    Get expenses for a specific residence
 * @access  Admin/Manager
 */
router.get('/residence/:residenceId', getResidenceExpenses);

/**
 * @route   GET /api/admin/expenses/range
 * @desc    Get expenses by date range (with optional residence filter)
 * @access  Admin/Manager
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @query   residenceId - Optional residence ID filter
 */
router.get('/range', getExpensesByDateRange);

module.exports = router;