const express = require('express');
const router = express.Router();
const RentalAccrualController = require('../controllers/rentalAccrualController');
const { auth, financeAccess } = require('../middleware/auth');

/**
 * Rental Accrual Routes
 * 
 * Provides endpoints for managing rental accruals:
 * - Create monthly rent accruals
 * - View outstanding rent balances
 * - Get accrual summaries
 * - Manage student rent invoices
 * 
 * All routes require authentication and finance role
 */

// Apply authentication middleware to all routes
router.use(auth);
router.use(financeAccess);

/**
 * Create monthly rent accruals for all active students
 * POST /api/rental-accrual/create-monthly
 * Body: { month: 8, year: 2025 }
 */
router.post('/create-monthly', RentalAccrualController.createMonthlyAccruals);

/**
 * Create rent accrual for a specific student
 * POST /api/rental-accrual/create-student
 * Body: { studentId: "student_id", month: 8, year: 2025 }
 */
router.post('/create-student', RentalAccrualController.createStudentAccrual);

/**
 * Get outstanding rent balances for all students
 * GET /api/rental-accrual/outstanding-balances
 * Returns: Summary + detailed list of students with outstanding balances
 */
router.get('/outstanding-balances', RentalAccrualController.getOutstandingBalances);

/**
 * Get rent accrual summary for a specific month
 * GET /api/rental-accrual/summary?month=8&year=2025
 * Returns: Monthly accrual summary with totals
 */
router.get('/summary', RentalAccrualController.getAccrualSummary);

/**
 * Get rent accrual summary for entire year
 * GET /api/rental-accrual/yearly-summary?year=2025
 * Returns: Yearly summary with monthly breakdown
 */
router.get('/yearly-summary', RentalAccrualController.getYearlySummary);

/**
 * Get student rent history
 * GET /api/rental-accrual/student-history/:studentId
 * Returns: Complete rent history for a specific student
 */
router.get('/student-history/:studentId', RentalAccrualController.getStudentHistory);

/**
 * Reverse a rent accrual (for corrections)
 * POST /api/rental-accrual/reverse/:transactionId
 * Body: { reason: "Correction reason" }
 */
router.post('/reverse/:transactionId', RentalAccrualController.reverseAccrual);

module.exports = router;
