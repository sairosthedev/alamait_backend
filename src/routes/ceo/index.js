const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import CEO controllers
const dashboardController = require('../../controllers/ceo/dashboardController');
const requestController = require('../../controllers/ceo/requestController');
const auditController = require('../../controllers/ceo/auditController');

// Import finance controllers for financial data
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const incomeStatementController = require('../../controllers/finance/incomeStatementController');
const expenseController = require('../../controllers/finance/expenseController');

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

// Dashboard routes
router.get('/dashboard/overview', dashboardController.getDashboardOverview);
router.get('/dashboard/income-distribution', dashboardController.getIncomeDistribution);
router.get('/dashboard/expense-distribution', dashboardController.getExpenseDistribution);
router.get('/dashboard/recent-transactions', dashboardController.getRecentTransactions);
router.get('/dashboard/recent-requests', dashboardController.getRecentRequests);

// Financial routes (using finance controllers for consistent data)
router.get('/financial/income-statements', incomeStatementController.getAllIncomeStatements);
router.get('/financial/income-statements/:id', incomeStatementController.getIncomeStatementById);
router.get('/financial/balance-sheets', balanceSheetController.getAllBalanceSheets);
router.get('/financial/balance-sheets/:id', balanceSheetController.getBalanceSheetById);
router.get('/financial/expenses', expenseController.getAllExpenses);
router.get('/financial/expenses/:id', expenseController.getExpenseById);

// Request routes
router.get('/requests', requestController.getAllRequests);
router.get('/requests/:id', requestController.getRequestById);
router.get('/requests/pending-ceo-approval', requestController.getPendingCEOApproval);
router.patch('/requests/:id/approve', approvalValidation, requestController.approveRequest);
router.patch('/requests/:id/reject', rejectionValidation, requestController.rejectRequest);
router.patch('/requests/:id/change-quotation', quotationChangeValidation, requestController.changeQuotation);

// Audit routes
router.get('/audit/reports', auditController.getAuditReports);
router.get('/audit/trail', auditController.getAuditTrail);
router.get('/audit/trail/:id', auditController.getAuditTrailById);

module.exports = router; 