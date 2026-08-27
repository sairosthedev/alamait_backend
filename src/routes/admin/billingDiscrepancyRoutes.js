const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const BillingDiscrepancyController = require('../../controllers/admin/billingDiscrepancyController');

const readRoles = ['admin', 'finance_admin', 'finance_user', 'ceo'];
const accrualReconcileRoles = ['admin', 'finance_admin', 'finance_user', 'ceo'];

router.use(auth);

/**
 * - Admin: lease dates + rent accrual reconciliation → /api/admin/rent-accrual-reconciliation
 * - Finance: rent accrual reconciliation + payments & negotiations
 */

router.get('/scan', checkRole(...readRoles), BillingDiscrepancyController.scanPeriod);
router.post('/compare', checkRole(...readRoles), BillingDiscrepancyController.compareList);
router.get('/student/:studentId/diagnose', checkRole(...readRoles), BillingDiscrepancyController.diagnoseStudent);

router.post('/reconcile', checkRole(...accrualReconcileRoles), BillingDiscrepancyController.reconcileRentAccruals);
router.post('/bulk-fix', checkRole(...accrualReconcileRoles), BillingDiscrepancyController.bulkFix);
router.post('/auto-fix', checkRole(...accrualReconcileRoles), BillingDiscrepancyController.autoFixPeriod);

module.exports = router;
