const AccountingService = require('../services/accountingService');

class AccountingController {
    /**
     * Create monthly accruals for a specific month/year
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
            
            const result = await AccountingService.createMonthlyAccruals(parseInt(month), parseInt(year));
            
            res.json({
                success: true,
                message: `Monthly accruals created for ${month}/${year}`,
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
     * Generate monthly income statement
     */
    static async getMonthlyIncomeStatement(req, res) {
        try {
            const { month, year } = req.query;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required'
                });
            }
            
            const incomeStatement = await AccountingService.generateMonthlyIncomeStatement(
                parseInt(month), 
                parseInt(year)
            );
            
            res.json({
                success: true,
                data: incomeStatement
            });
            
        } catch (error) {
            console.error('❌ Error generating income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating income statement',
                error: error.message
            });
        }
    }
    
    /**
     * Generate monthly balance sheet
     */
    static async getMonthlyBalanceSheet(req, res) {
        try {
            const { month, year } = req.query;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required'
                });
            }
            
            const balanceSheet = await AccountingService.generateMonthlyBalanceSheet(
                parseInt(month), 
                parseInt(year)
            );
            
            res.json({
                success: true,
                data: balanceSheet
            });
            
        } catch (error) {
            console.error('❌ Error generating balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating balance sheet',
                error: error.message
            });
        }
    }

    /**
     * Get Monthly Breakdown Balance Sheet
     */
    static async getMonthlyBreakdownBalanceSheet(req, res) {
        try {
            const { year } = req.query;
            
            if (!year) {
                return res.status(400).json({
                    success: false,
                    message: 'Year is required'
                });
            }
            
            const breakdownBalanceSheet = await AccountingService.generateMonthlyBreakdownBalanceSheet(parseInt(year));
            
            res.json({
                success: true,
                data: breakdownBalanceSheet
            });
            
        } catch (error) {
            console.error('❌ Error getting monthly breakdown balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting monthly breakdown balance sheet',
                error: error.message
            });
        }
    }
    
    /**
     * Get monthly balance sheet with account codes for entire year
     * GET /api/accounting/balance-sheet-monthly
     */
    static async getMonthlyBalanceSheetWithCodes(req, res) {
        try {
            const { year } = req.query;
            if (!year) {
                return res.status(400).json({ success: false, message: 'Year is required' });
            }
            
            const monthlyBalanceSheets = {};
            
            // Generate balance sheet for each month with account codes
            for (let month = 1; month <= 12; month++) {
                const balanceSheet = await AccountingService.generateMonthlyBalanceSheet(month, parseInt(year));
                monthlyBalanceSheets[month] = balanceSheet;
            }
            
            res.json({ 
                success: true, 
                data: {
                    year: parseInt(year),
                    monthlyData: monthlyBalanceSheets,
                    summary: {
                        totalAssets: monthlyBalanceSheets[12]?.assets.total || 0,
                        totalLiabilities: monthlyBalanceSheets[12]?.liabilities.total || 0,
                        totalEquity: monthlyBalanceSheets[12]?.equity.total || 0
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error getting monthly balance sheet with codes:', error);
            res.status(500).json({ success: false, message: 'Error getting monthly balance sheet with codes', error: error.message });
        }
    }
    
    /**
     * Generate monthly cash flow statement
     */
    static async getMonthlyCashFlow(req, res) {
        try {
            const { month, year } = req.query;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required'
                });
            }
            
            const cashFlow = await AccountingService.generateMonthlyCashFlowStatement(
                parseInt(month), 
                parseInt(year)
            );
            
            res.json({
                success: true,
                data: cashFlow
            });
            
        } catch (error) {
            console.error('❌ Error generating cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating cash flow statement',
                error: error.message
            });
        }
    }
    
    /**
     * Get comprehensive monthly financial reports
     */
    static async getMonthlyFinancialReports(req, res) {
        try {
            const { month, year } = req.query;
            
            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required'
                });
            }
            
            const monthInt = parseInt(month);
            const yearInt = parseInt(year);
            
            // Generate all three reports
            const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
                AccountingService.generateMonthlyIncomeStatement(monthInt, yearInt),
                AccountingService.generateMonthlyBalanceSheet(monthInt, yearInt),
                AccountingService.generateMonthlyCashFlowStatement(monthInt, yearInt)
            ]);
            
            res.json({
                success: true,
                data: {
                    period: `${month}/${year}`,
                    incomeStatement,
                    balanceSheet,
                    cashFlow,
                    summary: {
                        netIncome: incomeStatement.netIncome,
                        totalAssets: balanceSheet.assets.total,
                        totalLiabilities: balanceSheet.liabilities.total,
                        totalEquity: balanceSheet.equity.total,
                        netOperatingCash: cashFlow.operatingActivities.netOperatingCash,
                        endingCash: cashFlow.cashPositions.ending
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating financial reports:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating financial reports',
                error: error.message
            });
        }
    }
}

module.exports = AccountingController;
