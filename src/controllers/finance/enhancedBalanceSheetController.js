const EnhancedBalanceSheetService = require('../../services/enhancedBalanceSheetService');

class EnhancedBalanceSheetController {
    
    /**
     * Get Enhanced Balance Sheet with Negotiation Details
     * GET /api/finance/enhanced-balance-sheet
     */
    static async getEnhancedBalanceSheet(req, res) {
        try {
            const { asOfDate, residence } = req.query;
            
            if (!asOfDate) {
                return res.status(400).json({
                    success: false,
                    message: 'asOfDate parameter is required (YYYY-MM-DD format)'
                });
            }
            
            // Validate date format
            const date = new Date(asOfDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD format'
                });
            }
            
            console.log(`📊 Generating enhanced balance sheet for ${asOfDate}${residence ? ` - Residence: ${residence}` : ''}`);
            
            const balanceSheet = await EnhancedBalanceSheetService.generateEnhancedBalanceSheet(
                date, 
                residence || null
            );
            
            res.json({
                success: true,
                data: balanceSheet,
                message: 'Enhanced balance sheet generated successfully'
            });
            
        } catch (error) {
            console.error('❌ Error generating enhanced balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating enhanced balance sheet',
                error: error.message
            });
        }
    }
    
    /**
     * Get Student Negotiation Report
     * GET /api/finance/student-negotiation-report
     */
    static async getStudentNegotiationReport(req, res) {
        try {
            const { asOfDate, residence } = req.query;
            
            if (!asOfDate) {
                return res.status(400).json({
                    success: false,
                    message: 'asOfDate parameter is required (YYYY-MM-DD format)'
                });
            }
            
            // Validate date format
            const date = new Date(asOfDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD format'
                });
            }
            
            console.log(`📊 Generating student negotiation report for ${asOfDate}${residence ? ` - Residence: ${residence}` : ''}`);
            
            const report = await EnhancedBalanceSheetService.generateStudentNegotiationReport(
                date, 
                residence || null
            );
            
            res.json({
                success: true,
                data: report,
                message: 'Student negotiation report generated successfully'
            });
            
        } catch (error) {
            console.error('❌ Error generating student negotiation report:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating student negotiation report',
                error: error.message
            });
        }
    }
    
    /**
     * Get Student-Specific Negotiation History
     * GET /api/finance/student-negotiation-history/:studentId
     */
    static async getStudentNegotiationHistory(req, res) {
        try {
            const { studentId } = req.params;
            const { asOfDate, residence } = req.query;
            
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }
            
            const date = asOfDate ? new Date(asOfDate) : new Date();
            
            console.log(`📊 Generating negotiation history for student: ${studentId}`);
            
            const balanceSheet = await EnhancedBalanceSheetService.generateEnhancedBalanceSheet(
                date, 
                residence || null
            );
            
            const studentDetail = balanceSheet.assets.currentAssets.accountsReceivable.studentDetails[studentId];
            
            if (!studentDetail) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found or no transactions recorded'
                });
            }
            
            // Filter negotiation transactions
            const negotiationTransactions = studentDetail.transactions.filter(t => t.type === 'negotiation');
            
            const history = {
                studentId: studentDetail.studentId,
                studentName: studentDetail.studentName,
                accountCode: studentDetail.accountCode,
                summary: {
                    originalAccruals: studentDetail.originalAccruals,
                    negotiatedAdjustments: studentDetail.negotiatedAdjustments,
                    paymentsReceived: studentDetail.paymentsReceived,
                    netOutstanding: studentDetail.netOutstanding,
                    totalNegotiations: negotiationTransactions.length,
                    totalDiscounts: studentDetail.negotiatedAdjustments
                },
                negotiations: negotiationTransactions.map(t => ({
                    transactionId: t.transactionId,
                    date: t.date,
                    description: t.description,
                    discountAmount: t.credit,
                    type: t.type
                })),
                allTransactions: studentDetail.transactions.map(t => ({
                    transactionId: t.transactionId,
                    date: t.date,
                    source: t.source,
                    description: t.description,
                    debit: t.debit,
                    credit: t.credit,
                    type: t.type
                }))
            };
            
            res.json({
                success: true,
                data: history,
                message: 'Student negotiation history retrieved successfully'
            });
            
        } catch (error) {
            console.error('❌ Error retrieving student negotiation history:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving student negotiation history',
                error: error.message
            });
        }
    }
    
    /**
     * Get Negotiation Impact Summary
     * GET /api/finance/negotiation-impact-summary
     */
    static async getNegotiationImpactSummary(req, res) {
        try {
            const { asOfDate, residence, period = 'monthly' } = req.query;
            
            if (!asOfDate) {
                return res.status(400).json({
                    success: false,
                    message: 'asOfDate parameter is required (YYYY-MM-DD format)'
                });
            }
            
            const date = new Date(asOfDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD format'
                });
            }
            
            console.log(`📊 Generating negotiation impact summary for ${asOfDate}`);
            
            const balanceSheet = await EnhancedBalanceSheetService.generateEnhancedBalanceSheet(
                date, 
                residence || null
            );
            
            const summary = balanceSheet.metadata.negotiationSummary;
            
            // Calculate additional metrics
            const impactSummary = {
                period: asOfDate,
                residence: residence || 'All Residences',
                negotiationMetrics: {
                    totalNegotiations: summary.totalNegotiations,
                    totalDiscountsGiven: summary.totalDiscountsGiven,
                    averageDiscountPerNegotiation: summary.averageDiscountPerNegotiation,
                    studentsAffected: summary.studentsAffected.length,
                    totalIncomeImpact: summary.totalIncomeImpact
                },
                financialImpact: {
                    accountsReceivableReduction: summary.totalDiscountsGiven,
                    incomeReduction: summary.totalIncomeImpact,
                    netEffect: summary.totalDiscountsGiven - summary.totalIncomeImpact
                },
                topNegotiatingStudents: Object.values(balanceSheet.assets.currentAssets.accountsReceivable.studentDetails)
                    .filter(student => student.negotiatedAdjustments > 0)
                    .sort((a, b) => b.negotiatedAdjustments - a.negotiatedAdjustments)
                    .slice(0, 10)
                    .map(student => ({
                        studentId: student.studentId,
                        studentName: student.studentName,
                        totalDiscounts: student.negotiatedAdjustments,
                        negotiationCount: student.transactions.filter(t => t.type === 'negotiation').length
                    })),
                incomeAccountImpact: summary.incomeAdjustments || {}
            };
            
            res.json({
                success: true,
                data: impactSummary,
                message: 'Negotiation impact summary generated successfully'
            });
            
        } catch (error) {
            console.error('❌ Error generating negotiation impact summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating negotiation impact summary',
                error: error.message
            });
        }
    }
}

module.exports = EnhancedBalanceSheetController;
