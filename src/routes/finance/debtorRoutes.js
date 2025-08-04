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

// Delete debtor account (only if no outstanding balance)
router.delete('/:id', debtorController.deleteDebtor);

module.exports = router; 