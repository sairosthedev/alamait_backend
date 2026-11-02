const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const {
    getAllLeases,
    getLease,
    getLeasesByStudent
} = require('../../controllers/finance/leaseController');
const leaseController = require('../../controllers/admin/leaseController');
const {
    validateApplicationId,
    validateDebtorId,
    resolveReconciliationIdentifier,
    handleLeaseValidation
} = require('../../middleware/leaseValidation');

const financeRoles = checkRole('admin', 'finance_admin', 'finance_user', 'ceo');

router.use(auth);
router.use(financeAccess);

router.get('/', financeRoles, getAllLeases);

router.get(
    '/reconciliation',
    financeRoles,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);

router.get('/students/:studentId', financeRoles, getLeasesByStudent);

// Literal "N/A" in URLs is two path segments (N + A), not one param — tenants without a User login
router.get(
    '/students/N/A/reconciliation',
    financeRoles,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);

router.get(
    '/applications/:applicationId/reconciliation',
    financeRoles,
    validateApplicationId,
    handleLeaseValidation,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/debtors/:debtorId/reconciliation',
    financeRoles,
    validateDebtorId,
    handleLeaseValidation,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/students/:studentId/reconciliation',
    financeRoles,
    resolveReconciliationIdentifier,
    leaseController.getLeaseReconciliationStatus
);

router.get('/:id', financeRoles, getLease);

module.exports = router;
