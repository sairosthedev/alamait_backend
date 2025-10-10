const express = require('express');
const router = express.Router();
const EnhancedBalanceSheetController = require('../../controllers/finance/enhancedBalanceSheetController');
const { auth, checkAdminOrFinance } = require('../../middleware/auth');

// Apply authentication to all routes
router.use(auth);

/**
 * Enhanced Balance Sheet Routes
 * These routes provide detailed visibility into student negotiations and their impact on the balance sheet
 */

/**
 * GET /api/finance/enhanced-balance-sheet
 * Get enhanced balance sheet with negotiation details
 * Query parameters:
 * - asOfDate: Date in YYYY-MM-DD format (required)
 * - residence: Residence ID (optional)
 */
router.get('/enhanced-balance-sheet', 
    checkAdminOrFinance,
    EnhancedBalanceSheetController.getEnhancedBalanceSheet
);

/**
 * GET /api/finance/student-negotiation-report
 * Get comprehensive report of all student negotiations
 * Query parameters:
 * - asOfDate: Date in YYYY-MM-DD format (required)
 * - residence: Residence ID (optional)
 */
router.get('/student-negotiation-report',
    checkAdminOrFinance,
    EnhancedBalanceSheetController.getStudentNegotiationReport
);

/**
 * GET /api/finance/student-negotiation-history/:studentId
 * Get negotiation history for a specific student
 * Path parameters:
 * - studentId: Student ID (required)
 * Query parameters:
 * - asOfDate: Date in YYYY-MM-DD format (optional, defaults to current date)
 * - residence: Residence ID (optional)
 */
router.get('/student-negotiation-history/:studentId',
    checkAdminOrFinance,
    EnhancedBalanceSheetController.getStudentNegotiationHistory
);

/**
 * GET /api/finance/negotiation-impact-summary
 * Get summary of negotiation impact on financial statements
 * Query parameters:
 * - asOfDate: Date in YYYY-MM-DD format (required)
 * - residence: Residence ID (optional)
 * - period: 'monthly' or 'yearly' (optional, defaults to 'monthly')
 */
router.get('/negotiation-impact-summary',
    checkAdminOrFinance,
    EnhancedBalanceSheetController.getNegotiationImpactSummary
);

module.exports = router;
