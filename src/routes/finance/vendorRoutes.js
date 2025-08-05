const express = require('express');
const router = express.Router();
const vendorController = require('../../controllers/vendorController');
const { auth, checkRole } = require('../../middleware/auth');

// All routes require authentication and finance role
router.use(auth);
router.use(checkRole(['admin', 'finance', 'finance_admin', 'finance_user']));

// Get all vendors (Finance only)
router.get('/', vendorController.getAllVendors);

// Get vendors for quotation system (Finance only)
router.get('/for-quotations', vendorController.getVendorsForQuotations);

// Search vendors (Finance only)
router.get('/search', vendorController.searchVendors);

// Get vendors by category (Finance only)
router.get('/category/:category', vendorController.getVendorsByCategory);

// Get creditors (vendors) - Finance only
router.get('/creditors', vendorController.getCreditors);

// Get debtors (students/tenants) - Finance only
router.get('/debtors', vendorController.getDebtors);

// Get creditor summary - Finance only
router.get('/creditors/:vendorId/summary', vendorController.getCreditorSummary);

// Get vendor transactions (ledger) - Finance only (must be before /:id route)
router.get('/:id/transactions', vendorController.getVendorTransactions);

// Get vendor by ID (Finance only) - This must be last to avoid catching other routes
router.get('/:id', vendorController.getVendorById);

// Create new vendor (Finance only)
router.post('/', vendorController.createVendor);

// Update vendor (Finance only)
router.put('/:id', vendorController.updateVendor);

// Update vendor performance (Finance only)
router.patch('/:id/performance', vendorController.updateVendorPerformance);

// Delete vendor (Admin only)
router.delete('/:id', checkRole(['admin']), vendorController.deleteVendor);

module.exports = router; 