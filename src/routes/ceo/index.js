const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import CEO controllers for request management
const requestController = require('../../controllers/ceo/requestController');
const auditController = require('../../controllers/ceo/auditController');

// Import finance controllers for financial data (same as finance routes)
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const incomeStatementController = require('../../controllers/finance/incomeStatementController');
const expenseController = require('../../controllers/finance/expenseController');
const TransactionController = require('../../controllers/finance/transactionController');

// Import analytics service for dashboard data (same as admin uses)
const analyticsService = require('../../services/analyticsService');

// Validation middleware
const approvalValidation = [
    check('notes').optional().trim().notEmpty().withMessage('Notes cannot be empty if provided')
];

const rejectionValidation = [
    check('notes').notEmpty().trim().withMessage('Rejection notes are required')
];

const quotationChangeValidation = [
    check('quotationId').notEmpty().withMessage('Quotation ID is required'),
    check('reason').notEmpty().trim().withMessage('Reason for quotation change is required')
];

// All CEO routes require CEO role
router.use(auth);
router.use(checkRole('ceo'));

// Dashboard data (same as admin dashboard)
router.get('/dashboard/overview', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const [financial, students, maintenance] = await Promise.all([
            analyticsService.getFinancialOverview(start, end),
            analyticsService.getStudentStatistics(),
            analyticsService.getMaintenanceOverview()
        ]);

        res.json({
            financial,
            students,
            maintenance
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ message: 'Error fetching dashboard overview' });
    }
});

// Financial data (same endpoints as finance uses)
router.get('/financial/income-statements', incomeStatementController.getAllIncomeStatements);
router.get('/financial/income-statements/:id', incomeStatementController.getIncomeStatementById);
router.get('/financial/balance-sheets', balanceSheetController.getAllBalanceSheets);
router.get('/financial/balance-sheets/:id', balanceSheetController.getBalanceSheetById);
router.get('/financial/expenses', expenseController.getAllExpenses);
router.get('/financial/expenses/:id', expenseController.getExpenseById);

// Transaction data (same endpoints as finance uses)
router.get('/financial/transactions', TransactionController.getAllTransactions);
router.get('/financial/transactions/summary', TransactionController.getTransactionSummary);
router.get('/financial/transactions/entries', TransactionController.getTransactionEntries);
router.get('/financial/transactions/:id', TransactionController.getTransactionById);
router.get('/financial/transactions/:id/entries', TransactionController.getTransactionEntriesById);
router.get('/financial/transactions/transaction-history/:sourceType/:sourceId', TransactionController.getTransactionHistory);

// Request management (CEO specific)
router.get('/requests', requestController.getAllRequests);
router.get('/requests/:id', requestController.getRequestById);
router.get('/requests/pending-ceo-approval', requestController.getPendingCEOApproval);
router.patch('/requests/:id/approve', approvalValidation, requestController.approveRequest);
router.patch('/requests/:id/reject', rejectionValidation, requestController.rejectRequest);
router.patch('/requests/:id/change-quotation', quotationChangeValidation, requestController.changeQuotation);

// Audit data (same endpoints as finance uses)
router.get('/audit/reports', auditController.getAuditReports);
router.get('/audit/trail', auditController.getAuditTrail);
router.get('/audit/trail/:id', auditController.getAuditTrailById);

// Simple audit log endpoint (similar to admin audit-log)
router.get('/audit-log', auditController.getAuditLogs);

module.exports = router; 