const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const expenseController = require('../../controllers/finance/expenseController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Get all expenses
router.get('/', expenseController.getAllExpenses);

// Get expense by ID
router.get('/:id', expenseController.getExpenseById);

// Create new expense (admin and finance_admin only)
router.post('/', 
    checkRole('admin', 'finance_admin'),
    expenseController.createExpense
);

// Update expense (admin and finance_admin only)
router.put('/:id', 
    checkRole('admin', 'finance_admin'),
    expenseController.updateExpense
);

// Delete expense (admin and finance roles)
router.delete('/:id', 
    checkRole('admin', 'finance_admin', 'finance_user'),
    expenseController.deleteExpense
);

// Record payment for expense (creates transaction entries)
router.post('/:id/payments', 
    checkRole('admin', 'finance_admin', 'finance_user'), 
    expenseController.recordExpensePayment
);

// Get expense summary
router.get('/summary/summary', 
    expenseController.getExpenseSummary
);

// Approve expense (admin only)
router.patch('/:id/approve', 
    checkRole('admin'), 
    expenseController.approveExpense
);

// Mark expense as paid (finance users and admin)
router.patch('/:id/mark-paid', 
    checkRole('admin', 'finance_admin', 'finance_user'), 
    expenseController.markExpenseAsPaid
);

module.exports = router; 