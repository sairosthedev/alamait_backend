const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const excelUpload = require('../../middleware/excelUpload');
const BillingDiscrepancyController = require('../../controllers/admin/billingDiscrepancyController');
const leaseController = require('../../controllers/admin/leaseController');
const {
    validateApplicationId,
    resolveReconciliationIdentifier,
    handleLeaseValidation
} = require('../../middleware/leaseValidation');

router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

/**
 * Admin rent accrual reconciliation
 * Base: /api/admin/rent-accrual-reconciliation
 */

router.get('/scan', BillingDiscrepancyController.scanPeriod);
router.get('/property-scan', BillingDiscrepancyController.scanPropertyAccruals);
router.post('/compare', BillingDiscrepancyController.compareList);
router.get('/student/:studentId/diagnose', BillingDiscrepancyController.diagnoseStudent);

router.get(
    '/applications/:applicationId/reconciliation',
    (req, res, next) => {
        req.query.applicationId = req.params.applicationId;
        next();
    },
    validateApplicationId,
    handleLeaseValidation,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/debtors/:debtorId/reconciliation',
    (req, res, next) => {
        req.query.debtorId = req.params.debtorId;
        next();
    },
    resolveReconciliationIdentifier,
    handleLeaseValidation,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/students/:studentId/reconciliation',
    (req, res, next) => {
        req.query.studentId = req.params.studentId;
        next();
    },
    resolveReconciliationIdentifier,
    handleLeaseValidation,
    leaseController.getLeaseReconciliationStatus
);

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
