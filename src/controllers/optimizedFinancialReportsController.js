const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const BalanceSheetService = require('../services/balanceSheetService');

/**
 * OPTIMIZED Financial Reports Controller
 * 
 * This controller provides performance-optimized versions of financial reports
 * to prevent timeout issues with large datasets.
 */

class OptimizedFinancialReportsController {
    
    /**
     * OPTIMIZED: Generate Monthly Balance Sheet
     * GET /api/financial-reports/monthly-balance-sheet-optimized
     */
    static async generateMonthlyBalanceSheetOptimized(req, res) {
        try {
            const { period, basis = 'accrual', residence } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2025)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            console.log(`🚀 Starting OPTIMIZED monthly balance sheet generation for ${period}...`);
            const startTime = Date.now();
            
            const year = parseInt(period);
            
            // OPTIMIZATION: Use the proper BalanceSheetService for correct account hierarchy handling
            console.log('📊 Using BalanceSheetService for proper account hierarchy handling...');
            
            // Generate monthly balance sheet using the proper service
            const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(year, residence, 'cumulative');
            
            // Extract monthly data and calculate totals
            const monthlyData = monthlyBalanceSheet.monthlyData;
            let totalAnnualAssets = 0;
            let totalAnnualLiabilities = 0;
            let totalAnnualEquity = 0;
            
            Object.values(monthlyData).forEach(monthData => {
                totalAnnualAssets += monthData.assets.total || 0;
                totalAnnualLiabilities += monthData.liabilities.total || 0;
                totalAnnualEquity += monthData.equity.total || 0;
            });
            
            const endTime = Date.now();
            const processingTime = (endTime - startTime) / 1000;
            
            console.log(`✅ OPTIMIZED monthly balance sheet completed in ${processingTime}s`);
            
            res.json({
                success: true,
                data: {
                    period: year,
                    basis: basis,
                    residence: residence || 'all',
                    monthlyData: monthlyData,
                    summary: {
                        totalAnnualAssets: totalAnnualAssets,
                        totalAnnualLiabilities: totalAnnualLiabilities,
                        totalAnnualEquity: totalAnnualEquity,
                        processingTimeSeconds: processingTime,
                        totalTransactions: monthlyBalanceSheet.summary?.totalTransactions || 0
                    }
                },
                message: `OPTIMIZED monthly balance sheet generated for ${period} (${basis} basis) - Processed in ${processingTime}s`
            });
            
        } catch (error) {
            console.error('Error generating optimized monthly balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating optimized monthly balance sheet',
                error: error.message
            });
        }
    }
}

module.exports = OptimizedFinancialReportsController;