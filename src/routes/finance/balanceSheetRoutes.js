const express = require('express');
const router = express.Router();
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
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

// Generate balance sheet (admin and finance_admin only)
// router.post('/generate', 
//     checkRole('admin', 'finance_admin'),
//     balanceSheetController.generateBalanceSheet
// );

// Approve balance sheet (admin only)
router.patch('/:id/approve', 
    checkRole('admin'), 
    balanceSheetController.approveBalanceSheet
);

// Add entry to balance sheet (admin and finance_admin only)
router.post('/:id/entries', 
    checkRole('admin', 'finance_admin'),
    balanceSheetController.addBalanceSheetEntry
);

// Update balance sheet entry
router.put('/:id/entries/:entryId',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.updateBalanceSheetEntry
);

// Delete balance sheet entry
router.delete('/:id/entries/:entryId',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.deleteBalanceSheetEntry
);

module.exports = router;