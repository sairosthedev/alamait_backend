const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const {
    getStudentARBalances,
    getPaymentAllocationSummary,
    manuallyAllocatePayment,
    autoAllocatePayment,
    getPaymentAllocationHistory,
    getPaymentCoverageAnalysis,
    getStudentsWithOutstandingBalances,
    getOutstandingBalancesSummary,
    getARInvoices
} = require('../../controllers/admin/paymentAllocationController');

// Validation middleware
const manualAllocationValidation = [
    check('paymentId', 'Payment ID is required').notEmpty(),
    check('allocations', 'Allocations array is required').isArray(),
    check('allocations.*.monthKey', 'Month key is required for each allocation').notEmpty(),
    check('allocations.*.amount', 'Amount must be a positive number for each allocation').isFloat({ min: 0.01 }),
    check('allocations.*.transactionId', 'Transaction ID is required for each allocation').notEmpty()
];

// Basic authentication for all routes
router.use(auth);

// Admin and Finance roles can access payment allocation features
const allowedRoles = ['admin', 'finance_admin', 'finance_user'];

/**
 * STUDENT-SPECIFIC ROUTES
 */

// Get student's AR balances for payment allocation
router.get('/student/:studentId/ar-balances', 
    checkRole(...allowedRoles), 
    getStudentARBalances
);

// Get payment allocation summary for a student
router.get('/student/:studentId/summary', 
    checkRole(...allowedRoles), 
    getPaymentAllocationSummary
);

// Get payment allocation history for a student
router.get('/student/:studentId/history', 
    checkRole(...allowedRoles), 
    getPaymentAllocationHistory
);

// Get payment coverage analysis for a student
router.get('/student/:studentId/coverage', 
    checkRole(...allowedRoles), 
    getPaymentCoverageAnalysis
);

/**
 * PAYMENT ALLOCATION ROUTES
 */

// Auto-allocate a payment using FIFO principle
router.post('/payment/:paymentId/auto-allocate', 
    checkRole(...allowedRoles), 
    autoAllocatePayment
);

// Manually allocate a payment to specific months
router.post('/payment/manual-allocate', 
    checkRole(...allowedRoles), 
    manualAllocationValidation, 
    manuallyAllocatePayment
);

/**
 * ADMIN DASHBOARD ROUTES
 */

// Get all students with outstanding balances (for admin dashboard)
router.get('/students/outstanding-balances', 
    checkRole(...allowedRoles), 
    getStudentsWithOutstandingBalances
);

// Get general outstanding balances summary (for admin dashboard)
router.get('/outstanding-balances', 
    checkRole(...allowedRoles), 
    getOutstandingBalancesSummary
);

// Get AR invoices (accruals) for all students
router.get('/ar-invoices', 
    checkRole(...allowedRoles), 
    getARInvoices
);

/**
 * BULK OPERATIONS (Future enhancement)
 */

// Bulk auto-allocate multiple payments
router.post('/bulk/auto-allocate', 
    checkRole('admin', 'finance_admin'), 
    [
        check('paymentIds', 'Payment IDs array is required').isArray(),
        check('paymentIds.*', 'Each payment ID must be a valid string').isString()
    ],
    async (req, res) => {
        try {
            const { paymentIds } = req.body;
            const results = [];

            for (const paymentId of paymentIds) {
                try {
                    // Reuse the auto-allocate logic
                    const payment = await require('../../models/Payment').findById(paymentId);
                    if (!payment) {
                        results.push({
                            paymentId,
                            success: false,
                            error: 'Payment not found'
                        });
                        continue;
                    }

                    const paymentData = {
                        paymentId: payment._id.toString(),
                        totalAmount: payment.totalAmount,
                        studentId: payment.student.toString(),
                        residenceId: payment.residence.toString(),
                        paymentMonth: payment.paymentMonth,
                        date: payment.date,
                        method: payment.method,
                        rentAmount: payment.rentAmount || 0,
                        adminFee: payment.adminFee || 0,
                        deposit: payment.deposit || 0
                    };

                    const PaymentAllocationService = require('../../services/paymentAllocationService');
                    const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);

                    results.push({
                        paymentId,
                        success: allocationResult.success,
                        data: allocationResult.success ? allocationResult : null,
                        error: allocationResult.success ? null : allocationResult.error
                    });

                } catch (error) {
                    results.push({
                        paymentId,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            res.status(200).json({
                success: true,
                message: `Bulk allocation completed: ${successful} successful, ${failed} failed`,
                data: {
                    total: paymentIds.length,
                    successful,
                    failed,
                    results
                }
            });

        } catch (error) {
            console.error('❌ Error in bulk auto-allocation:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to perform bulk auto-allocation',
                error: error.message
            });
        }
    }
);

/**
 * ANALYTICS ROUTES
 */

// Get payment allocation analytics
router.get('/analytics', 
    checkRole(...allowedRoles), 
    async (req, res) => {
        try {
            const { startDate, endDate, residence } = req.query;

            // Build date filter
            const dateFilter = {};
            if (startDate && endDate) {
                dateFilter.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            // Build residence filter
            const residenceFilter = {};
            if (residence) {
                residenceFilter.residence = require('mongoose').Types.ObjectId(residence);
            }

            const TransactionEntry = require('../../models/TransactionEntry');

            // Get allocation statistics
            const allocationStats = await TransactionEntry.aggregate([
                {
                    $match: {
                        ...dateFilter,
                        ...residenceFilter,
                        source: { $in: ['payment', 'manual'] },
                        'entries.accountCode': { $regex: '^1100-' }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$date' },
                            month: { $month: '$date' }
                        },
                        totalAllocated: { $sum: '$totalDebit' },
                        paymentCount: { $sum: 1 },
                        students: { $addToSet: '$metadata.paymentAllocation.studentId' }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1 }
                }
            ]);

            // Get outstanding balances by residence
            const outstandingByResidence = await TransactionEntry.aggregate([
                {
                    $match: {
                        ...residenceFilter,
                        'entries.accountCode': { $regex: '^1100-' },
                        'entries.accountType': 'asset',
                        'entries.debit': { $gt: 0 }
                    }
                },
                {
                    $lookup: {
                        from: 'residences',
                        localField: 'residence',
                        foreignField: '_id',
                        as: 'residenceDetails'
                    }
                },
                {
                    $group: {
                        _id: '$residence',
                        residenceName: { $first: { $arrayElemAt: ['$residenceDetails.name', 0] } },
                        totalOutstanding: { $sum: '$totalDebit' },
                        studentCount: { $addToSet: '$metadata.studentId' }
                    }
                },
                {
                    $project: {
                        residenceName: 1,
                        totalOutstanding: 1,
                        studentCount: { $size: '$studentCount' }
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                message: 'Payment allocation analytics retrieved successfully',
                data: {
                    allocationStats,
                    outstandingByResidence,
                    summary: {
                        totalMonths: allocationStats.length,
                        totalAllocated: allocationStats.reduce((sum, stat) => sum + stat.totalAllocated, 0),
                        totalPayments: allocationStats.reduce((sum, stat) => sum + stat.paymentCount, 0),
                        totalOutstanding: outstandingByResidence.reduce((sum, res) => sum + res.totalOutstanding, 0)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting payment allocation analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve payment allocation analytics',
                error: error.message
            });
        }
    }
);

module.exports = router;

