const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Create new vendor (Admin and Finance only)
router.post('/', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.createVendor
);

// Get all vendors (Admin and Finance only)
router.get('/', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getAllVendors
);

// Get vendors for quotation system (Admin and Finance only)
router.get('/for-quotations', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getVendorsForQuotations
);

// Search vendors (for quotation system - Admin and Finance only)
router.get('/search', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.searchVendors
);

// Get vendors by category (Admin and Finance only)
router.get('/category/:category', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getVendorsByCategory
);

// Get vendor transactions (ledger) - Admin and Finance only (must be before /:id route)
router.get('/:id/transactions', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getVendorTransactions
);

// Update vendor performance (Admin and Finance only)
router.patch('/:id/performance', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.updateVendorPerformance
);

// Get creditors (vendors) - Admin and Finance only
router.get('/creditors', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getCreditors
);

// Get debtors (students/tenants) - Admin and Finance only
router.get('/debtors', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getDebtors
);

// Get creditor summary - Admin and Finance only
router.get('/creditors/:vendorId/summary', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getCreditorSummary
);

// Get vendor by ID (Admin and Finance only) - This must be last to avoid catching other routes
router.get('/:id', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.getVendorById
);

// Update vendor (Admin and Finance only)
router.put('/:id', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    vendorController.updateVendor
);

// Delete vendor (Admin only)
router.delete('/:id', 
    checkRole(['admin']), 
    vendorController.deleteVendor
);

module.exports = router; 