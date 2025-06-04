const express = require('express');
const router = express.Router();
const expenseController = require('../../controllers/finance/expenseController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all expenses (finance admin and admin)
router.get('/', 
    checkRole('admin', 'finance_admin'), 
    expenseController.getAllExpenses
);

// Get expense by ID (finance admin and admin)
router.get('/:id', 
    checkRole('admin', 'finance_admin'), 
    expenseController.getExpenseById
);

// Create new expense (finance admin and admin)
router.post('/', 
    checkRole('admin', 'finance_admin'), 
    expenseController.createExpense
);

// Update existing expense (finance admin and admin)
router.put('/:id', 
    checkRole('admin', 'finance_admin'), 
    expenseController.updateExpense
);

// Delete expense (admin only)
router.delete('/:id', 
    checkRole('admin'), 
    expenseController.deleteExpense
);

// Get expense summary (finance admin and admin)
router.get('/summary/stats', 
    checkRole('admin', 'finance_admin'), 
    expenseController.getExpenseSummary
);

module.exports = router; 