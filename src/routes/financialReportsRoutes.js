const express = require('express');
const router = express.Router();
const FinancialReportsController = require('../controllers/financialReportsController');
const { validateToken } = require('../middleware/auth');

/**
 * Financial Reports Routes
 * 
 * All routes require authentication and finance role
 */

// Apply authentication middleware to all routes
router.use(validateToken);

/**
 * Income Statement
 * GET /api/financial-reports/income-statement?period=2025&basis=cash
 */
router.get('/income-statement', FinancialReportsController.generateIncomeStatement);

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