const express = require('express');
const router = express.Router();
const FinancialReportsController = require('../controllers/financialReportsController');
const { auth, financeAccess } = require('../middleware/auth');

/**
 * Financial Reports Routes
 * 
 * All routes require authentication and finance role
 */

// Apply authentication middleware to all routes
router.use(auth);
router.use(financeAccess);

/**
 * Income Statement
 * GET /api/financial-reports/income-statement?period=2025&basis=cash
 */
router.get('/income-statement', FinancialReportsController.generateIncomeStatement);

/**
 * Monthly Income Statement (January to December breakdown)
 * GET /api/financial-reports/monthly-income-statement?period=2025&basis=cash
 */
router.get('/monthly-income-statement', FinancialReportsController.generateMonthlyIncomeStatement);

/**
 * Monthly Breakdown (All months for a year)
 * GET /api/financial-reports/monthly-breakdown?period=2025&basis=accrual
 */
router.get('/monthly-breakdown', FinancialReportsController.generateMonthlyBreakdown);

/**
 * Comprehensive Monthly Income Statement (Detailed monthly breakdown)
 * GET /api/financial-reports/comprehensive-monthly-income?period=2025&basis=cash
 */
router.get('/comprehensive-monthly-income', FinancialReportsController.generateComprehensiveMonthlyIncomeStatement);

/**
 * Monthly Expenses
 * GET /api/financial-reports/monthly-expenses?period=2025&basis=cash
 */
router.get('/monthly-expenses', FinancialReportsController.generateMonthlyExpenses);

/**
 * Monthly Income & Expenses with Residence Filter (Dashboard)
 * GET /api/financial-reports/monthly-income-expenses?period=2025&basis=cash&residence=67d723cf20f89c4ae69804f3
 * Defaults to cash basis for dashboard display
 */
router.get('/monthly-income-expenses', FinancialReportsController.generateMonthlyIncomeExpenses);

/**
 * Monthly Balance Sheet (January to December breakdown)
 * GET /api/financial-reports/monthly-balance-sheet?period=2025&basis=cash
 */
router.get('/monthly-balance-sheet', FinancialReportsController.generateMonthlyBalanceSheet);

/**
 * Monthly Cash Flow (January to December breakdown)
 * GET /api/financial-reports/monthly-cash-flow?period=2025&basis=cash
 */
router.get('/monthly-cash-flow', FinancialReportsController.generateMonthlyCashFlow);

/**
 * Comprehensive Monthly Cash Flow (Detailed monthly breakdown)
 * GET /api/financial-reports/comprehensive-monthly-cash-flow?period=2025&basis=cash
 */
router.get('/comprehensive-monthly-cash-flow', FinancialReportsController.generateComprehensiveMonthlyCashFlow);

/**
 * Balance Sheet
 * GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash
 */
router.get('/balance-sheet', FinancialReportsController.generateBalanceSheet);

/**
 * Balance Sheet Accounts (from Chart of Accounts)
 * GET /api/financial-reports/balance-sheet-accounts?includeInactive=false
 */
router.get('/balance-sheet-accounts', FinancialReportsController.getBalanceSheetAccounts);

/**
 * Cash Flow Statement
 * GET /api/financial-reports/cash-flow?period=2025&basis=cash
 */
router.get('/cash-flow', FinancialReportsController.generateCashFlowStatement);

/**
 * Residence-Filtered Cash Flow Statement
 * GET /api/financial-reports/cash-flow/residences?period=2025&basis=cash&residence=67d723cf20f89c4ae69804f3
 */
router.get('/cash-flow/residences', FinancialReportsController.generateResidenceFilteredCashFlowStatement);

/**
 * Residence-Filtered Cash Flow Statement
 * GET /api/financial-reports/cash-flow/residences?period=2025&basis=cash&residence=67d723cf20f89c4ae69804f3
 */
router.get('/cash-flow/residences', FinancialReportsController.generateResidenceFilteredCashFlowStatement);

/**
 * Trial Balance
 * GET /api/financial-reports/trial-balance?asOf=2025-12-31&basis=cash
 */
router.get('/trial-balance', FinancialReportsController.generateTrialBalance);

/**
 * General Ledger
 * GET /api/financial-reports/general-ledger?accountCode=1000&period=2025&basis=cash
 */
router.get('/general-ledger', FinancialReportsController.generateGeneralLedger);

/**
 * Account Balances
 * GET /api/financial-reports/account-balances?asOf=2025-12-31&basis=cash
 */
router.get('/account-balances', FinancialReportsController.getAccountBalances);

/**
 * Financial Summary
 * GET /api/financial-reports/financial-summary?period=2025&basis=cash
 */
router.get('/financial-summary', FinancialReportsController.getFinancialSummary);

/**
 * Export Financial Report
 * POST /api/financial-reports/export
 */
router.post('/export', FinancialReportsController.exportFinancialReport);

module.exports = router; 