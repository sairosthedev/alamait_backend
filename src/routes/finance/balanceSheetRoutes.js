const express = require('express');
const router = express.Router();
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all balance sheets (finance admin and admin)
router.get('/', 
    checkRole('admin', 'finance_admin'), 
    balanceSheetController.getAllBalanceSheets
);

// Get balance sheet by ID (finance admin and admin)
router.get('/:id', 
    checkRole('admin', 'finance_admin'), 
    balanceSheetController.getBalanceSheetById
);

// Create new balance sheet (finance admin and admin)
router.post('/', 
    checkRole('admin', 'finance_admin'), 
    balanceSheetController.createBalanceSheet
);

// Update existing balance sheet (finance admin and admin)
router.put('/:id', 
    checkRole('admin', 'finance_admin'), 
    balanceSheetController.updateBalanceSheet
);

// Delete balance sheet (admin only)
router.delete('/:id', 
    checkRole('admin'), 
    balanceSheetController.deleteBalanceSheet
);

// Approve balance sheet (admin only)
router.patch('/:id/approve', 
    checkRole('admin'), 
    balanceSheetController.approveBalanceSheet
);

module.exports = router;