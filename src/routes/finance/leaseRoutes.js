const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const {
    getAllLeases,
    getLease,
    getLeaseStats,
    getLeasesByStudent
} = require('../../controllers/finance/leaseController');
const leaseController = require('../../controllers/admin/leaseController');
const {
    validateStudentId,
    validateApplicationId,
    validateDebtorId
} = require('../../middleware/leaseValidation');

const financeRoles = checkRole('admin', 'finance_admin', 'finance_user', 'ceo');

router.use(auth);
router.use(financeAccess);

router.get('/', financeRoles, getAllLeases);

// Specific paths before /:id
router.get('/students/:studentId', financeRoles, getLeasesByStudent);

router.get(
    '/applications/:applicationId/reconciliation',
    financeRoles,
    validateApplicationId,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/debtors/:debtorId/reconciliation',
    financeRoles,
    validateDebtorId,
    leaseController.getLeaseReconciliationStatus
);
router.get(
    '/students/:studentId/reconciliation',
    financeRoles,
    validateStudentId,
    leaseController.getLeaseReconciliationStatus
);

router.get('/:id', financeRoles, getLease);

module.exports = router;
