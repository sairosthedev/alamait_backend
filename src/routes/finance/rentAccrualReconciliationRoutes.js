const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const excelUpload = require('../../middleware/excelUpload');
const BillingDiscrepancyController = require('../../controllers/admin/billingDiscrepancyController');

const financeRoles = ['finance_admin', 'finance_user', 'ceo', 'admin'];

router.use(auth);
router.use(checkRole(...financeRoles));

/**
 * Finance rent accrual reconciliation
 * Base: /api/finance/rent-accrual-reconciliation
 */

router.get('/scan', BillingDiscrepancyController.scanPeriod);
router.post('/compare', BillingDiscrepancyController.compareList);
router.get('/student/:studentId/diagnose', BillingDiscrepancyController.diagnoseStudent);

router.post('/reconcile', BillingDiscrepancyController.reconcileRentAccruals);
router.post('/bulk-fix', BillingDiscrepancyController.bulkFix);
router.post('/auto-fix', BillingDiscrepancyController.autoFixPeriod);

router.post(
    '/upload-compare',
    excelUpload.single('file'),
    BillingDiscrepancyController.uploadCompare
);
router.post(
    '/upload-fix',
    excelUpload.single('file'),
    BillingDiscrepancyController.uploadFix
);

router.post('/apply-actions', BillingDiscrepancyController.applyActions);
router.post('/negotiate', BillingDiscrepancyController.negotiateRent);

module.exports = router;
