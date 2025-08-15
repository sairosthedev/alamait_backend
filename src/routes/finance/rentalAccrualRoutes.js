const express = require('express');
const router = express.Router();
const RentalAccrualController = require('../../controllers/finance/rentalAccrualController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

/**
 * Rental Accrual Routes
 * 
 * Provides endpoints for proper accrual accounting of rental income:
 * - Accrue rental income when leases start (not when payments are received)
 * - Handle lease periods from start to end dates
 * - Support multiple billing cycles (monthly, quarterly, semester, annual)
 * - Reverse accruals when needed
 * - Get comprehensive accrual summaries
 */

// Apply authentication and role requirements to all routes
router.use(authenticateToken);
router.use(requireRole(['finance', 'admin', 'ceo']));

/**
 * 🏠 ACCRUE RENTAL INCOME FOR A LEASE
 * POST /api/finance/rental-accrual/accrue/:leaseId
 * 
 * Creates accrual entries for rental income from lease start to end date.
 * This implements proper accrual accounting where income is recognized when earned,
 * not when payment is received.
 * 
 * Example:
 * Lease: June 1 - December 31, $200/month
 * Result: 7 monthly accrual entries, each dated at the start of the month
 */
router.post('/accrue/:leaseId', RentalAccrualController.accrueRentalIncome);

/**
 * 🔄 REVERSE RENTAL ACCRUAL
 * POST /api/finance/rental-accrual/reverse/:transactionEntryId
 * 
 * Reverses a rental accrual transaction (e.g., if lease is cancelled).
 * Creates a reversal entry that offsets the original accrual.
 */
router.post('/reverse/:transactionEntryId', RentalAccrualController.reverseAccrual);

/**
 * 📊 GET ACCRUAL SUMMARY
 * GET /api/finance/rental-accrual/summary/:period
 * 
 * Provides comprehensive summary of rental accruals for a specific period.
 * 
 * Query Parameters:
 * - residenceId: Filter by specific residence (optional)
 * 
 * Example: GET /api/finance/rental-accrual/summary/2025?residenceId=123
 */
router.get('/summary/:period', RentalAccrualController.getAccrualSummary);

/**
 * 🏠 BULK ACCRUE RENTAL INCOME
 * POST /api/finance/rental-accrual/bulk-accrue
 * 
 * Processes multiple leases at once for rental accrual.
 * 
 * Request Body Options:
 * Option 1: Specific lease IDs
 * {
 *   "leaseIds": ["lease1", "lease2", "lease3"]
 * }
 * 
 * Option 2: Residence and date range
 * {
 *   "residenceId": "residence123",
 *   "startDate": "2025-01-01",
 *   "endDate": "2025-12-31"
 * }
 */
router.post('/bulk-accrue', RentalAccrualController.bulkAccrueRentalIncome);

/**
 * 🔍 GET LEASES ELIGIBLE FOR ACCRUAL
 * GET /api/finance/rental-accrual/eligible-leases
 * 
 * Finds all leases that are eligible for rental accrual processing.
 * 
 * Query Parameters:
 * - residenceId: Filter by specific residence (optional)
 * - startDate: Filter leases starting from this date (optional)
 * - endDate: Filter leases ending by this date (optional)
 * 
 * Example: GET /api/finance/rental-accrual/eligible-leases?residenceId=123&startDate=2025-01-01
 */
router.get('/eligible-leases', RentalAccrualController.getEligibleLeases);

/**
 * 📋 GET ACCRUAL DETAILS FOR A LEASE
 * GET /api/finance/rental-accrual/lease/:leaseId
 * 
 * Provides detailed information about accruals for a specific lease,
 * including all transactions and reversals.
 */
router.get('/lease/:leaseId', RentalAccrualController.getLeaseAccrualDetails);

module.exports = router;
