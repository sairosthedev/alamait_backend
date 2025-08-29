const express = require('express');
const router = express.Router();
const debtorController = require('../../controllers/finance/debtorController');
const { auth, checkRole } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// All routes require finance/admin roles
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

// Create new debtor account
router.post('/', debtorController.createDebtor);

// Get all debtors with filtering and pagination
router.get('/', debtorController.getAllDebtors);

// Get debtor by ID
router.get('/:id', debtorController.getDebtorById);

// Update debtor account
router.put('/:id', debtorController.updateDebtor);

// Add charge to debtor (when invoice is created)
router.post('/:id/charge', debtorController.addCharge);

// Add payment to debtor (when payment is received)
router.post('/:id/payment', debtorController.addPayment);

// Get debtor balance and history
router.get('/:id/balance', debtorController.getDebtorBalance);

// Get all debtors with comprehensive data mapping
router.get('/comprehensive/all', debtorController.getAllDebtorsComprehensive);

// Get debtors collection report with AR linkage
router.get('/collection/report', debtorController.getDebtorsCollectionReport);

// Get debtor collection summary
router.get('/collection/summary', debtorController.getDebtorCollectionSummary);

// Sync debtor with AR data
router.post('/sync-ar/:id', debtorController.syncDebtorWithAR);
router.post('/sync-ar', debtorController.syncDebtorWithAR);

// Get comprehensive debtor data with all related collections
router.get('/:id/comprehensive', debtorController.getDebtorComprehensiveData);

// Get debtor payment history with detailed mapping
router.get('/:id/payment-history', debtorController.getDebtorPaymentHistory);

// Create debtor for existing student
router.post('/student/:userId', debtorController.createDebtorForExistingStudent);

// Bulk create debtors for all students
router.post('/bulk-create', debtorController.bulkCreateDebtors);

// Check which students don't have debtor accounts
router.get('/check/students-without-debtors', debtorController.checkStudentsWithoutDebtors);

// Bulk create debtor accounts for students without debtors
router.post('/bulk-create-for-students', debtorController.bulkCreateDebtorsForStudents);

// Delete debtor account (only if no outstanding balance)
router.delete('/:id', debtorController.deleteDebtor);

// Sync payment history for a specific debtor
router.post('/:id/sync-payment-history', debtorController.syncDebtorPaymentHistory);

// Sync payment history for all debtors
router.post('/sync-all-payment-history', debtorController.syncAllDebtorsPaymentHistory);

// Validate payment history for a debtor
router.get('/:id/validate-payment-history', debtorController.validateDebtorPaymentHistory);

module.exports = router; 