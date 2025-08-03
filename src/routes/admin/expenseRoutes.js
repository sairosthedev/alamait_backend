const express = require('express');
const router = express.Router();
const { getExpenses, addExpense, updateExpenseStatus, approveExpense, updateExpense } = require('../../controllers/admin/expenseController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Override the global admin role check for these routes
router.use((req, res, next) => {
    // Skip the global admin role check
    next();
});

// Route to handle GET and POST requests for expenses
router
    .route('/')
    .get(checkRole('admin', 'finance', 'finance_admin', 'finance_user'), getExpenses) // Allow finance roles to view
    .post(checkRole('admin', 'finance', 'finance_admin', 'finance_user'), addExpense); // Only admins and finance can add expenses

// Route to handle expense updates
router.put('/:expenseId', checkRole('admin', 'finance', 'finance_admin', 'finance_user'), updateExpense);

// Route to handle expense status updates
router.put('/:expenseId/status', checkRole('admin', 'finance', 'finance_admin', 'finance_user'), updateExpenseStatus);

// Route to handle expense approval
router.patch('/:id/approve', checkRole('admin', 'finance', 'ceo'), approveExpense);

module.exports = router;