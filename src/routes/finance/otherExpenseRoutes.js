const express = require('express');
const router = express.Router();
const otherExpenseController = require('../../controllers/finance/otherExpenseController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all other expense entries (finance admin, admin, and CEO)
router.get('/', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherExpenseController.getAllOtherExpenses
);

// Get other expense summary statistics (finance admin, admin, and CEO)
router.get('/summary/stats', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherExpenseController.getOtherExpenseSummary
);

// Get other expense by ID (finance admin, admin, and CEO)
router.get('/:id', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherExpenseController.getOtherExpenseById
);

// Create new other expense entry (finance admin and admin)
router.post('/', 
    checkRole('admin', 'finance_admin'), 
    otherExpenseController.createOtherExpense
);

// Update other expense entry (finance admin and admin)
router.put('/:id', 
    checkRole('admin', 'finance_admin'), 
    otherExpenseController.updateOtherExpense
);

// Delete other expense entry (finance admin and admin)
router.delete('/:id', 
    checkRole('admin', 'finance_admin'), 
    otherExpenseController.deleteOtherExpense
);

module.exports = router; 