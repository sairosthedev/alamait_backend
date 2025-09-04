const FinancialReportingService = require('../services/financialReportingService');
const AccountingService = require('../services/accountingService');
const BalanceSheetService = require('../services/balanceSheetService');
const Account = require('../models/Account');
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
     * Get all balance sheet accounts (Assets, Liabilities, Equity)
     * GET /api/financial-reports/balance-sheet-accounts
     */
    static async getBalanceSheetAccounts(req, res) {
        try {
            const { includeInactive = 'false' } = req.query;
            const filter = {
                type: { $in: ['Asset', 'Liability', 'Equity'] }
            };
            if (includeInactive !== 'true') {
                filter.isActive = true;
            }

            const accounts = await Account.find(filter).sort({ code: 1 });

            // Shape response grouped by type
            const grouped = {
                assets: [],
                liabilities: [],
                equity: []
            };

            accounts.forEach(acc => {
                const base = {
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    category: acc.category || null,
                    subcategory: acc.subcategory || null,
                    description: acc.description || null,
                    isActive: acc.isActive,
                    level: acc.level,
                    sortOrder: acc.sortOrder
                };
                if (acc.type === 'Asset') grouped.assets.push(base);
                else if (acc.type === 'Liability') grouped.liabilities.push(base);
                else if (acc.type === 'Equity') grouped.equity.push(base);
            });

            res.json({
                success: true,
                data: grouped,
                count: accounts.length,
                message: 'Balance sheet accounts fetched from chart of accounts'
            });
        } catch (error) {
            console.error('Error fetching balance sheet accounts:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching balance sheet accounts',
                error: error.message
            });
        }
    }
    
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
                // Use residence-filtered method with basis and monthly breakdown
                incomeStatement = await FinancialReportingService.generateResidenceFilteredIncomeStatement(period, residence, basis);
            } else {
                // Use FinancialReportingService with basis parameter and monthly breakdown
                incomeStatement = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis);
            }
            
            // Add cache-busting headers to prevent 304 responses
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
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
                // Specific month requested with basis
                monthlyIncomeStatement = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis);
                // Note: You may need to add month filtering to FinancialReportingService
            } else if (residence) {
                // Use residence-filtered method with basis
                monthlyIncomeStatement = await FinancialReportingService.generateResidenceFilteredIncomeStatement(period, residence, basis);
            } else {
                // Use FinancialReportingService with basis parameter
                monthlyIncomeStatement = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis);
            }
            
            // Add cache-busting headers to prevent 304 responses
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
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
            
            // Use FinancialReportingService for monthly breakdown with residence filtering
            try {
                const monthlyBreakdown = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis, residence);
                
                if (monthlyBreakdown && monthlyBreakdown.monthly_breakdown) {
                    // Process the monthly breakdown data
                    Object.entries(monthlyBreakdown.monthly_breakdown).forEach(([monthIndex, monthData]) => {
                        const month = parseInt(monthIndex) + 1; // Convert 0-based index to 1-based month
                        
                        // Calculate monthly totals
                        const monthRevenue = monthData.total_revenue || 0;
                        const monthExpenses = monthData.total_expenses || 0;
                        const monthNetIncome = monthRevenue - monthExpenses;
                        
                        monthlyData[month] = {
                            month: month,
                            monthName: monthData.month || new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            revenue: {
                                rentalIncome: monthRevenue, // You can break this down further if needed
                                adminIncome: 0, // You can calculate this from the monthly breakdown
                                total: monthRevenue
                            },
                            expenses: {
                                total: monthExpenses,
                                breakdown: monthData.expenses || {}
                            },
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
                    });
                } else {
                    // Fallback: create empty monthly structure
                    for (let month = 1; month <= 12; month++) {
                        monthlyData[month] = {
                            month: month,
                            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            revenue: { rentalIncome: 0, adminIncome: 0, total: 0 },
                            expenses: { total: 0, breakdown: {} },
                            netIncome: 0,
                            summary: { totalRevenue: 0, totalExpenses: 0, totalNetIncome: 0 }
                        };
                    }
                }
            } catch (serviceError) {
                console.log('⚠️ FinancialReportingService failed, using fallback:', serviceError.message);
                // Fallback: create empty monthly structure
                for (let month = 1; month <= 12; month++) {
                    monthlyData[month] = {
                        month: month,
                        monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                        revenue: { rentalIncome: 0, adminIncome: 0, total: 0 },
                        expenses: { total: 0, breakdown: {} },
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
     * Generate Balance Sheet
     * GET /api/finance/reports/balance-sheet
     */
    static async generateBalanceSheet(req, res) {
        try {
            const { asOfDate, residence } = req.query;
            
            if (!asOfDate) {
                return res.status(400).json({
                    success: false,
                    message: 'asOfDate parameter is required (e.g., 2025-12-31)'
                });
            }
            
            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(asOfDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'asOfDate must be in YYYY-MM-DD format'
                });
            }
            
            const balanceSheet = await BalanceSheetService.generateBalanceSheet(asOfDate, residence);
            
            // Add cache-busting headers to prevent 304 responses
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.json({
                success: true,
                data: balanceSheet,
                message: `Balance sheet generated as of ${asOfDate}${residence ? ` for residence: ${residence}` : ' (all residences)'}`
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
     * Generate Monthly Balance Sheet
     * GET /api/finance/reports/monthly-balance-sheet
     */
    static async generateMonthlyBalanceSheet(req, res) {
        try {
            const { period, basis = 'accrual', residence, type = 'monthly' } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2025)'
                });
            }
            
            if (!['accrual', 'cash'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "accrual" or "cash"'
                });
            }
            
            if (!['cumulative', 'monthly'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Type must be either "monthly" (monthly activity/change) or "cumulative" (balance as of month end)'
                });
            }
            
            // 🚀 OPTIMIZATION: Add timeout and progress tracking
            console.log(`🚀 Starting optimized monthly balance sheet generation for ${period}... [DEPLOYED]`);
            const startTime = Date.now();
            
            // Set a timeout promise to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Balance sheet generation timed out after 4 minutes'));
                }, 240000); // 4 minutes timeout (increased to allow parallel processing)
            });
            
            const balanceSheetPromise = BalanceSheetService.generateMonthlyBalanceSheet(period, residence, type);
            
            const monthlyBalanceSheet = await Promise.race([balanceSheetPromise, timeoutPromise]);
            
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            console.log(`✅ Balance sheet generation completed in ${duration.toFixed(2)} seconds`);
            
            
            // Add performance metrics to response
            monthlyBalanceSheet.performance = {
                generationTime: duration,
                timestamp: new Date().toISOString(),
                optimizations: ['cached_accounts', 'parallel_processing', 'batch_transactions', 'zero_balance_skip']
            };
            
            
            res.json({
                success: true,
                data: monthlyBalanceSheet,
                message: `Monthly balance sheet breakdown generated for ${period} (${basis} basis, ${type} type)${residence ? ` for residence: ${residence}` : ' (all residences)'}`
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
     * Generate Monthly Income & Expenses with Residence Filter (Dashboard)
     * GET /api/financial-reports/monthly-income-expenses
     * 
     * Purpose: Dashboard display showing actual cash received/spent per month
     * Default: Cash basis (shows real money flow, not accruals)
     * Filter: Optional residence ID for property-specific dashboards
     */
    static async generateMonthlyIncomeExpenses(req, res) {
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

            console.log(`📊 Generating monthly income & expenses for DASHBOARD - ${period} (${basis} basis)${residence ? `, residence: ${residence}` : ''}`);
            console.log(`💡 Note: This endpoint defaults to CASH BASIS for dashboard display (actual money received/spent)`);

            // Generate monthly breakdown for all 12 months
            const monthlyBreakdown = {};
            let totalAnnualRevenue = 0;
            let totalAnnualExpenses = 0;
            let totalAnnualNetIncome = 0;

            // Process each month
            for (let month = 1; month <= 12; month++) {
                try {
                    const monthData = await AccountingService.generateMonthlyIncomeStatement(month, parseInt(period), residence);
                    
                    if (monthData && monthData.success) {
                        const monthName = new Date(2025, month - 1, 1).toLocaleString('en-US', { month: 'long' });
                        
                        monthlyBreakdown[month] = {
                            month,
                            monthName,
                            revenue: monthData.revenue || { total: 0 },
                            expenses: monthData.expenses || { total: 0 },
                            netIncome: monthData.netIncome || 0,
                            summary: {
                                totalRevenue: monthData.revenue?.total || 0,
                                totalExpenses: monthData.expenses?.total || 0,
                                totalNetIncome: monthData.netIncome || 0
                            }
                        };

                        // Accumulate annual totals
                        totalAnnualRevenue += monthData.revenue?.total || 0;
                        totalAnnualExpenses += monthData.expenses?.total || 0;
                        totalAnnualNetIncome += monthData.netIncome || 0;

                        console.log(`  ✅ Month ${month} (${monthName}): Revenue $${monthData.revenue?.total || 0}, Expenses $${monthData.expenses?.total || 0}, Net $${monthData.netIncome || 0}`);
                    } else {
                        monthlyBreakdown[month] = {
                            month,
                            monthName: new Date(2025, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
                            revenue: { total: 0 },
                            expenses: { total: 0 },
                            netIncome: 0,
                            summary: {
                                totalRevenue: 0,
                                totalExpenses: 0,
                                totalNetIncome: 0
                            }
                        };
                        console.log(`  ⚠️ Month ${month}: No data available`);
                    }
                } catch (monthError) {
                    console.error(`  ❌ Error processing month ${month}:`, monthError.message);
                    monthlyBreakdown[month] = {
                        month,
                        monthName: new Date(2025, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
                        revenue: { total: 0 },
                        expenses: { total: 0 },
                        netIncome: 0,
                        summary: {
                            totalRevenue: 0,
                            totalExpenses: 0,
                            totalNetIncome: 0
                        }
                    };
                }
            }

            // Create annual summary
            const annualSummary = {
                totalAnnualRevenue,
                totalAnnualExpenses,
                totalAnnualNetIncome,
                averageMonthlyRevenue: totalAnnualRevenue / 12,
                averageMonthlyExpenses: totalAnnualExpenses / 12,
                averageMonthlyNetIncome: totalAnnualNetIncome / 12
            };

            const response = {
                success: true,
                data: {
                    period,
                    basis,
                    residence: residence || null,
                    monthlyBreakdown,
                    annualSummary,
                    message: `Monthly income & expenses generated for ${period} (${basis} basis)${residence ? `, residence: ${residence}` : ''}`
                }
            };

            console.log(`🎉 Generated monthly breakdown: $${totalAnnualRevenue} revenue, $${totalAnnualExpenses} expenses, $${totalAnnualNetIncome} net income`);
            
            res.json(response);
            
        } catch (error) {
            console.error('❌ Error generating monthly income & expenses:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly income & expenses',
                error: error.message
            });
        }
    }

    /**
     * Generate Monthly Cash Flow with Detailed Breakdowns
     * GET /api/finance/reports/monthly-cash-flow
     */
    static async generateMonthlyCashFlow(req, res) {
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
            
            // Use the Enhanced Cash Flow Service for detailed breakdowns
            const EnhancedCashFlowService = require('../services/enhancedCashFlowService');
            const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            // Transform the data to match the expected format while adding detailed breakdowns
            const monthlyBreakdown = {};
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            
            monthNames.forEach((month, index) => {
                const monthKey = `${period}-${String(index + 1).padStart(2, '0')}`;
                const monthData = detailedCashFlow.detailed_breakdown.monthly_breakdown[monthKey] || {
                    income: { total: 0, rental_income: 0, admin_fees: 0, deposits: 0, utilities: 0, other_income: 0 },
                    expenses: { total: 0, maintenance: 0, utilities: 0, cleaning: 0, security: 0, management: 0, other_expenses: 0 },
                    net_cash_flow: 0,
                    transaction_count: 0,
                    payment_count: 0,
                    expense_count: 0
                };
                
                monthlyBreakdown[month] = {
                    operating_activities: {
                        inflows: monthData.income.total,
                        outflows: monthData.expenses.total,
                        net: monthData.income.total - monthData.expenses.total,
                        breakdown: {
                            // Detailed income breakdown
                            rental_income: { amount: monthData.income.rental_income, description: 'Rental Income from Students' },
                            admin_fees: { amount: monthData.income.admin_fees, description: 'Administrative Fees' },
                            deposits: { amount: monthData.income.deposits, description: 'Security Deposits' },
                            utilities_income: { amount: monthData.income.utilities, description: 'Utilities Income' },
                            other_income: { amount: monthData.income.other_income, description: 'Other Income Sources' },
                            // Detailed expense breakdown
                            maintenance_expenses: { amount: monthData.expenses.maintenance, description: 'Property Maintenance' },
                            utilities_expenses: { amount: monthData.expenses.utilities, description: 'Utility Bills' },
                            cleaning_expenses: { amount: monthData.expenses.cleaning, description: 'Cleaning Services' },
                            security_expenses: { amount: monthData.expenses.security, description: 'Security Services' },
                            management_expenses: { amount: monthData.expenses.management, description: 'Management Fees' },
                            other_expenses: { amount: monthData.expenses.other_expenses, description: 'Other Operating Expenses' }
                        }
                    },
                    investing_activities: {
                        inflows: 0,
                        outflows: 0,
                        net: 0,
                        breakdown: {}
                    },
                    financing_activities: {
                        inflows: 0,
                        outflows: 0,
                        net: 0,
                        breakdown: {}
                    },
                    net_cash_flow: monthData.net_cash_flow,
                    opening_balance: 0, // Will be calculated
                    closing_balance: 0, // Will be calculated
                    // Additional detailed information
                    transaction_details: {
                        transaction_count: monthData.transaction_count,
                        payment_count: monthData.payment_count,
                        expense_count: monthData.expense_count
                    }
                };
            });
            
            // Calculate opening and closing balances
            let runningBalance = 0;
            monthNames.forEach(month => {
                monthlyBreakdown[month].opening_balance = runningBalance;
                runningBalance += monthlyBreakdown[month].net_cash_flow;
                monthlyBreakdown[month].closing_balance = runningBalance;
            });
            
            // Calculate yearly totals with detailed breakdowns
            const yearlyTotals = {
                operating_activities: {
                    inflows: detailedCashFlow.summary.total_income,
                    outflows: detailedCashFlow.summary.total_expenses,
                    net: detailedCashFlow.summary.total_income - detailedCashFlow.summary.total_expenses,
                    breakdown: {
                        // Income breakdown
                        rental_income: { 
                            amount: detailedCashFlow.detailed_breakdown.income.by_source.rental_income.total, 
                            description: 'Total Rental Income',
                            transactions: detailedCashFlow.detailed_breakdown.income.by_source.rental_income.transactions.length
                        },
                        admin_fees: { 
                            amount: detailedCashFlow.detailed_breakdown.income.by_source.admin_fees.total, 
                            description: 'Total Administrative Fees',
                            transactions: detailedCashFlow.detailed_breakdown.income.by_source.admin_fees.transactions.length
                        },
                        deposits: { 
                            amount: detailedCashFlow.detailed_breakdown.income.by_source.deposits.total, 
                            description: 'Total Security Deposits',
                            transactions: detailedCashFlow.detailed_breakdown.income.by_source.deposits.transactions.length
                        },
                        utilities_income: { 
                            amount: detailedCashFlow.detailed_breakdown.income.by_source.utilities.total, 
                            description: 'Total Utilities Income',
                            transactions: detailedCashFlow.detailed_breakdown.income.by_source.utilities.transactions.length
                        },
                        other_income: { 
                            amount: detailedCashFlow.detailed_breakdown.income.by_source.other_income.total, 
                            description: 'Total Other Income',
                            transactions: detailedCashFlow.detailed_breakdown.income.by_source.other_income.transactions.length
                        },
                        // Expense breakdown
                        maintenance_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.maintenance.total, 
                            description: 'Total Maintenance Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.maintenance.transactions.length
                        },
                        utilities_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.utilities.total, 
                            description: 'Total Utility Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.utilities.transactions.length
                        },
                        cleaning_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.cleaning.total, 
                            description: 'Total Cleaning Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.cleaning.transactions.length
                        },
                        security_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.security.total, 
                            description: 'Total Security Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.security.transactions.length
                        },
                        management_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.management.total, 
                            description: 'Total Management Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.management.transactions.length
                        },
                        other_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses.by_category.other_expenses.total, 
                            description: 'Total Other Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses.by_category.other_expenses.transactions.length
                        }
                    }
                },
                investing_activities: {
                    inflows: detailedCashFlow.summary.net_investing_cash_flow > 0 ? detailedCashFlow.summary.net_investing_cash_flow : 0,
                    outflows: detailedCashFlow.summary.net_investing_cash_flow < 0 ? Math.abs(detailedCashFlow.summary.net_investing_cash_flow) : 0,
                    net: detailedCashFlow.summary.net_investing_cash_flow,
                    breakdown: {}
                },
                financing_activities: {
                    inflows: detailedCashFlow.summary.net_financing_cash_flow > 0 ? detailedCashFlow.summary.net_financing_cash_flow : 0,
                    outflows: detailedCashFlow.summary.net_financing_cash_flow < 0 ? Math.abs(detailedCashFlow.summary.net_financing_cash_flow) : 0,
                    net: detailedCashFlow.summary.net_financing_cash_flow,
                    breakdown: {}
                },
                net_cash_flow: detailedCashFlow.summary.net_change_in_cash
            };
            
            // Enhanced summary with detailed insights
            const summary = {
                best_cash_flow_month: monthNames.reduce((best, month) => 
                    monthlyBreakdown[month].net_cash_flow > monthlyBreakdown[best].net_cash_flow ? month : best, 'january'),
                worst_cash_flow_month: monthNames.reduce((worst, month) => 
                    monthlyBreakdown[month].net_cash_flow < monthlyBreakdown[worst].net_cash_flow ? month : worst, 'january'),
                average_monthly_cash_flow: detailedCashFlow.summary.net_change_in_cash / 12,
                ending_cash_balance: runningBalance,
                // Additional detailed insights
                total_income: detailedCashFlow.summary.total_income,
                total_expenses: detailedCashFlow.summary.total_expenses,
                transaction_count: detailedCashFlow.summary.transaction_count,
                payment_count: detailedCashFlow.summary.payment_count,
                expense_count: detailedCashFlow.summary.expense_count,
                // Income breakdown summary
                income_breakdown: detailedCashFlow.detailed_breakdown.income.by_source,
                // Expense breakdown summary
                expense_breakdown: detailedCashFlow.detailed_breakdown.expenses.by_category,
                // Residence breakdown
                residence_breakdown: {
                    income: detailedCashFlow.detailed_breakdown.income.by_residence,
                    expenses: detailedCashFlow.detailed_breakdown.expenses.by_residence
                }
            };
            
            const enhancedCashFlowData = {
                period,
                basis,
                monthly_breakdown: monthlyBreakdown,
                yearly_totals: yearlyTotals,
                summary: summary,
                // Include detailed breakdowns for frontend consumption
                detailed_breakdown: {
                    income: detailedCashFlow.detailed_breakdown.income,
                    expenses: detailedCashFlow.detailed_breakdown.expenses,
                    transactions: detailedCashFlow.detailed_breakdown.transactions,
                    payments: detailedCashFlow.detailed_breakdown.payments,
                    expenses_detail: detailedCashFlow.detailed_breakdown.expenses_detail
                }
            };
            
            res.json({
                success: true,
                data: enhancedCashFlowData,
                message: `Enhanced monthly cash flow with detailed breakdowns generated for ${period} (${basis} basis)${residence ? ` for residence: ${residence}` : ' (all residences)'}`
            });
            
        } catch (error) {
            console.error('Error generating enhanced monthly cash flow:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating enhanced monthly cash flow',
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
            
            const year = parseInt(period);
            const monthlyData = {};
            let totalAnnualAssets = 0;
            let totalAnnualLiabilities = 0;
            let totalAnnualEquity = 0;
            
            // Fetch balance sheet for each month (1-12)
            for (let month = 1; month <= 12; month++) {
                try {
                    const monthData = await AccountingService.generateMonthlyBalanceSheet(month, year, residence);
                    
                    if (monthData) {
                        monthlyData[month] = {
                            month: month,
                            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            assets: monthData.assets,
                            liabilities: monthData.liabilities,
                            equity: monthData.equity,
                            balanceCheck: monthData.balanceCheck,
                            summary: {
                                totalAssets: monthData.assets.total,
                                totalLiabilities: monthData.liabilities.total,
                                totalEquity: monthData.equity.total
                            }
                        };
                        
                        totalAnnualAssets += monthData.assets.total;
                        totalAnnualLiabilities += monthData.liabilities.total;
                        totalAnnualEquity += monthData.equity.total;
                    }
                } catch (monthError) {
                    console.log(`⚠️ Failed to fetch month ${month}:`, monthError.message);
                    monthlyData[month] = {
                        month: month,
                        monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                        assets: { total: 0, current: { cashAndBank: { total: 0 }, accountsReceivable: { amount: 0 } } },
                        liabilities: { total: 0, current: { accountsPayable: { amount: 0 }, tenantDeposits: { amount: 0 } } },
                        equity: { total: 0, retainedEarnings: { amount: 0 } },
                        balanceCheck: 'No data',
                        summary: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }
                    };
                }
            }
            
            const result = {
                monthly: monthlyData,
                annualSummary: {
                    totalAnnualAssets: totalAnnualAssets / 12, // Average monthly
                    totalAnnualLiabilities: totalAnnualLiabilities / 12, // Average monthly
                    totalAnnualEquity: totalAnnualEquity / 12 // Average monthly
                }
            };
            
            res.json({
                success: true,
                data: result,
                message: `Monthly balance sheet breakdown generated for ${period} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating monthly balance sheet breakdown:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating monthly balance sheet breakdown',
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
                cashFlowStatement = await FinancialReportingService.generateResidenceFilteredCashFlowStatement(period, residence, basis);
            } else {
                // Use regular method
                cashFlowStatement = await FinancialReportingService.generateMonthlyCashFlow(period, basis);
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
     * Generate Detailed Cash Flow Statement with specific income and expense breakdowns
     * GET /api/finance/reports/detailed-cash-flow
     */
    static async generateDetailedCashFlowStatement(req, res) {
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
            
            let detailedCashFlowStatement;
            if (residence) {
                // For now, use the detailed method but filter by residence
                // TODO: Create residence-filtered detailed cash flow method
                detailedCashFlowStatement = await FinancialReportingService.generateDetailedCashFlowStatement(period, basis);
                // Filter by residence in the response
                if (detailedCashFlowStatement.detailed_breakdown) {
                    detailedCashFlowStatement.detailed_breakdown.transactions = 
                        detailedCashFlowStatement.detailed_breakdown.transactions.filter(t => 
                            t.residence && t.residence.toString() === residence
                        );
                }
            } else {
                // Use detailed method
                detailedCashFlowStatement = await FinancialReportingService.generateDetailedCashFlowStatement(period, basis);
            }
            
            res.json({
                success: true,
                data: detailedCashFlowStatement,
                message: `Detailed cash flow statement generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating detailed cash flow statement',
                error: error.message
            });
        }
    }

    /**
     * Generate Residence-Filtered Cash Flow Statement
     * GET /api/financial-reports/cash-flow/residences
     */
    static async generateResidenceFilteredCashFlowStatement(req, res) {
        try {
            const { period, basis = 'cash', residence } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)'
                });
            }
            
            if (!residence) {
                return res.status(400).json({
                    success: false,
                    message: 'Residence parameter is required'
                });
            }
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            const cashFlowStatement = await FinancialReportingService.generateResidenceFilteredCashFlowStatement(period, residence, basis);
            
            res.json({
                success: true,
                data: cashFlowStatement,
                message: `Residence-filtered cash flow statement generated for ${period}, residence: ${residence} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating residence-filtered cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating residence-filtered cash flow statement',
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

    /**
     * Generate Comprehensive Monthly Balance Sheet
     * GET /api/finance/reports/comprehensive-monthly-balance-sheet
     */
    static async generateComprehensiveMonthlyBalanceSheet(req, res) {
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
            
            const monthlyBalanceSheet = await FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(period, basis, residence);
            
            // Add cache-busting headers to prevent 304 responses
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.json({
                success: true,
                data: monthlyBalanceSheet,
                message: `Comprehensive monthly balance sheet generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating comprehensive monthly balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating comprehensive monthly balance sheet',
                error: error.message
            });
        }
    }

    /**
     * Generate Detailed Cash Flow Statement with specific income and expense breakdowns
     * GET /api/finance/reports/detailed-cash-flow
     */
    static async generateDetailedCashFlowStatement(req, res) {
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
            
            let detailedCashFlowStatement;
            if (residence) {
                // For now, use the detailed method but filter by residence
                // TODO: Create residence-filtered detailed cash flow method
                detailedCashFlowStatement = await FinancialReportingService.generateDetailedCashFlowStatement(period, basis);
                // Filter by residence in the response
                if (detailedCashFlowStatement.detailed_breakdown) {
                    detailedCashFlowStatement.detailed_breakdown.transactions = 
                        detailedCashFlowStatement.detailed_breakdown.transactions.filter(t => 
                            t.residence && t.residence.toString() === residence
                        );
                }
            } else {
                // Use detailed method
                detailedCashFlowStatement = await FinancialReportingService.generateDetailedCashFlowStatement(period, basis);
            }
            
            res.json({
                success: true,
                data: detailedCashFlowStatement,
                message: `Detailed cash flow statement generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
            });
            
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating detailed cash flow statement',
                error: error.message
            });
        }
    }
}

module.exports = FinancialReportsController; 