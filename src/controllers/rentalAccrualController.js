const RentalAccrualService = require('../services/rentalAccrualService');
const { auth, financeAccess } = require('../middleware/auth');

/**
 * Rental Accrual Controller
 * 
 * Provides endpoints for managing rental accruals:
 * - Create monthly rent accruals
 * - View outstanding rent balances
 * - Get accrual summaries
 * - Manage student rent invoices
 */
class RentalAccrualController {
    
    /**
     * Create monthly rent accruals for all active students
     * POST /api/rental-accrual/create-monthly
     */
    static async createMonthlyAccruals(req, res) {
        try {
            const { month, year } = req.body;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required'
                });
            }
            
            // Validate month and year
            if (month < 1 || month > 12) {
                return res.status(400).json({
                    success: false,
                    message: 'Month must be between 1 and 12'
                });
            }
            
            if (year < 2020 || year > 2030) {
                return res.status(400).json({
                    success: false,
                    message: 'Year must be between 2020 and 2030'
                });
            }
            
            console.log(`🏠 Creating rent accruals for ${month}/${year}...`);
            
            const result = await RentalAccrualService.createMonthlyRentAccrual(month, year);
            
            res.json({
                success: true,
                message: `Rent accruals created for ${month}/${year}`,
                data: result
            });
            
        } catch (error) {
            console.error('❌ Error creating monthly accruals:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating monthly accruals',
                error: error.message
            });
        }
    }
    
    /**
     * Create rent accrual for a specific student
     * POST /api/rental-accrual/create-student
     */
    static async createStudentAccrual(req, res) {
        try {
            const { studentId, month, year } = req.body;
            
            if (!studentId || !month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID, month, and year are required'
                });
            }
            
            // Get student from applications collection
            const student = await req.app.locals.db
                .collection('applications')
                .findOne({ _id: new require('mongodb').ObjectId(studentId) });
            
            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }
            
            const result = await RentalAccrualService.createStudentRentAccrual(student, month, year);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: `Rent accrual created for ${student.firstName} ${student.lastName}`,
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.error,
                    data: result
                });
            }
            
        } catch (error) {
            console.error('❌ Error creating student accrual:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating student accrual',
                error: error.message
            });
        }
    }
    
    /**
     * Get outstanding rent balances for all students
     * GET /api/rental-accrual/outstanding-balances
     */
    static async getOutstandingBalances(req, res) {
        try {
            const balances = await RentalAccrualService.getOutstandingRentBalances();
            
            // Calculate summary statistics
            const totalOutstanding = balances.reduce((sum, student) => sum + student.totalOutstanding, 0);
            const totalStudents = balances.length;
            const overdueStudents = balances.filter(student => student.daysOverdue > 0).length;
            
            res.json({
                success: true,
                data: {
                    summary: {
                        totalOutstanding,
                        totalStudents,
                        overdueStudents,
                        averageOutstanding: totalStudents > 0 ? totalOutstanding / totalStudents : 0
                    },
                    students: balances
                }
            });
            
        } catch (error) {
            console.error('❌ Error getting outstanding balances:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting outstanding balances',
                error: error.message
            });
        }
    }
    
    /**
     * Get rent accrual summary for a specific month
     * GET /api/rental-accrual/summary?month=8&year=2025
     */
    static async getAccrualSummary(req, res) {
        try {
            const { month, year } = req.query;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year query parameters are required'
                });
            }
            
            const summary = await RentalAccrualService.getRentAccrualSummary(parseInt(month), parseInt(year));
            
            res.json({
                success: true,
                data: summary
            });
            
        } catch (error) {
            console.error('❌ Error getting accrual summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting accrual summary',
                error: error.message
            });
        }
    }
    
    /**
     * Get rent accrual summary for current year
     * GET /api/rental-accrual/yearly-summary?year=2025
     */
    static async getYearlySummary(req, res) {
        try {
            const { year = new Date().getFullYear() } = req.query;
            
            const monthlySummaries = [];
            let totalRentAccrued = 0;
            let totalAdminFeesAccrued = 0;
            let totalStudents = 0;
            
            // Get summary for each month
            for (let month = 1; month <= 12; month++) {
                try {
                    const summary = await RentalAccrualService.getRentAccrualSummary(month, parseInt(year));
                    monthlySummaries.push(summary);
                    
                    totalRentAccrued += summary.totalRentAccrued;
                    totalAdminFeesAccrued += summary.totalAdminFeesAccrued;
                    totalStudents = Math.max(totalStudents, summary.totalStudents);
                } catch (error) {
                    // Month might not have accruals yet
                    monthlySummaries.push({
                        month,
                        year: parseInt(year),
                        totalStudents: 0,
                        totalRentAccrued: 0,
                        totalAdminFeesAccrued: 0,
                        totalAmountAccrued: 0,
                        accruals: 0
                    });
                }
            }
            
            const yearlySummary = {
                year: parseInt(year),
                totalRentAccrued,
                totalAdminFeesAccrued,
                totalAmountAccrued: totalRentAccrued + totalAdminFeesAccrued,
                totalStudents,
                monthlyBreakdown: monthlySummaries
            };
            
            res.json({
                success: true,
                data: yearlySummary
            });
            
        } catch (error) {
            console.error('❌ Error getting yearly summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting yearly summary',
                error: error.message
            });
        }
    }
    
    /**
     * Get student rent history
     * GET /api/rental-accrual/student-history/:studentId
     */
    static async getStudentHistory(req, res) {
        try {
            const { studentId } = req.params;
            
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }
            
            // Get student accruals
            const accruals = await require('../models/TransactionEntry').find({
                'metadata.studentId': studentId,
                'metadata.type': 'rent_accrual',
                status: 'posted'
            }).sort({ date: -1 });
            
            // Get student invoices
            const invoices = await require('../models/Invoice').find({
                student: studentId,
                status: { $ne: 'cancelled' }
            }).sort({ billingPeriod: -1 });
            
            // Get student payments
            const payments = await require('../models/Payment').find({
                student: studentId,
                status: { $in: ['Confirmed', 'Verified'] }
            }).sort({ date: -1 });
            
            // Calculate outstanding balance
            const totalAccrued = accruals.reduce((sum, acc) => sum + (acc.metadata.totalAmount || 0), 0);
            const totalPaid = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
            const outstandingBalance = totalAccrued - totalPaid;
            
            const studentHistory = {
                studentId,
                totalAccrued,
                totalPaid,
                outstandingBalance,
                accruals: accruals.map(acc => ({
                    month: acc.metadata.accrualMonth,
                    year: acc.metadata.accrualYear,
                    amount: acc.metadata.totalAmount,
                    date: acc.date,
                    transactionId: acc.transactionId
                })),
                invoices: invoices.map(inv => ({
                    invoiceNumber: inv.invoiceNumber,
                    billingPeriod: inv.billingPeriod,
                    amount: inv.totalAmount,
                    balanceDue: inv.balanceDue,
                    dueDate: inv.dueDate,
                    status: inv.paymentStatus
                })),
                payments: payments.map(pay => ({
                    amount: pay.amount,
                    date: pay.date,
                    method: pay.method,
                    status: pay.status
                }))
            };
            
            res.json({
                success: true,
                data: studentHistory
            });
            
        } catch (error) {
            console.error('❌ Error getting student history:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting student history',
                error: error.message
            });
        }
    }
    
    /**
     * Reverse a rent accrual (for corrections)
     * POST /api/rental-accrual/reverse/:transactionId
     */
    static async reverseAccrual(req, res) {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;
            
            if (!transactionId) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
            }
            
            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: 'Reason for reversal is required'
                });
            }
            
            // Find the accrual transaction
            const accrual = await require('../models/TransactionEntry').findOne({
                transactionId,
                'metadata.type': 'rent_accrual',
                status: 'posted'
            });
            
            if (!accrual) {
                return res.status(404).json({
                    success: false,
                    message: 'Rent accrual not found'
                });
            }
            
            // Create reversal transaction
            const reversal = await RentalAccrualService.reverseAccrual(accrual._id, req.user);
            
            res.json({
                success: true,
                message: 'Rent accrual reversed successfully',
                data: reversal
            });
            
        } catch (error) {
            console.error('❌ Error reversing accrual:', error);
            res.status(500).json({
                success: false,
                message: 'Error reversing accrual',
                error: error.message
            });
        }
    }
}

module.exports = RentalAccrualController;
