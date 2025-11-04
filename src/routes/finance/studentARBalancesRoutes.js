const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const StudentARBalancesController = require('../../controllers/finance/studentARBalancesController');

/**
 * Student AR Balances Routes
 * Provides endpoints for viewing student outstanding balances and payment allocation
 */

// Get detailed outstanding balances for a student
router.get('/:studentId/ar-balances', 
  auth, 
  checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), 
  StudentARBalancesController.getDetailedOutstandingBalances
);

// Get outstanding balance summary for a student
router.get('/:studentId/ar-summary', 
  auth, 
  checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), 
  StudentARBalancesController.getOutstandingBalanceSummary
);

// Test payment allocation (for development/testing)
router.post('/:studentId/test-allocation', 
  auth, 
  checkRole('admin'), 
  StudentARBalancesController.testPaymentAllocation
);

// Get student invoices (accruals)
router.get('/:studentId/invoices', 
  auth, 
  checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
  StudentARBalancesController.getStudentInvoices
);

module.exports = router;
