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
            const balanceSheetResult = await BalanceSheetService.generateMonthlyBalanceSheet(year, residence, 'cumulative');
            
            // Check if the service returned valid data
            if (!balanceSheetResult || !balanceSheetResult.data || !balanceSheetResult.data.monthly) {
                throw new Error('BalanceSheetService returned invalid data structure');
            }
            
            // Extract monthly data and calculate totals
            const monthlyData = balanceSheetResult.data.monthly;
            let totalAnnualAssets = 0;
            let totalAnnualLiabilities = 0;
            let totalAnnualEquity = 0;
            
            // Safely iterate through monthly data
            if (monthlyData && typeof monthlyData === 'object') {
                Object.entries(monthlyData).forEach(([monthKey, monthData]) => {
                    try {
                        if (monthData && typeof monthData === 'object') {
                            // Safely access nested properties with fallbacks
                            const assetsTotal = monthData.assets?.total || 0;
                            const liabilitiesTotal = monthData.liabilities?.total || 0;
                            const equityTotal = monthData.equity?.total || 0;
                            
                            totalAnnualAssets += assetsTotal;
                            totalAnnualLiabilities += liabilitiesTotal;
                            totalAnnualEquity += equityTotal;
                            
                            console.log(`Month ${monthKey}: Assets=${assetsTotal}, Liabilities=${liabilitiesTotal}, Equity=${equityTotal}`);
                        } else {
                            console.warn(`Month ${monthKey} has invalid data structure:`, monthData);
                        }
                    } catch (monthError) {
                        console.error(`Error processing month ${monthKey}:`, monthError);
                        // Continue processing other months
                    }
                });
            } else {
                console.warn('Monthly data is not a valid object:', monthlyData);
            }
            
            const endTime = Date.now();
            const processingTime = (endTime - startTime) / 1000;
            
            console.log(`✅ OPTIMIZED monthly balance sheet completed in ${processingTime}s`);
            
            // Ensure we have valid monthly data to return
            const finalMonthlyData = monthlyData && typeof monthlyData === 'object' ? monthlyData : {};
            
            res.json({
                success: true,
                data: {
                    period: year,
                    basis: basis,
                    residence: residence || 'all',
                    monthlyData: finalMonthlyData,
                    summary: {
                        totalAnnualAssets: totalAnnualAssets,
                        totalAnnualLiabilities: totalAnnualLiabilities,
                        totalAnnualEquity: totalAnnualEquity,
                        processingTimeSeconds: processingTime,
                        totalTransactions: balanceSheetResult.data?.annualSummary?.totalTransactions || 0,
                        monthsProcessed: Object.keys(finalMonthlyData).length
                    }
                },
                message: `OPTIMIZED monthly balance sheet generated for ${period} (${basis} basis) - Processed in ${processingTime}s`
            });
            
        } catch (error) {
            console.error('Error generating optimized monthly balance sheet:', error);
            console.error('Error stack:', error.stack);
            
            // Provide more specific error messages
            let errorMessage = 'Error generating optimized monthly balance sheet';
            if (error.message.includes('Cannot convert undefined or null to object')) {
                errorMessage = 'Data structure error - missing required properties';
            } else if (error.message.includes('BalanceSheetService returned invalid data structure')) {
                errorMessage = 'Balance sheet service returned invalid data';
            }
            
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: error.message,
                details: {
                    period: req.query.period,
                    basis: req.query.basis,
                    residence: req.query.residence
                }
            });
        }
    }
}

module.exports = OptimizedFinancialReportsController;