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
 * Get all transactions (paginated)
 * GET /api/finance/transactions?page=1&limit=50
 * Max limit: 100. Use pagination.total / pagination.pages / hasNext from the response.
 */
router.get('/', TransactionController.getAllTransactions);

/**
 * Get transaction student list
 * GET /api/finance/transactions/student-list
 */
router.get('/student-list', TransactionController.getTransactionStudents);

/**
 * Get student accruals by month
 * GET /api/finance/transactions/student-accruals
 */
router.get('/student-accruals', TransactionController.getStudentAccruals);

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
 * Create negotiated payment transaction
 * POST /api/finance/transactions/create-negotiated-payment
 */
router.post('/create-negotiated-payment', TransactionController.createNegotiatedPayment);

/**
 * Forfeit a student (comprehensive no-show handling)
 * POST /api/finance/transactions/forfeit-student
 */
router.post('/forfeit-student', TransactionController.forfeitStudent);

/**
 * Reverse ALL accrual entries from lease start transaction for forfeiture
 * POST /api/finance/transactions/reverse-lease-start-accruals
 */
router.post('/reverse-lease-start-accruals', TransactionController.reverseLeaseStartAccruals);

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
 * Download Excel template for bulk journal upload
 * GET /api/finance/transactions/journal-excel-template
 */
router.get('/journal-excel-template', TransactionController.getJournalExcelTemplate);

/**
 * List month/tabs in an Excel workbook (for UI sheet picker)
 * POST /api/finance/transactions/list-excel-sheets
 * multipart: file
 */
const excelUpload = require('../../middleware/excelUpload');
router.post(
    '/list-excel-sheets',
    excelUpload.single('file'),
    TransactionController.listJournalExcelSheets
);

/**
 * Upload Excel file for bulk journal (manual double-entry) creation
 * POST /api/finance/transactions/upload-excel
 * multipart/form-data: file, residence (required), defaultDate, mode, sheet,
 *   requireStudentLink (default true), allowDuplicates (default false — blocks re-uploads)
 * sheet: all (default) | July | Jan,Feb,Mar | ask (returns picker list)
 * Duplicates are matched by metadata.excelJournalKey (and invoice fingerprint) and skipped.
 */
router.post(
    '/upload-excel',
    excelUpload.single('file'),
    TransactionController.uploadExcelJournals
);

/**
 * Reconcile external payment list vs system (dry run — no DB writes)
 * POST /api/finance/transactions/reconcile-payments
 * GET  /api/finance/transactions/reconcile-payments/system?residence=&sheetName=August
 */
const reconcileUpload = excelUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'compareFile', maxCount: 1 }
]);
router.get('/reconcile-payments/system', TransactionController.reconcilePaymentsSystemOnly);
router.post('/reconcile-payments/system', TransactionController.reconcilePaymentsSystemOnly);
router.post('/reconcile-payments', (req, res, next) => {
    if (req.is('multipart/form-data')) {
        return reconcileUpload(req, res, next);
    }
    next();
}, TransactionController.reconcilePayments);

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
 * Delete individual entry from entries array within a TransactionEntry
 * DELETE /api/finance/transactions/entries/:id/entry/:entryId
 */
router.delete('/entries/:id/entry/:entryId', TransactionController.deleteEntryFromTransactionEntry);

/**
 * Delete transaction entry (entire document)
 * DELETE /api/finance/transactions/entries/:id
 */
router.delete('/entries/:id', TransactionController.deleteTransactionEntry);

/**
 * Get transactions by account code (must be before /:id route)
 * GET /api/finance/transactions/account/:accountCode?debtorId=xxx&includeEntries=true
 */
router.get('/account/:accountCode', TransactionController.getTransactionsByAccount);

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