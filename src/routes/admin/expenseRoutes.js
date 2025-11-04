const express = require('express');
const router = express.Router();
const { 
    getExpenses,
    getExpenseSummary, 
    getResidenceExpenses, 
    getExpensesByDateRange 
} = require('../../controllers/admin/expenseController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
router.use(checkRole('admin', 'manager', 'ceo'));

/**
 * @route   GET /api/admin/expenses
 * @desc    Get all expenses with filtering
 * @access  Admin/Manager
 */
router.get('/', getExpenses);

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