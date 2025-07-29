const express = require('express');
const router = express.Router();
const otherIncomeController = require('../../controllers/finance/otherIncomeController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all other income entries (finance admin, admin, and CEO)
router.get('/', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherIncomeController.getAllOtherIncome
);

// Get other income summary statistics (finance admin, admin, and CEO)
router.get('/summary/stats', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherIncomeController.getOtherIncomeSummary
);

// Get other income by ID (finance admin, admin, and CEO)
router.get('/:id', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    otherIncomeController.getOtherIncomeById
);

// Create new other income entry (finance admin and admin)
router.post('/', 
    checkRole('admin', 'finance_admin'), 
    otherIncomeController.createOtherIncome
);

// Update other income entry (finance admin and admin)
router.put('/:id', 
    checkRole('admin', 'finance_admin'), 
    otherIncomeController.updateOtherIncome
);

// Delete other income entry (finance admin and admin)
router.delete('/:id', 
    checkRole('admin', 'finance_admin'), 
    otherIncomeController.deleteOtherIncome
);

module.exports = router; 