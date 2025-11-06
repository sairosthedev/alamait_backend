const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const DebtorLedgerController = require('../../controllers/finance/debtorLedgerController');

// Apply authentication and role checking to all routes
router.use(auth);
router.use(checkRole(['admin', 'finance']));

/**
 * @route   GET /api/finance/debtors/:debtorId/ledger
 * @desc    Get transaction-based ledger data for a specific debtor
 * @access  Private (Admin/Finance)
 * @params  debtorId - Debtor ID
 * @query   studentId - Student ID (required)
 */
router.get('/:debtorId/ledger', DebtorLedgerController.getDebtorLedger);

/**
 * @route   GET /api/finance/debtors/:debtorId/ledger/monthly
 * @desc    Get monthly breakdown for a specific debtor
 * @access  Private (Admin/Finance)
 * @params  debtorId - Debtor ID
 * @query   studentId - Student ID (required)
 * @query   startMonth - Start month filter (YYYY-MM, optional)
 * @query   endMonth - End month filter (YYYY-MM, optional)
 */
router.get('/:debtorId/ledger/monthly', DebtorLedgerController.getDebtorMonthlyBreakdown);

/**
 * @route   GET /api/finance/debtors/:debtorId/enhanced
 * @desc    Get enhanced debtor details with transaction-based ledger
 * @access  Private (Admin/Finance)
 * @params  debtorId - Debtor ID
 */
router.get('/:debtorId/enhanced', DebtorLedgerController.getEnhancedDebtorDetails);

/**
 * @route   POST /api/finance/debtors/ledger/bulk
 * @desc    Get ledger data for multiple debtors
 * @access  Private (Admin/Finance)
 * @body    { debtorIds: string[] } - Array of debtor IDs
 */
router.post('/ledger/bulk', DebtorLedgerController.getMultipleDebtorLedgers);

/**
 * @route   GET /api/finance/debtors/ledger/summary
 * @desc    Get summary ledger data for all debtors
 * @access  Private (Admin/Finance)
 * @query   residenceId - Optional residence filter
 */
router.get('/ledger/summary', DebtorLedgerController.getAllDebtorLedgersSummary);

module.exports = router;




