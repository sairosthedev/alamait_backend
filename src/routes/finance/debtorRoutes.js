const express = require('express');
const router = express.Router();
const debtorController = require('../../controllers/finance/debtorController');
const leaseController = require('../../controllers/admin/leaseController');
const { auth, checkRole } = require('../../middleware/auth');
const {
    resolveReconciliationIdentifier,
    resolveDebtorIdParam,
    handleLeaseValidation
} = require('../../middleware/leaseValidation');

// All routes require authentication
router.use(auth);

// All routes require finance/admin roles
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

// Create new debtor account
router.post('/', debtorController.createDebtor);

// Get all debtors with filtering and pagination
router.get('/', debtorController.getAllDebtors);

// Static paths must be registered before :id (Express matches in order)
router.get('/comprehensive/all', debtorController.getAllDebtorsComprehensive);
router.get('/collection/report', debtorController.getDebtorsCollectionReport);
router.get('/collection/summary', debtorController.getDebtorCollectionSummary);
router.get('/check/students-without-debtors', debtorController.checkStudentsWithoutDebtors);
router.post('/bulk-create', debtorController.bulkCreateDebtors);
router.post('/bulk-create-for-students', debtorController.bulkCreateDebtorsForStudents);
router.post('/sync-ar', debtorController.syncDebtorWithAR);
router.post('/sync-all-payment-history', debtorController.syncAllDebtorsPaymentHistory);
router.post('/student/:userId', debtorController.createDebtorForExistingStudent);

// Resolve DR####, 1100-*, student/application ids to debtor _id for all :id routes below
router.param('id', (req, res, next, id) => {
    req.params.id = id;
    resolveDebtorIdParam(req, res, next);
});

// Lease vs accrual status (debtor detail pages — use when studentId is N/A)
router.get(
    '/:id/reconciliation',
    (req, res, next) => {
        req.params.debtorId = req.params.id;
        req.query.debtorId = req.params.id;
        next();
    },
    resolveReconciliationIdentifier,
    handleLeaseValidation,
    leaseController.getLeaseReconciliationStatus
);

router.get('/:id', debtorController.getDebtorById);

router.post('/:id/sync-operational-links', debtorController.syncDebtorOperationalLinks);

// Update debtor account
router.put('/:id', debtorController.updateDebtor);

// Add charge to debtor (when invoice is created)
router.post('/:id/charge', debtorController.addCharge);

// Add payment to debtor (when payment is received)
router.post('/:id/payment', debtorController.addPayment);

// Get debtor balance and history
router.get('/:id/balance', debtorController.getDebtorBalance);

// Sync debtor with AR data
router.post('/sync-ar/:id', debtorController.syncDebtorWithAR);

// Get comprehensive debtor data with all related collections
router.get('/:id/comprehensive', debtorController.getDebtorComprehensiveData);

// Get debtor payment history with detailed mapping
router.get('/:id/payment-history', debtorController.getDebtorPaymentHistory);

// Get debtor transactions
router.get('/:id/transactions', debtorController.getDebtorTransactions);

// Delete debtor account (only if no outstanding balance)
router.delete('/:id', debtorController.deleteDebtor);

// Sync payment history for a specific debtor
router.post('/:id/sync-payment-history', debtorController.syncDebtorPaymentHistory);

// Validate payment history for a debtor
router.get('/:id/validate-payment-history', debtorController.validateDebtorPaymentHistory);

module.exports = router; 