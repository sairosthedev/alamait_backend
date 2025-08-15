const RentalAccrualService = require('../../services/rentalAccrualService');
const Lease = require('../../models/Lease');
const TransactionEntry = require('../../models/TransactionEntry');

/**
 * Rental Accrual Controller
 * 
 * Handles HTTP requests for rental income accrual operations:
 * - Accrue rental income for new leases
 * - Reverse rental accruals when needed
 * - Get accrual summaries for reporting
 * - Bulk operations for multiple leases
 */

class RentalAccrualController {
    
    /**
     * ACCRUE RENTAL INCOME FOR A LEASE
     * POST /api/finance/rental-accrual/accrue/:leaseId
     */
    static async accrueRentalIncome(req, res) {
        try {
            const { leaseId } = req.params;
            
            if (!leaseId) {
                return res.status(400).json({
                    success: false,
                    message: 'Lease ID is required'
                });
            }
            
            console.log(`🏠 Processing rental accrual request for lease: ${leaseId}`);
            
            // Verify lease exists and is active
            const lease = await Lease.findById(leaseId);
            if (!lease) {
                return res.status(404).json({
                    success: false,
                    message: 'Lease not found'
                });
            }
            
            if (lease.status !== 'active' && lease.status !== 'signed') {
                return res.status(400).json({
                    success: false,
                    message: 'Can only accrue rental income for active or signed leases'
                });
            }
            
            // Check if accrual already exists for this lease
            const existingAccruals = await TransactionEntry.find({
                source: 'rental_accrual',
                sourceId: leaseId
            });
            
            if (existingAccruals.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Rental accrual already exists for this lease',
                    existingAccruals: existingAccruals.length
                });
            }
            
            // Process the accrual
            const result = await RentalAccrualService.accrueRentalIncomeForLease(leaseId, req.user);
            
            console.log(`✅ Rental accrual completed successfully`);
            
            res.status(200).json({
                success: true,
                message: 'Rental income accrued successfully',
                data: result
            });
            
        } catch (error) {
            console.error('❌ Error in rental accrual controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to accrue rental income',
                error: error.message
            });
        }
    }
    
    /**
     * REVERSE RENTAL ACCRUAL
     * POST /api/finance/rental-accrual/reverse/:transactionEntryId
     */
    static async reverseAccrual(req, res) {
        try {
            const { transactionEntryId } = req.params;
            
            if (!transactionEntryId) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction entry ID is required'
                });
            }
            
            console.log(`🔄 Processing accrual reversal request: ${transactionEntryId}`);
            
            // Verify transaction entry exists and is a rental accrual
            const transactionEntry = await TransactionEntry.findById(transactionEntryId);
            if (!transactionEntry) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction entry not found'
                });
            }
            
            if (transactionEntry.source !== 'rental_accrual') {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction entry is not a rental accrual'
                });
            }
            
            // Process the reversal
            const result = await RentalAccrualService.reverseAccrual(transactionEntryId, req.user);
            
            console.log(`✅ Accrual reversal completed successfully`);
            
            res.status(200).json({
                success: true,
                message: 'Rental accrual reversed successfully',
                data: result
            });
            
        } catch (error) {
            console.error('❌ Error in accrual reversal controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reverse rental accrual',
                error: error.message
            });
        }
    }
    
    /**
     * GET ACCRUAL SUMMARY
     * GET /api/finance/rental-accrual/summary/:period
     */
    static async getAccrualSummary(req, res) {
        try {
            const { period } = req.params;
            const { residenceId } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period is required (e.g., 2025)'
                });
            }
            
            // Validate period format (YYYY)
            if (!/^\d{4}$/.test(period)) {
                return res.status(400).json({
                    success: false,
                    message: 'Period must be in YYYY format (e.g., 2025)'
                });
            }
            
            console.log(`📊 Generating accrual summary for period: ${period}`);
            
            // Get the summary
            const summary = await RentalAccrualService.getAccrualSummary(period, residenceId);
            
            console.log(`✅ Accrual summary generated successfully`);
            
            res.status(200).json({
                success: true,
                message: 'Accrual summary retrieved successfully',
                data: summary
            });
            
        } catch (error) {
            console.error('❌ Error in accrual summary controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get accrual summary',
                error: error.message
            });
        }
    }
    
    /**
     * BULK ACCRUE RENTAL INCOME
     * POST /api/finance/rental-accrual/bulk-accrue
     */
    static async bulkAccrueRentalIncome(req, res) {
        try {
            const { leaseIds, residenceId, startDate, endDate } = req.body;
            
            console.log(`🏠 Processing bulk rental accrual request`);
            
            let leasesToProcess = [];
            
            if (leaseIds && Array.isArray(leaseIds) && leaseIds.length > 0) {
                // Process specific leases
                console.log(`📋 Processing ${leaseIds.length} specific leases`);
                leasesToProcess = await Lease.find({
                    _id: { $in: leaseIds },
                    status: { $in: ['active', 'signed'] }
                }).populate('student', 'firstName lastName email')
                  .populate('residence', 'name')
                  .populate('room', 'name price');
            } else if (residenceId && startDate && endDate) {
                // Process leases in date range for specific residence
                console.log(`📅 Processing leases for residence ${residenceId} from ${startDate} to ${endDate}`);
                leasesToProcess = await Lease.find({
                    residence: residenceId,
                    startDate: { $gte: new Date(startDate) },
                    endDate: { $lte: new Date(endDate) },
                    status: { $in: ['active', 'signed'] }
                }).populate('student', 'firstName lastName email')
                  .populate('residence', 'name')
                  .populate('room', 'name price');
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Either leaseIds array or residenceId with startDate/endDate is required'
                });
            }
            
            if (leasesToProcess.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No eligible leases found for processing'
                });
            }
            
            console.log(`📊 Found ${leasesToProcess.length} eligible leases for processing`);
            
            // Process each lease
            const results = [];
            const errors = [];
            
            for (const lease of leasesToProcess) {
                try {
                    // Check if accrual already exists
                    const existingAccruals = await TransactionEntry.find({
                        source: 'rental_accrual',
                        sourceId: lease._id
                    });
                    
                    if (existingAccruals.length > 0) {
                        console.log(`⚠️  Lease ${lease._id} already has accruals, skipping`);
                        continue;
                    }
                    
                    // Process accrual
                    const result = await RentalAccrualService.accrueRentalIncomeForLease(lease._id, req.user);
                    results.push(result);
                    
                } catch (error) {
                    console.error(`❌ Error processing lease ${lease._id}:`, error);
                    errors.push({
                        leaseId: lease._id,
                        studentName: `${lease.student?.firstName || ''} ${lease.student?.lastName || ''}`.trim(),
                        error: error.message
                    });
                }
            }
            
            console.log(`✅ Bulk accrual completed: ${results.length} successful, ${errors.length} errors`);
            
            res.status(200).json({
                success: true,
                message: 'Bulk rental accrual completed',
                data: {
                    totalProcessed: leasesToProcess.length,
                    successful: results.length,
                    errors: errors.length,
                    results: results,
                    errorDetails: errors
                }
            });
            
        } catch (error) {
            console.error('❌ Error in bulk accrual controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process bulk rental accrual',
                error: error.message
            });
        }
    }
    
    /**
     * GET LEASES ELIGIBLE FOR ACCRUAL
     * GET /api/finance/rental-accrual/eligible-leases
     */
    static async getEligibleLeases(req, res) {
        try {
            const { residenceId, status, startDate, endDate } = req.query;
            
            console.log(`🔍 Finding leases eligible for rental accrual`);
            
            // Build filter
            const filter = {
                status: { $in: ['active', 'signed'] }
            };
            
            if (residenceId) {
                filter.residence = residenceId;
            }
            
            if (startDate) {
                filter.startDate = { $gte: new Date(startDate) };
            }
            
            if (endDate) {
                filter.endDate = { $lte: new Date(endDate) };
            }
            
            // Get eligible leases
            const eligibleLeases = await Lease.find(filter)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name')
                .populate('room', 'name price')
                .sort({ startDate: 1 });
            
            // Check which ones already have accruals
            const leasesWithAccruals = await TransactionEntry.distinct('sourceId', {
                source: 'rental_accrual',
                sourceModel: 'Lease'
            });
            
            const eligibleLeasesWithStatus = eligibleLeases.map(lease => {
                const hasAccrual = leasesWithAccruals.includes(lease._id.toString());
                return {
                    ...lease.toObject(),
                    hasAccrual,
                    status: hasAccrual ? 'accrued' : 'eligible'
                };
            });
            
            const eligibleCount = eligibleLeasesWithStatus.filter(l => !l.hasAccrual).length;
            const accruedCount = eligibleLeasesWithStatus.filter(l => l.hasAccrual).length;
            
            console.log(`✅ Found ${eligibleCount} eligible leases and ${accruedCount} already accrued`);
            
            res.status(200).json({
                success: true,
                message: 'Eligible leases retrieved successfully',
                data: {
                    total: eligibleLeasesWithStatus.length,
                    eligible: eligibleCount,
                    alreadyAccrued: accruedCount,
                    leases: eligibleLeasesWithStatus
                }
            });
            
        } catch (error) {
            console.error('❌ Error in eligible leases controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get eligible leases',
                error: error.message
            });
        }
    }
    
    /**
     * GET ACCRUAL DETAILS FOR A LEASE
     * GET /api/finance/rental-accrual/lease/:leaseId
     */
    static async getLeaseAccrualDetails(req, res) {
        try {
            const { leaseId } = req.params;
            
            if (!leaseId) {
                return res.status(400).json({
                    success: false,
                    message: 'Lease ID is required'
                });
            }
            
            console.log(`📋 Getting accrual details for lease: ${leaseId}`);
            
            // Get lease details
            const lease = await Lease.findById(leaseId)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name')
                .populate('room', 'name price');
            
            if (!lease) {
                return res.status(404).json({
                    success: false,
                    message: 'Lease not found'
                });
            }
            
            // Get accrual transactions
            const accrualTransactions = await TransactionEntry.find({
                source: 'rental_accrual',
                sourceId: leaseId
            }).sort({ date: 1 });
            
            // Get reversal transactions
            const reversalTransactions = await TransactionEntry.find({
                source: 'rental_accrual_reversal',
                'metadata.originalTransactionId': { $in: accrualTransactions.map(t => t._id) }
            });
            
            // Calculate totals
            const totalAccrued = accrualTransactions.reduce((sum, t) => sum + t.totalDebit, 0);
            const totalReversed = reversalTransactions.reduce((sum, t) => sum + t.totalDebit, 0);
            const netAccrued = totalAccrued - totalReversed;
            
            console.log(`✅ Lease accrual details retrieved successfully`);
            
            res.status(200).json({
                success: true,
                message: 'Lease accrual details retrieved successfully',
                data: {
                    lease: {
                        id: lease._id,
                        student: lease.student,
                        residence: lease.residence,
                        room: lease.room,
                        startDate: lease.startDate,
                        endDate: lease.endDate,
                        rent: lease.rent,
                        status: lease.status
                    },
                    accruals: {
                        totalAccrued,
                        totalReversed,
                        netAccrued,
                        transactionCount: accrualTransactions.length,
                        reversalCount: reversalTransactions.length
                    },
                    transactions: {
                        accruals: accrualTransactions,
                        reversals: reversalTransactions
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error in lease accrual details controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get lease accrual details',
                error: error.message
            });
        }
    }
}

module.exports = RentalAccrualController;
