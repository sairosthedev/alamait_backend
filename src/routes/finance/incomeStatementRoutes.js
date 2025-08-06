const express = require('express');
const router = express.Router();
const incomeStatementController = require('../../controllers/finance/incomeStatementController');
const FinancialReportsController = require('../../controllers/financialReportsController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Get all income statements
router.get('/', incomeStatementController.getAllIncomeStatements);

// Get income statement by ID
router.get('/:id', incomeStatementController.getIncomeStatementById);

// Create new income statement (admin and finance_admin only)
router.post('/', 
    checkRole('admin', 'finance_admin'),
    incomeStatementController.createIncomeStatement
);

// Update income statement (admin and finance_admin only)
router.put('/:id', 
    checkRole('admin', 'finance_admin'),
    incomeStatementController.updateIncomeStatement
);

// Delete income statement (admin only)
router.delete('/:id', 
    checkRole('admin'),
    incomeStatementController.deleteIncomeStatement
);

// Approve income statement (admin and CEO only)
router.patch('/:id/approve', 
    checkRole('admin', 'ceo'), 
    incomeStatementController.approveIncomeStatement
);

// NEW: Generate dynamic income statement report
// GET /api/finance/income-statements/report?period=2024&basis=cash
router.get('/report/generate', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    FinancialReportsController.generateIncomeStatement
);

module.exports = router; 