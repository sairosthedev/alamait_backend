const DebtorLedgerService = require('../../services/debtorLedgerService');

/**
 * Debtor Ledger Controller
 * 
 * Provides API endpoints for transaction-based debtor ledger data
 */
class DebtorLedgerController {
    
    /**
     * Get ledger data for a specific debtor
     * GET /api/finance/debtors/:debtorId/ledger
     */
    static getDebtorLedger = async (req, res) => {
        try {
            const { debtorId } = req.params;
            let { studentId } = req.query;
            const includeAccrualIssues =
                String(req.query.includeAccrualIssues || '').toLowerCase() === 'true';

            const Debtor = require('../../models/Debtor');
            const Application = require('../../models/Application');
            const debtor = await Debtor.findById(debtorId).lean();
            if (!debtor) {
                return res.status(404).json({ success: false, message: 'Debtor not found' });
            }

            if (!studentId && debtor.user) {
                studentId = debtor.user.toString();
            }
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required (or link a user on the debtor record)'
                });
            }

            let application = null;
            if (includeAccrualIssues && debtor.application) {
                application = await Application.findById(debtor.application).lean();
            }
            
            console.log(`📊 API: Getting ledger for debtor ${debtorId}, student ${studentId}`);
            
            const ledgerData = await DebtorLedgerService.getDebtorLedger(debtorId, studentId, {
                includeAccrualIssues,
                application,
                monthsBack: req.query.monthsBack ? parseInt(req.query.monthsBack, 10) : 12
            });
            
            res.json({
                success: true,
                data: ledgerData,
                message: 'Debtor ledger retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error in getDebtorLedger:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving debtor ledger',
                error: error.message
            });
        }
    };
    
    /**
     * Get monthly breakdown for a specific debtor
     * GET /api/finance/debtors/:debtorId/ledger/monthly
     */
    static getDebtorMonthlyBreakdown = async (req, res) => {
        try {
            const { debtorId } = req.params;
            const { studentId, startMonth, endMonth } = req.query;
            
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }
            
            console.log(`📊 API: Getting monthly breakdown for debtor ${debtorId}, student ${studentId}`);
            
            const breakdownData = await DebtorLedgerService.getDebtorMonthlyBreakdown(
                debtorId, 
                studentId, 
                startMonth, 
                endMonth
            );
            
            res.json({
                success: true,
                data: breakdownData,
                message: 'Monthly breakdown retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error in getDebtorMonthlyBreakdown:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving monthly breakdown',
                error: error.message
            });
        }
    };
    
    /**
     * Get ledger data for multiple debtors
     * POST /api/finance/debtors/ledger/bulk
     */
    static getMultipleDebtorLedgers = async (req, res) => {
        try {
            const { debtorIds } = req.body;
            
            if (!debtorIds || !Array.isArray(debtorIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Debtor IDs array is required'
                });
            }
            
            console.log(`📊 API: Getting ledgers for ${debtorIds.length} debtors`);
            
            const ledgerData = await DebtorLedgerService.getMultipleDebtorLedgers(debtorIds);
            
            res.json({
                success: true,
                data: ledgerData,
                message: 'Multiple debtor ledgers retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error in getMultipleDebtorLedgers:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving multiple debtor ledgers',
                error: error.message
            });
        }
    };
    
    /**
     * Get summary ledger data for all debtors
     * GET /api/finance/debtors/ledger/summary
     */
    static getAllDebtorLedgersSummary = async (req, res) => {
        try {
            const { residenceId } = req.query;
            
            console.log(`📊 API: Getting ledger summary for all debtors${residenceId ? ` in residence ${residenceId}` : ''}`);
            
            const summaryData = await DebtorLedgerService.getAllDebtorLedgersSummary(residenceId);
            
            res.json({
                success: true,
                data: summaryData,
                message: 'Debtor ledger summary retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error in getAllDebtorLedgersSummary:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving debtor ledger summary',
                error: error.message
            });
        }
    };
    
    /**
     * Get enhanced debtor details with transaction-based ledger
     * GET /api/finance/debtors/:debtorId/enhanced
     */
    static getEnhancedDebtorDetails = async (req, res) => {
        try {
            const { debtorId } = req.params;
            
            console.log(`📊 API: Getting enhanced debtor details for ${debtorId}`);
            
            // Get basic debtor information
            const Debtor = require('../../models/Debtor');
            const debtor = await Debtor.findById(debtorId)
                .populate('user')
                .populate('residence')
                .populate('application');
            
            if (!debtor) {
                return res.status(404).json({
                    success: false,
                    message: 'Debtor not found'
                });
            }
            
            if (!debtor.user) {
                return res.status(400).json({
                    success: false,
                    message: 'Debtor has no associated user'
                });
            }
            
            // Get transaction-based ledger data
            const ledgerData = await DebtorLedgerService.getDebtorLedger(debtorId, debtor.user._id);
            
            // Combine debtor info with ledger data
            const enhancedData = {
                debtor: {
                    _id: debtor._id,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode,
                    status: debtor.status,
                    currentBalance: debtor.currentBalance,
                    totalOwed: debtor.totalOwed,
                    totalPaid: debtor.totalPaid,
                    overdueAmount: debtor.overdueAmount,
                    daysOverdue: debtor.daysOverdue,
                    lastPaymentDate: debtor.lastPaymentDate,
                    roomNumber: debtor.roomNumber,
                    roomPrice: debtor.roomPrice,
                    residence: debtor.residence,
                    application: debtor.application,
                    createdAt: debtor.createdAt,
                    updatedAt: debtor.updatedAt
                },
                student: {
                    _id: debtor.user._id,
                    firstName: debtor.user.firstName,
                    lastName: debtor.user.lastName,
                    email: debtor.user.email,
                    phone: debtor.user.phone
                },
                ledger: ledgerData,
                // Transaction-based totals (more accurate)
                transactionBasedTotals: {
                    totalExpected: ledgerData.totalExpected,
                    totalPaid: ledgerData.totalPaid,
                    totalOwing: ledgerData.totalOwing
                },
                // Original debtor totals (for comparison)
                originalTotals: {
                    totalOwed: debtor.totalOwed,
                    totalPaid: debtor.totalPaid,
                    currentBalance: debtor.currentBalance
                }
            };
            
            res.json({
                success: true,
                data: enhancedData,
                message: 'Enhanced debtor details retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error in getEnhancedDebtorDetails:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving enhanced debtor details',
                error: error.message
            });
        }
    };
}

module.exports = DebtorLedgerController;
