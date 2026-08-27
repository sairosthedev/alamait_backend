const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const excelUpload = require('../../middleware/excelUpload');
const BillingDiscrepancyController = require('../../controllers/admin/billingDiscrepancyController');

router.use(auth);
router.use(checkRole('admin', 'ceo'));

/**
 * Admin rent accrual reconciliation
 * Base: /api/admin/rent-accrual-reconciliation
 */

router.get('/scan', BillingDiscrepancyController.scanPeriod);
router.post('/compare', BillingDiscrepancyController.compareList);
router.get('/student/:studentId/diagnose', BillingDiscrepancyController.diagnoseStudent);

router.post('/reconcile', BillingDiscrepancyController.reconcileRentAccruals);
router.post('/bulk-fix', BillingDiscrepancyController.bulkFix);
router.post('/auto-fix', BillingDiscrepancyController.autoFixPeriod);

/**
 * Upload actual-vs-system spreadsheet (two columns: what is correct vs what system shows).
 * Accepts: multipart file, JSON { text, month, year }, or JSON { rows, month, year }
 */
router.post(
    '/upload-compare',
    excelUpload.single('file'),
    BillingDiscrepancyController.uploadCompare
);

/**
 * Apply fixes from upload-compare (missing accruals + early departures).
 * Pass comparisonResult from upload-compare, or re-upload the same list.
 */
router.post(
    '/upload-fix',
    excelUpload.single('file'),
    BillingDiscrepancyController.uploadFix
);

router.post('/apply-actions', BillingDiscrepancyController.applyActions);
router.post('/negotiate', BillingDiscrepancyController.negotiateRent);

module.exports = router;
