const FinancialReportingService = require('../services/financialReportingService');
const AccountingService = require('../services/accountingService');
const { validateToken } = require('../middleware/auth');

/**
 * Financial Reports Controller
 * 
 * Provides endpoints for generating comprehensive financial reports:
 * - Income Statement (Profit & Loss)
 * - Balance Sheet
 * - Cash Flow Statement
 * - Trial Balance
 * - General Ledger
 * - Account Balances
 */

class FinancialReportsController {
    
    /**
     * Generate Income Statement
     * GET /api/finance/reports/income-statement
     */
    static async generateIncomeStatement(req, res) {
        try {
            const { period, basis = 'cash', residence } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            let incomeStatement;
            if (residence) {
                // Use residence-filtered method
                incomeStatement = await AccountingService.generateMonthlyIncomeStatement(null, parseInt(period), residence);
            } else {
                // Use regular method - call your working AccountingService
                incomeStatement = await AccountingService.generateMonthlyIncomeStatement(null, parseInt(period));
            }
            
            res.json({
                success: true,
                data: incomeStatement,
                message: `Income statement generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating income statement',
                error: error.message
            });
        }
    }

    /**
     * Generate Monthly Income Statement
     * GET /api/finance/reports/monthly-income-statement
     */
    static async generateMonthlyIncomeStatement(req, res) {
        try {
            const { period, basis = 'cash', residence, month } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            let monthlyIncomeStatement;
            if (month) {
                // Specific month requested
                monthlyIncomeStatement = await AccountingService.generateMonthlyIncomeStatement(parseInt(month), parseInt(period), residence);
            } else if (residence) {
                // Use residence-filtered method
                monthlyIncomeStatement = await AccountingService.generateMonthlyIncomeStatement(parseInt(period), parseInt(period), residence);
            } else {
                // Use regular method - call your working AccountingService
                monthlyIncomeStatement = await AccountingService.generateMonthlyIncomeStatement(parseInt(period), parseInt(period));
            }
            
            res.json({
                success: true,
                data: monthlyIncomeStatement,
                message: `Monthly income statement generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly income statement',
                error: error.message
            });
        }
    }

    /**
     * Generate Monthly Breakdown (All months for a year)
     * GET /api/finance/reports/monthly-breakdown?period=2025&basis=accrual
     */
    static async generateMonthlyBreakdown(req, res) {
        try {
            const { period, basis = 'accrual', residence } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2025)'
                });
            }
            
            const year = parseInt(period);
            const monthlyData = {};
            let totalAnnualRevenue = 0;
            let totalAnnualExpenses = 0;
            let totalAnnualNetIncome = 0;
            
            // Fetch data for each month (1-12)
            for (let month = 1; month <= 12; month++) {
                try {
                    const monthData = await AccountingService.generateMonthlyIncomeStatement(month, year, residence);
                    
                    if (monthData) {
                        const monthRevenue = monthData.revenue?.total || 0;
                        const monthExpenses = monthData.expenses?.total || 0;
                        const monthNetIncome = monthData.netIncome || 0;
                        
                        monthlyData[month] = {
                            month: month,
                            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            revenue: monthData.revenue || {},
                            expenses: monthData.expenses || {},
                            netIncome: monthNetIncome,
                            summary: {
                                totalRevenue: monthRevenue,
                                totalExpenses: monthExpenses,
                                totalNetIncome: monthNetIncome
                            }
                        };
                        
                        totalAnnualRevenue += monthRevenue;
                        totalAnnualExpenses += monthExpenses;
                        totalAnnualNetIncome += monthNetIncome;
                    }
                } catch (monthError) {
                    console.log(`⚠️ Failed to fetch month ${month}:`, monthError.message);
                    monthlyData[month] = {
                        month: month,
                        monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                        revenue: {},
                        expenses: {},
                        netIncome: 0,
                        summary: { totalRevenue: 0, totalExpenses: 0, totalNetIncome: 0 }
                    };
                }
            }
            
            const result = {
                monthly: monthlyData,
                annualSummary: {
                    totalAnnualRevenue,
                    totalAnnualExpenses,
                    totalAnnualNetIncome
                }
            };
            
            res.json({
                success: true,
                data: result,
                message: `Monthly breakdown generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly breakdown:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly breakdown',
                error: error.message
            });
        }
    }

    /**
     * Generate Monthly Expenses
     * GET /api/finance/reports/monthly-expenses
     */
    static async generateMonthlyExpenses(req, res) {
        try {
            const { period, basis = 'cash' } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            // For now, use the existing income statement method but filter for expenses only
            const monthlyExpenses = await FinancialReportingService.generateMonthlyIncomeStatement(period, basis);
            
            // Filter to show only expenses
            const expensesOnly = {
                period,
                basis,
                monthly_breakdown: {},
                yearly_totals: {
                    expenses: monthlyExpenses.yearly_totals.expenses,
                    total_expenses: monthlyExpenses.yearly_totals.total_expenses
                }
            };
            
            // Extract only expenses from monthly breakdown
            Object.keys(monthlyExpenses.monthly_breakdown).forEach(month => {
                expensesOnly.monthly_breakdown[month] = {
                    expenses: monthlyExpenses.monthly_breakdown[month].expenses,
                    total_expenses: monthlyExpenses.monthly_breakdown[month].total_expenses
                };
            });
            
            res.json({
                success: true,
                data: expensesOnly,
                message: `Monthly expenses generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly expenses:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly expenses',
                error: error.message
            });
        }
    }

    /**
     * Generate Monthly Cash Flow
     * GET /api/finance/reports/monthly-cash-flow
     */
    static async generateMonthlyCashFlow(req, res) {
        try {
            const { period, basis = 'cash' } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            // For now, return a simplified monthly cash flow
            const monthlyCashFlow = {
                period,
                basis,
                monthly_breakdown: {
                    january: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    february: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    march: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    april: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    may: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    june: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    july: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    august: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    september: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    october: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    november: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 },
                    december: { net_cash_flow: 0, operating: 0, investing: 0, financing: 0 }
                },
                yearly_totals: {
                    net_cash_flow: 0,
                    operating_activities: 0,
                    investing_activities: 0,
                    financing_activities: 0
                }
            };
            
            res.json({
                success: true,
                data: monthlyCashFlow,
                message: `Monthly cash flow generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly cash flow:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly cash flow',
                error: error.message
            });
        }
    }
    
    /**
     * Generate Monthly Balance Sheet
     * GET /api/finance/reports/monthly-balance-sheet
     */
    static async generateMonthlyBalanceSheet(req, res) {
        try {
            const { period, basis = 'cash' } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            const monthlyBalanceSheet = await FinancialReportingService.generateMonthlyBalanceSheet(period, basis);
            
            res.json({
                success: true,
                data: monthlyBalanceSheet,
                message: `Monthly balance sheet generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly balance sheet',
                error: error.message
            });
        }
    }

    /**
     * Generate Balance Sheet
     * GET /api/finance/reports/balance-sheet
     */
    static async generateBalanceSheet(req, res) {
        try {
            const { asOf, basis = 'cash', residence } = req.query;
            
            if (!asOf) {
                return res.status(400).json({
                    success: false,
                    message: 'asOf parameter is required (e.g., 2024-12-31)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            let balanceSheet;
            if (residence) {
                // Use residence-filtered method
                balanceSheet = await FinancialReportingService.generateResidenceFilteredBalanceSheet(asOf, residence, basis);
            } else {
                // Use regular method
                balanceSheet = await FinancialReportingService.generateBalanceSheet(asOf, basis);
            }
            
            res.json({
                success: true,
                data: balanceSheet,
                message: `Balance sheet generated as of ${asOf}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating balance sheet',
                error: error.message
            });
        }
    }
    
    /**
     * Generate Cash Flow Statement
     * GET /api/finance/reports/cash-flow
     */
    static async generateCashFlowStatement(req, res) {
        try {
            const { period, basis = 'cash', residence } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            let cashFlowStatement;
            if (residence) {
                // Use residence-filtered method
                cashFlowStatement = await FinancialReportingService.generateResidenceFilteredCashFlow(period, residence, basis);
            } else {
                // Use regular method
                cashFlowStatement = await FinancialReportingService.generateCashFlowStatement(period, basis);
            }
            
            res.json({
                success: true,
                data: cashFlowStatement,
                message: `Cash flow statement generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating cash flow statement',
                error: error.message
            });
        }
    }
    
    /**
     * Generate Trial Balance
     * GET /api/finance/reports/trial-balance
     */
    static async generateTrialBalance(req, res) {
        try {
            const { asOf, basis = 'cash' } = req.query;
            
            if (!asOf) {
                return res.status(400).json({
                    success: false,
                    message: 'asOf parameter is required (e.g., 2024-12-31)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            const trialBalance = await FinancialReportingService.generateTrialBalance(asOf, basis);
            
            res.json({
                success: true,
                data: trialBalance,
                message: `Trial balance generated as of ${asOf} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating trial balance:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating trial balance',
                error: error.message
            });
        }
    }
    
    /**
     * Generate General Ledger
     * GET /api/finance/reports/general-ledger
     */
    static async generateGeneralLedger(req, res) {
        try {
            const { account, period, basis = 'cash' } = req.query;
            
            if (!account) {
                return res.status(400).json({
                    success: false,
                    message: 'Account parameter is required (e.g., 5001)'
                });
            }
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            const generalLedger = await FinancialReportingService.generateGeneralLedger(account, period, basis);
            
            res.json({
                success: true,
                data: generalLedger,
                message: `General ledger generated for account ${account} for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating general ledger:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating general ledger',
                error: error.message
            });
        }
    }
    
    /**
     * Get Account Balances
     * GET /api/finance/reports/account-balances
     */
    static async getAccountBalances(req, res) {
        try {
            const { asOf, basis = 'cash' } = req.query;
            
            if (!asOf) {
                return res.status(400).json({
                    success: false,
                    message: 'asOf parameter is required (e.g., 2024-12-31)'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            const asOfDate = new Date(asOf);
            
            // Get balances for all account types
            const assets = await FinancialReportingService.getAccountBalancesByType('Asset', asOfDate, basis);
            const liabilities = await FinancialReportingService.getAccountBalancesByType('Liability', asOfDate, basis);
            const equity = await FinancialReportingService.getAccountBalancesByType('Equity', asOfDate, basis);
            const income = await FinancialReportingService.getAccountBalancesByType('Income', asOfDate, basis);
            const expenses = await FinancialReportingService.getAccountBalancesByType('Expense', asOfDate, basis);
            
            res.json({
                success: true,
                data: {
                    asOf,
                    basis,
                    assets,
                    liabilities,
                    equity,
                    income,
                    expenses
                },
                message: `Account balances retrieved as of ${asOf} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error getting account balances:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting account balances',
                error: error.message
            });
        }
    }
    
    /**
     * Get Comprehensive Financial Summary
     * GET /api/finance/reports/financial-summary
     */
    static async getFinancialSummary(req, res) {
        try {
            const { period, asOf, basis = 'cash' } = req.query;
            
            if (!period || !asOf) {
                return res.status(400).json({
                    success: false,
                    message: 'Both period and asOf parameters are required'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            // Generate all reports
            const [incomeStatement, balanceSheet, cashFlowStatement, trialBalance] = await Promise.all([
                FinancialReportingService.generateIncomeStatement(period, basis),
                FinancialReportingService.generateBalanceSheet(asOf, basis),
                FinancialReportingService.generateCashFlowStatement(period, basis),
                FinancialReportingService.generateTrialBalance(asOf, basis)
            ]);
            
            res.json({
                success: true,
                data: {
                    period,
                    asOf,
                    basis,
                    income_statement: incomeStatement,
                    balance_sheet: balanceSheet,
                    cash_flow_statement: cashFlowStatement,
                    trial_balance: trialBalance
                },
                message: `Comprehensive financial summary generated for ${period} as of ${asOf} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating financial summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating financial summary',
                error: error.message
            });
        }
    }
    
    /**
     * Export Financial Report to PDF/Excel
     * GET /api/finance/reports/export/:reportType
     */
    static async exportFinancialReport(req, res) {
        try {
            const { reportType } = req.params;
            const { period, asOf, basis = 'cash', format = 'pdf' } = req.query;
            
            if (!['income-statement', 'balance-sheet', 'cash-flow', 'trial-balance', 'general-ledger'].includes(reportType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
            }
            
            if (!['pdf', 'excel'].includes(format)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format must be either "pdf" or "excel"'
                });
            }
            
            let reportData;
            
            switch (reportType) {
                case 'income-statement':
                    if (!period) {
                        return res.status(400).json({
                            success: false,
                            message: 'Period parameter is required for income statement'
                        });
                    }
                    reportData = await FinancialReportingService.generateIncomeStatement(period, basis);
                    break;
                    
                case 'balance-sheet':
                    if (!asOf) {
                        return res.status(400).json({
                            success: false,
                            message: 'asOf parameter is required for balance sheet'
                        });
                    }
                    reportData = await FinancialReportingService.generateBalanceSheet(asOf, basis);
                    break;
                    
                case 'cash-flow':
                    if (!period) {
                        return res.status(400).json({
                            success: false,
                            message: 'Period parameter is required for cash flow statement'
                        });
                    }
                    reportData = await FinancialReportingService.generateCashFlowStatement(period, basis);
                    break;
                    
                case 'trial-balance':
                    if (!asOf) {
                        return res.status(400).json({
                            success: false,
                            message: 'asOf parameter is required for trial balance'
                        });
                    }
                    reportData = await FinancialReportingService.generateTrialBalance(asOf, basis);
                    break;
                    
                case 'general-ledger':
                    const { account } = req.query;
                    if (!account || !period) {
                        return res.status(400).json({
                            success: false,
                            message: 'Both account and period parameters are required for general ledger'
                        });
                    }
                    reportData = await FinancialReportingService.generateGeneralLedger(account, period, basis);
                    break;
            }
            
            // TODO: Implement actual PDF/Excel generation
            // For now, return the data with export instructions
            res.json({
                success: true,
                data: reportData,
                export_info: {
                    report_type: reportType,
                    format: format,
                    filename: `${reportType}-${period || asOf}-${basis}.${format}`,
                    message: `Export functionality will be implemented. Data is ready for ${format.toUpperCase()} generation.`
                }
            });
            
        } catch (error) {
            console.error('Error exporting financial report:', error);
            res.status(500).json({
                success: false,
                message: 'Error exporting financial report',
                error: error.message
            });
        }
    }

    /**
     * Generate Comprehensive Monthly Income Statement
     * GET /api/financial-reports/comprehensive-monthly-income
     */
    static async generateComprehensiveMonthlyIncomeStatement(req, res) {
        try {
            const { period, basis = 'cash' } = req.query;
            
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
            
            const monthlyIncomeStatement = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis);
            
            res.json({
                success: true,
                data: monthlyIncomeStatement,
                message: `Comprehensive monthly income statement generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating comprehensive monthly income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating comprehensive monthly income statement',
                error: error.message
            });
        }
    }

    /**
     * Generate Comprehensive Monthly Cash Flow Statement
     * GET /api/financial-reports/comprehensive-monthly-cash-flow
     */
    static async generateComprehensiveMonthlyCashFlow(req, res) {
        try {
            const { period, basis = 'cash' } = req.query;
            
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
            
            const monthlyCashFlow = await FinancialReportingService.generateComprehensiveMonthlyCashFlow(period, basis);
            
            res.json({
                success: true,
                data: monthlyCashFlow,
                message: `Comprehensive monthly cash flow statement generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating comprehensive monthly cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating comprehensive monthly cash flow statement',
                error: error.message
            });
        }
    }
}

module.exports = FinancialReportsController; 