const express = require('express');
const router = express.Router();
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const FinancialReportsController = require('../../controllers/financialReportsController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Get all balance sheets
router.get('/', balanceSheetController.getAllBalanceSheets);

// Get balance sheet by ID
router.get('/:id', balanceSheetController.getBalanceSheetById);

// Create new balance sheet (admin and finance_admin only)
router.post('/', 
    checkRole('admin', 'finance_admin'),
    balanceSheetController.createBalanceSheet
);

// Update balance sheet (admin and finance_admin only)
router.put('/:id', 
    checkRole('admin', 'finance_admin'),
    balanceSheetController.updateBalanceSheet
);

// Delete balance sheet (admin only)
router.delete('/:id', 
    checkRole('admin'),
    balanceSheetController.deleteBalanceSheet
);

// Approve balance sheet (admin and CEO only)
router.patch('/:id/approve', 
    checkRole('admin', 'ceo'), 
    balanceSheetController.approveBalanceSheet
);

// NEW: Generate dynamic balance sheet report
// GET /api/finance/balance-sheets/report?asOf=2024-12-31&basis=cash
router.get('/report/generate', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    FinancialReportsController.generateBalanceSheet
);

// Balance sheet drill-down functionality
// GET /api/finance/balance-sheets/account-details?period=2025&month=july&accountCode=1000
router.get('/account-details', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    balanceSheetController.getAccountTransactionDetails
);

// Balance sheet with drill-down links
// GET /api/finance/balance-sheets/with-drilldown?period=2025&basis=cash
router.get('/with-drilldown', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    balanceSheetController.getBalanceSheetWithDrillDown
);

module.exports = router;