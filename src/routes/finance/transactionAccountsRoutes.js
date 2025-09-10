const express = require('express');
const router = express.Router();
const TransactionAccountsController = require('../../controllers/finance/transactionAccountsController');
const { auth } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all accounts for transaction creation
 * GET /api/finance/transaction-accounts
 */
router.get('/', TransactionAccountsController.getAccounts);

/**
 * Get account mappings for specific transaction types
 * POST /api/finance/transaction-accounts/mappings/:transactionType
 */
router.post('/mappings/:transactionType', TransactionAccountsController.getTransactionTypeMapping);

/**
 * Get student-specific accounts receivable account
 * POST /api/finance/transaction-accounts/student-ar
 */
router.post('/student-ar', TransactionAccountsController.getStudentARAccount);

module.exports = router;
