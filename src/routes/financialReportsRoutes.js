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
 * Monthly Expenses
 * GET /api/financial-reports/monthly-expenses?period=2025&basis=cash
 */
router.get('/monthly-expenses', FinancialReportsController.generateMonthlyExpenses);

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
 * Balance Sheet
 * GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash
 */
router.get('/balance-sheet', FinancialReportsController.generateBalanceSheet);

/**
 * Cash Flow Statement
 * GET /api/financial-reports/cash-flow?period=2025&basis=cash
 */
router.get('/cash-flow', FinancialReportsController.generateCashFlowStatement);

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