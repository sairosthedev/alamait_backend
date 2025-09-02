const express = require('express');
const router = express.Router();
const TransactionController = require('../../controllers/finance/transactionController');
const { auth, financeAccess } = require('../../middleware/auth');

/**
 * Transaction Routes
 * 
 * All routes require authentication and finance role
 * Base path: /api/finance/transactions
 */

// Apply authentication middleware to all routes
router.use(auth);
router.use(financeAccess);

/**
 * Get all transactions
 * GET /api/finance/transactions
 */
router.get('/', TransactionController.getAllTransactions);

/**
 * Get transaction summary
 * GET /api/finance/transactions/summary
 */
router.get('/summary', TransactionController.getTransactionSummary);

/**
 * Get transaction entries with filters
 * GET /api/finance/transactions/entries
 */
router.get('/entries', TransactionController.getTransactionEntries);

/**
 * Create transaction entries for student payment
 * POST /api/finance/transactions/create-payment-transaction
 */
router.post('/create-payment-transaction', TransactionController.createPaymentTransaction);

/**
 * Create transaction entries for request approval (accrual)
 * POST /api/finance/transactions/create-approval-transaction
 */
router.post('/create-approval-transaction', TransactionController.createApprovalTransaction);

/**
 * Create transaction entries for refund
 * POST /api/finance/transactions/create-refund-transaction
 */
router.post('/create-refund-transaction', TransactionController.createRefundTransaction);

/**
 * Create transaction entries for invoice payment
 * POST /api/finance/transactions/create-invoice-payment-transaction
 */
router.post('/create-invoice-payment-transaction', TransactionController.createInvoicePaymentTransaction);

/**
 * Create double-entry transaction
 * POST /api/finance/transactions/create-double-entry
 */
router.post('/create-double-entry', TransactionController.createDoubleEntryTransaction);

/**
 * Upload CSV for bulk transaction creation
 * POST /api/finance/transactions/upload-csv
 */
router.post('/upload-csv', TransactionController.uploadCsvTransactions);

/**
 * Get CSV template
 * GET /api/finance/transactions/csv-template
 */
router.get('/csv-template', TransactionController.getCsvTemplate);

/**
 * Verify transaction creation for a specific source
 * GET /api/finance/transactions/verify-transaction/:sourceType/:sourceId
 */
router.get('/verify-transaction/:sourceType/:sourceId', TransactionController.verifyTransaction);

/**
 * Get transaction history for a specific source
 * GET /api/finance/transactions/transaction-history/:sourceType/:sourceId
 */
router.get('/transaction-history/:sourceType/:sourceId', TransactionController.getTransactionHistory);

/**
 * Update transaction entry
 * PUT /api/finance/transactions/entries/:id
 */
router.put('/entries/:id', TransactionController.updateTransactionEntry);

/**
 * Delete transaction entry
 * DELETE /api/finance/transactions/entries/:id
 */
router.delete('/entries/:id', TransactionController.deleteTransactionEntry);

/**
 * Get transaction entries by transaction ID
 * GET /api/finance/transactions/:id/entries
 */
router.get('/:id/entries', TransactionController.getTransactionEntriesById);

/**
 * Update multiple transaction entries for a transaction
 * PUT /api/finance/transactions/:transactionId/entries
 */
router.put('/:transactionId/entries', TransactionController.updateTransactionEntries);

/**
 * Get transaction by ID (must be last to avoid conflicts)
 * GET /api/finance/transactions/:id
 */
router.get('/:id', TransactionController.getTransactionById);

module.exports = router; 