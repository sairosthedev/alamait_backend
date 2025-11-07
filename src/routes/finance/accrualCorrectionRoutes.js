const express = require('express');
const router = express.Router();
const AccrualCorrectionController = require('../../controllers/finance/accrualCorrectionController');
const { auth, checkRole } = require('../../middleware/auth');

/**
 * Accrual Correction Routes
 * 
 * Provides endpoints for correcting accruals when students leave early:
 * - Find students with incorrect accruals (accruals after lease end date)
 * - Correct accruals for a specific student who left early
 * - Automatically reverse incorrect accruals and update lease end date
 */

// Apply authentication and role requirements to all routes
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

/**
 * Find all students with potential incorrect accruals
 * GET /api/finance/accrual-correction/find-issues
 * 
 * Query Parameters:
 * - year: Year to check (optional, defaults to current year)
 * - month: Month to check (optional, defaults to current month)
 * 
 * Example: GET /api/finance/accrual-correction/find-issues?year=2025&month=11
 */
router.get('/find-issues', AccrualCorrectionController.findIncorrectAccruals);

/**
 * Correct accruals for a student who left early
 * POST /api/finance/accrual-correction/correct
 * 
 * Request Body:
 * {
 *   "studentId": "application_id",
 *   "actualLeaseEndDate": "2025-10-31",
 *   "reason": "Student left early - lease ended in October",
 *   "updateLeaseEndDate": true  // Optional, defaults to true
 * }
 */
router.post('/correct', AccrualCorrectionController.correctAccrualsForStudent);

module.exports = router;

