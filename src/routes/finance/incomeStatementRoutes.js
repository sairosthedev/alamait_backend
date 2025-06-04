const express = require('express');
const router = express.Router();
const incomeStatementController = require('../../controllers/finance/incomeStatementController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all income statements (finance admin and admin)
router.get('/', 
    checkRole('admin', 'finance_admin'), 
    incomeStatementController.getAllIncomeStatements
);

// Get income statement by ID (finance admin and admin)
router.get('/:id', 
    checkRole('admin', 'finance_admin'), 
    incomeStatementController.getIncomeStatementById
);

// Create new income statement (finance admin and admin)
router.post('/', 
    checkRole('admin', 'finance_admin'), 
    incomeStatementController.createIncomeStatement
);

// Update existing income statement (finance admin and admin)
router.put('/:id', 
    checkRole('admin', 'finance_admin'), 
    incomeStatementController.updateIncomeStatement
);

// Delete income statement (admin only)
router.delete('/:id', 
    checkRole('admin'), 
    incomeStatementController.deleteIncomeStatement
);

// Approve income statement (admin only)
router.patch('/:id/approve', 
    checkRole('admin'), 
    incomeStatementController.approveIncomeStatement
);

module.exports = router; 