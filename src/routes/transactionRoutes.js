const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { auth, checkRole } = require('../middleware/auth');

// Root route for /api/transactions (for frontend compatibility)
router.get('/', auth, transactionController.getAllTransactions);

// Get all transactions with entries (for frontend compatibility)
router.get('/all', auth, transactionController.getAllTransactions);

// Get transaction entries with filters
router.get('/entries', auth, transactionController.getTransactionEntries);

// Get transaction summary
router.get('/summary', auth, transactionController.getTransactionSummary);

// Get single transaction entry
router.get('/entries/:id', auth, transactionController.getTransactionEntry);

// Create manual transaction entry
router.post('/entries', auth, checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), transactionController.createTransactionEntry);

// Get accounts for dropdown
router.get('/accounts', auth, transactionController.getAccounts);

module.exports = router; 