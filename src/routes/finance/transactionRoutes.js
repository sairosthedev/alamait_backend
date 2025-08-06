const express = require('express');
const router = express.Router();
const TransactionController = require('../../controllers/finance/transactionController');
const { auth, financeAccess } = require('../../middleware/auth');

/**
 * Transaction Routes
 * 
 * All routes require authentication and finance role
 */

// Apply authentication middleware to all routes
router.use(auth);
router.use(financeAccess);

/**
 * Create transaction entries for student payment
 * POST /api/finance/create-payment-transaction
 */
router.post('/create-payment-transaction', TransactionController.createPaymentTransaction);

/**
 * Create transaction entries for request approval (accrual)
 * POST /api/finance/create-approval-transaction
 */
router.post('/create-approval-transaction', TransactionController.createApprovalTransaction);

/**
 * Create transaction entries for refund
 * POST /api/finance/create-refund-transaction
 */
router.post('/create-refund-transaction', TransactionController.createRefundTransaction);

/**
 * Create transaction entries for invoice payment
 * POST /api/finance/create-invoice-payment-transaction
 */
router.post('/create-invoice-payment-transaction', TransactionController.createInvoicePaymentTransaction);

/**
 * Verify transaction creation for a specific source
 * GET /api/finance/verify-transaction/:sourceType/:sourceId
 */
router.get('/verify-transaction/:sourceType/:sourceId', TransactionController.verifyTransaction);

/**
 * Get transaction history for a specific source
 * GET /api/finance/transaction-history/:sourceType/:sourceId
 */
router.get('/transaction-history/:sourceType/:sourceId', TransactionController.getTransactionHistory);

module.exports = router; 