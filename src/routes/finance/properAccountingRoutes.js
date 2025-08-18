const express = require('express');
const router = express.Router();
const ProperAccountingController = require('../../controllers/finance/properAccountingController');
const { auth, checkRole } = require('../../middleware/auth');

/**
 * PROPER ACCOUNTING ROUTES
 * 
 * Provides GAAP-compliant financial statement endpoints:
 * - Income Statement: Accrual Basis (recognizes revenue when earned, expenses when incurred)
 * - Cash Flow Statement: Cash Basis (only actual cash movements)
 * - Balance Sheet: Cash Basis (only actual cash and cash equivalents)
 * 
 * All endpoints support residence filtering and follow proper accounting principles
 */

// Apply authentication and authorization middleware to all routes
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

/**
 * INCOME STATEMENT - ACCRUAL BASIS
 * 
 * Accrual Basis Principles:
 * - Revenue recognized when EARNED (not when cash received)
 * - Expenses recognized when INCURRED (not when cash paid)
 * - Includes accruals, deferrals, and period matching
 * - Follows GAAP principles for accurate financial reporting
 */
router.get('/income-statement', ProperAccountingController.generateAccrualBasisIncomeStatement);

/**
 * CASH FLOW STATEMENT - CASH BASIS
 * 
 * Cash Basis Principles:
 * - Only actual cash receipts and payments
 * - No accruals or deferrals
 * - Must reconcile with cash balance changes
 * - Shows actual cash position and liquidity
 */
router.get('/cash-flow', ProperAccountingController.generateCashBasisCashFlowStatement);

/**
 * BALANCE SHEET - CASH BASIS
 * 
 * Cash Basis Principles:
 * - Only actual cash and cash equivalents
 * - No accounts receivable or accounts payable
 * - No prepaid expenses or deferred revenue
 * - Real-time balances from transaction entries
 */
router.get('/balance-sheet', ProperAccountingController.generateCashBasisBalanceSheet);

/**
 * COMPLETE RESIDENCE FINANCIAL STATEMENTS
 * 
 * Provides all three statements for a specific residence:
 * - Accrual Basis Income Statement
 * - Cash Basis Cash Flow Statement
 * - Cash Basis Balance Sheet
 * 
 * This endpoint is useful for comprehensive financial analysis of a specific property
 */
router.get('/residence-statements', ProperAccountingController.generateResidenceFinancialStatements);

/**
 * AVAILABLE RESIDENCES FOR FILTERING
 * 
 * Returns list of all residences available for financial statement filtering
 * Useful for frontend dropdowns and residence selection
 */
router.get('/residences', ProperAccountingController.getAvailableResidences);

/**
 * ACCOUNTING BASIS EXPLANATION
 * 
 * Returns detailed explanation of the accounting bases used
 * Educational endpoint for users to understand the accounting principles
 */
router.get('/explanation', ProperAccountingController.getAccountingBasisExplanation);

module.exports = router;
