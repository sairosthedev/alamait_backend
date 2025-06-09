const express = require('express');
const router = express.Router();
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all assets
router.get('/assets',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.getAllAssets
);

// Create new asset
router.post('/assets',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.createAsset
);

// Update asset
router.put('/assets/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.updateAsset
);

// Delete asset
router.delete('/assets/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.deleteAsset
);

// Get all liabilities
router.get('/liabilities',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.getAllLiabilities
);

// Create new liability
router.post('/liabilities',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.createLiability
);

// Update liability
router.put('/liabilities/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.updateLiability
);

// Delete liability
router.delete('/liabilities/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.deleteLiability
);

// Get all equity
router.get('/equity',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.getAllEquity
);

// Create new equity
router.post('/equity',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.createEquity
);

// Update equity
router.put('/equity/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.updateEquity
);

// Delete equity
router.delete('/equity/:id',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.deleteEquity
);

// Get all balance sheet entries
router.get('/entries',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.getAllBalanceSheetEntries
);

// Get latest balance sheet
router.get('/latest',
    checkRole('admin', 'finance_admin'),
    balanceSheetController.getLatestBalanceSheet
);

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

// Add entry to balance sheet
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