
const FinancialReportingService = require('../services/financialReportingService');
const EnhancedCashFlowService = require('../services/enhancedCashFlowService');
const AccountingService = require('../services/accountingService');
const BalanceSheetService = require('../services/balanceSheetService');
const SimpleBalanceSheetService = require('../services/simpleBalanceSheetService');
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

/**
 * Transform fixed balance sheet data to monthly structure expected by frontend
 */
function transformFixedBalanceSheetToMonthly(balanceSheetData, month, year) {
    const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    
    // Extract key accounts from the fixed balance sheet
    const assets = balanceSheetData.assets || {};
    const liabilities = balanceSheetData.liabilities || {};
    const equity = balanceSheetData.equity || {};
    
    // Helper function to check if account is a child of a parent
    const isChildAccount = (accountCode, parentCode) => {
        if (!accountCode || !parentCode) return false;
        
        // For accounts payable: 200001, 200002, etc. are children of 2000
        if (parentCode === '2000' && accountCode.startsWith('2000') && accountCode !== '2000') {
            return true;
        }
        // For accounts receivable: 1100-xxxxx are children of 1100
        if (parentCode === '1100' && accountCode.startsWith('1100-')) {
            return true;
        }
        return false;
    };
    
    // Helper function to find account by code in the new structure
    const findAccountByCode = (code) => {
        // First check current assets
        if (assets.current_assets) {
            const account = Object.values(assets.current_assets).find(acc => acc.code === code);
            if (account) return account;
        }
        
        // Then check non-current assets
        if (assets.non_current_assets) {
            const account = Object.values(assets.non_current_assets).find(acc => acc.code === code);
            if (account) return account;
        }
        
        return null;
    };
    
    // Build cash and bank section
    const cashAccount = findAccountByCode('1000');
    const bankAccount = findAccountByCode('1001');
    const ecocashAccount = findAccountByCode('1002');
    const innbucksAccount = findAccountByCode('1003');
    const pettyCashAccount = findAccountByCode('1004');
    const cashOnHandAccount = findAccountByCode('1005');
    const generalPettyCashAccount = findAccountByCode('1010');
    const adminPettyCashAccount = findAccountByCode('1011');
    const financePettyCashAccount = findAccountByCode('1012');
    const propertyManagerPettyCashAccount = findAccountByCode('1013');
    const maintenancePettyCashAccount = findAccountByCode('1014');
    
    // Add CBZ Vault and other custom accounts
    const cbzVaultAccount = findAccountByCode('10003');
    
    // Build accounts receivable with child aggregation
    const accountsReceivableAccount = findAccountByCode('1100');
    let totalAccountsReceivable = accountsReceivableAccount?.balance || 0;
    
    // Aggregate child accounts receivable into parent
    Object.entries(assets.current_assets || {}).forEach(([key, account]) => {
        if (isChildAccount(account.code, '1100')) {
            totalAccountsReceivable += account.balance || 0;
        }
    });
    
    // Build liabilities with child aggregation
    const accountsPayableAccount = Object.values(liabilities).find(acc => acc.code === '2000');
    let totalAccountsPayable = accountsPayableAccount?.balance || 0;
    
    // Aggregate child accounts payable into parent
    Object.entries(liabilities || {}).forEach(([key, account]) => {
        if (isChildAccount(account.code, '2000')) {
            totalAccountsPayable += account.balance || 0;
        }
    });
    
    const tenantDepositsAccount = Object.values(liabilities).find(acc => acc.code === '2020');
    const deferredIncomeAccount = Object.values(liabilities).find(acc => acc.code === '2200');
    
    // Build equity
    const retainedEarningsAccount = Object.values(equity).find(acc => acc.code === '3101');
    const ownerCapitalAccount = Object.values(equity).find(acc => acc.code === '3001');
    
    // Calculate totals
    const totalCashAndBank = (cashAccount?.balance || 0) + 
                           (bankAccount?.balance || 0) + 
                           (ecocashAccount?.balance || 0) + 
                           (innbucksAccount?.balance || 0) + 
                           (pettyCashAccount?.balance || 0) + 
                           (cashOnHandAccount?.balance || 0) + 
                           (generalPettyCashAccount?.balance || 0) + 
                           (adminPettyCashAccount?.balance || 0) + 
                           (financePettyCashAccount?.balance || 0) + 
                           (propertyManagerPettyCashAccount?.balance || 0) + 
                           (maintenancePettyCashAccount?.balance || 0) +
                           (cbzVaultAccount?.balance || 0);
    
    const totalAssets = balanceSheetData.assets?.total_assets || 0;
    const totalLiabilities = balanceSheetData.liabilities?.total_liabilities || 0;
    const totalEquity = balanceSheetData.equity?.total_equity || 0;
    
    // Check if balanced
    const balanceCheck = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'Balanced' : `Off by $${(totalAssets - (totalLiabilities + totalEquity)).toFixed(2)}`;
    
    // Build comprehensive structure with ALL accounts
    const allCurrentAssets = {};
    const allNonCurrentAssets = {};
    const allLiabilities = {};
    const allEquity = {};

    // Process ALL current assets with parent-child aggregation
    // Define accounts that are already included in specific sections to avoid duplication
    const cashAndBankAccountCodes = ['1000', '1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014', '10003'];
    
    Object.entries(assets.current_assets || {}).forEach(([key, account]) => {
        if (key !== 'total_current_assets') {
            // Skip child accounts - they will be aggregated into parents
            if (isChildAccount(account.code, '1100')) {
                return;
            }
            
            // Skip accounts that are already included in specific sections
            if (cashAndBankAccountCodes.includes(account.code)) {
                return;
            }
            
            allCurrentAssets[key] = {
                amount: account.balance || 0,
                accountCode: account.code,
                accountName: account.name,
                type: 'current_asset'
            };
        }
    });

    // Process ALL non-current assets
    Object.entries(assets.non_current_assets || {}).forEach(([key, account]) => {
        if (key !== 'total_non_current_assets') {
            allNonCurrentAssets[key] = {
                amount: account.balance || 0,
                accountCode: account.code,
                accountName: account.name,
                type: 'non_current_asset'
            };
        }
    });

    // Process ALL liabilities with parent-child aggregation
    // Define accounts that are already included in specific sections to avoid duplication
    const specificLiabilityAccountCodes = ['2000', '2020', '2200'];
    
    Object.entries(liabilities || {}).forEach(([key, account]) => {
        if (key !== 'total_liabilities') {
            // Skip child accounts - they will be aggregated into parents
            if (isChildAccount(account.code, '2000')) {
                return;
            }
            
            // Skip accounts that are already included in specific sections
            if (specificLiabilityAccountCodes.includes(account.code)) {
                return;
            }
            
            allLiabilities[key] = {
                amount: account.balance || 0,
                accountCode: account.code,
                accountName: account.name,
                type: 'liability'
            };
        }
    });

    // Process ALL equity accounts
    // Define accounts that are already included in specific sections to avoid duplication
    const specificEquityAccountCodes = ['3001', '3101'];
    
    Object.entries(equity || {}).forEach(([key, account]) => {
        if (key !== 'total_equity' && key !== 'retained_earnings') {
            // Skip accounts that are already included in specific sections
            if (specificEquityAccountCodes.includes(account.code)) {
                return;
            }
            
            allEquity[key] = {
                amount: account.balance || 0,
                accountCode: account.code,
                accountName: account.name,
                type: 'equity'
            };
        }
    });

    return {
        month: month,
        monthName: monthName,
        assets: {
            current: {
                cashAndBank: {
                    cash: {
                        amount: cashAccount?.balance || 0,
                        accountCode: '1000',
                        accountName: 'Cash'
                    },
                    bank: {
                        amount: bankAccount?.balance || 0,
                        accountCode: '1001',
                        accountName: 'Bank Account'
                    },
                    ecocash: {
                        amount: ecocashAccount?.balance || 0,
                        accountCode: '1002',
                        accountName: 'Ecocash'
                    },
                    innbucks: {
                        amount: innbucksAccount?.balance || 0,
                        accountCode: '1003',
                        accountName: 'Innbucks'
                    },
                    pettyCash: {
                        amount: pettyCashAccount?.balance || 0,
                        accountCode: '1004',
                        accountName: 'Petty Cash'
                    },
                    cashOnHand: {
                        amount: cashOnHandAccount?.balance || 0,
                        accountCode: '1005',
                        accountName: 'Cash on Hand'
                    },
                    generalPettyCash: {
                        amount: generalPettyCashAccount?.balance || 0,
                        accountCode: '1010',
                        accountName: 'General Petty Cash'
                    },
                    adminPettyCash: {
                        amount: adminPettyCashAccount?.balance || 0,
                        accountCode: '1011',
                        accountName: 'Admin Petty Cash'
                    },
                    financePettyCash: {
                        amount: financePettyCashAccount?.balance || 0,
                        accountCode: '1012',
                        accountName: 'Finance Petty Cash'
                    },
                    propertyManagerPettyCash: {
                        amount: propertyManagerPettyCashAccount?.balance || 0,
                        accountCode: '1013',
                        accountName: 'Property Manager Petty Cash'
                    },
                    maintenancePettyCash: {
                        amount: maintenancePettyCashAccount?.balance || 0,
                        accountCode: '1014',
                        accountName: 'Maintenance Petty Cash'
                    },
                    cbzVault: {
                        amount: cbzVaultAccount?.balance || 0,
                        accountCode: '10003',
                        accountName: 'Cbz Vault'
                    },
                    total: totalCashAndBank
                },
                accountsReceivable: {
                    amount: totalAccountsReceivable,
                    accountCode: '1100',
                    accountName: 'Accounts Receivable - Tenants'
                },
                // Include ALL other current assets
                allOtherCurrentAssets: allCurrentAssets
            },
            nonCurrent: allNonCurrentAssets, // Include ALL non-current assets
            total: totalAssets
        },
        liabilities: {
            current: {
                accountsPayable: {
                    amount: totalAccountsPayable,
                    accountCode: '2000',
                    accountName: 'Accounts Payable'
                },
                tenantDeposits: {
                    amount: tenantDepositsAccount?.balance || 0,
                    accountCode: '2020',
                    accountName: 'Tenant Deposits Held'
                },
                deferredIncome: {
                    amount: deferredIncomeAccount?.balance || 0,
                    accountCode: '2200',
                    accountName: 'Advance Payment Liability'
                }
            },
            all: allLiabilities, // Include ALL liabilities
            total: totalLiabilities
        },
        equity: {
            retainedEarnings: {
                amount: retainedEarningsAccount?.balance || 0,
                accountCode: '3101',
                accountName: 'Retained Earnings'
            },
            ownerCapital: {
                amount: ownerCapitalAccount?.balance || 0,
                accountCode: '3001',
                accountName: 'Owner Capital'
            },
            all: allEquity, // Include ALL equity accounts
            total: totalEquity
        },
        balanceCheck: balanceCheck,
        summary: {
            totalAssets: totalAssets,
            totalLiabilities: totalLiabilities,
            totalEquity: totalEquity
        }
    };
}

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
                incomeStatement = await FinancialReportingService.generateIncomeStatement(period, basis);
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
                // Use the comprehensive method but with fixed data structure parsing
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
                // Use the comprehensive method but with fixed data structure parsing
                const monthlyBreakdown = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(period, basis, residence);
                
                if (monthlyBreakdown && monthlyBreakdown.monthly_breakdown) {
                    // Debug: Log the data structure we're getting
                    console.log('🔍 Monthly breakdown data structure:', Object.keys(monthlyBreakdown.monthly_breakdown));
                    
                    // Process the monthly breakdown data
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    
                    Object.entries(monthlyBreakdown.monthly_breakdown).forEach(([monthKey, monthData]) => {
                        // Handle both numeric indices and month names
                        let month, monthName;
                        if (isNaN(parseInt(monthKey))) {
                            // Month name (january, february, etc.)
                            const monthIndex = monthNames.indexOf(monthKey);
                            month = monthIndex + 1;
                            monthName = monthData.month || new Date(parseInt(period), monthIndex, 1).toLocaleDateString('en-US', { month: 'long' });
                        } else {
                            // Numeric index (0, 1, 2, etc.)
                            month = parseInt(monthKey) + 1;
                            monthName = monthData.month || new Date(parseInt(period), parseInt(monthKey), 1).toLocaleDateString('en-US', { month: 'long' });
                        }
                        
                        // Calculate monthly totals
                        const monthRevenue = monthData.total_revenue || 0;
                        const monthExpenses = monthData.total_expenses || 0;
                        const monthNetIncome = monthRevenue - monthExpenses;
                        
                        // Separate rental income from admin income based on account codes
                        let rentalIncome = 0;
                        let adminIncome = 0;
                        
                        if (monthData.revenue) {
                            // Look for account codes in the revenue object keys
                            Object.keys(monthData.revenue).forEach(key => {
                                if (key.includes('4001') || key.includes('Rental')) {
                                    rentalIncome += monthData.revenue[key] || 0;
                                } else if (key.includes('4002') || key.includes('Administrative') || key.includes('Admin')) {
                                    adminIncome += monthData.revenue[key] || 0;
                                }
                            });
                            
                            // If no specific account codes found, try to parse from the revenue object structure
                            if (rentalIncome === 0 && adminIncome === 0 && monthRevenue > 0) {
                                // Fallback: check if there are any revenue entries
                                console.log(`🔍 Month ${month} revenue structure:`, monthData.revenue);
                                // For now, assume all revenue is rental income if we can't determine the type
                                rentalIncome = monthRevenue;
                            }
                            
                            // Debug: Log account breakdown for months with revenue
                            if (monthRevenue > 0) {
                                console.log(`📊 Month ${month} (${monthData.month}) Revenue Breakdown:`);
                                console.log(`  Total Revenue: $${monthRevenue.toFixed(2)}`);
                                console.log(`  Rental Income (4001): $${rentalIncome.toFixed(2)}`);
                                console.log(`  Admin Income (4002): $${adminIncome.toFixed(2)}`);
                                console.log(`  All Revenue Accounts:`, Object.keys(monthData.revenue).map(code => `${code}: $${monthData.revenue[code].toFixed(2)}`));
                            }
                        }
                        
                        monthlyData[month] = {
                            month: month,
                            monthName: monthData.month || new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            revenue: {
                                rentalIncome: rentalIncome,
                                adminIncome: adminIncome,
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
            
            // Use original balance sheet service (optimized balance sheet had calculation issues)
            const BalanceSheetService = require('../services/balanceSheetService');
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
            const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            // Transform the data to match the expected format while adding detailed breakdowns
            const monthlyBreakdown = {};
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            
            monthNames.forEach((month, index) => {
                const monthKey = `${period}-${String(index + 1).padStart(2, '0')}`;
                const monthData = detailedCashFlow.detailed_breakdown.monthly_breakdown[monthKey] || {
                    income: { total: 0, rental_income: 0, admin_fees: 0, deposits: 0, utilities: 0, other_income: 0 },
                    expenses: { total: 0, maintenance: 0, utilities: 0, cleaning: 0, security: 0, management: 0 },
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
                            advance_payments: { amount: monthData.income.advance_payments, description: 'Advance Payments from Students' },
                            other_income: { amount: monthData.income.other_income, description: 'Other Income Sources' },
                            // Detailed expense breakdown
                            maintenance_expenses: { amount: monthData.expenses.maintenance, description: 'Property Maintenance' },
                            utilities_expenses: { amount: monthData.expenses.utilities, description: 'Utility Bills' },
                            cleaning_expenses: { amount: monthData.expenses.cleaning, description: 'Cleaning Services' },
                            security_expenses: { amount: monthData.expenses.security, description: 'Security Services' },
                            management_expenses: { amount: monthData.expenses.management, description: 'Management Fees' },
                        }
                    },
                    // Add detailed income transactions
                    income: {
                        total: monthData.income.total,
                        rental_income: monthData.income.rental_income,
                        admin_fees: monthData.income.admin_fees,
                        deposits: monthData.income.deposits,
                        utilities: monthData.income.utilities,
                        advance_payments: monthData.income.advance_payments,
                        other_income: monthData.income.other_income,
                        transactions: monthData.income.transactions || [] // Include detailed income transactions
                    },
                    // Add detailed expense transactions
                    expenses: {
                        total: monthData.expenses.total,
                        maintenance: monthData.expenses.maintenance,
                        utilities: monthData.expenses.utilities,
                        cleaning: monthData.expenses.cleaning,
                        security: monthData.expenses.security,
                        management: monthData.expenses.management,
                        transactions: monthData.expenses.transactions || [] // Include detailed expense transactions
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
                    inflows: detailedCashFlow.detailed_breakdown.income.total || 0,
                    outflows: detailedCashFlow.detailed_breakdown.expenses.total || 0,
                    net: (detailedCashFlow.detailed_breakdown.income.total || 0) - (detailedCashFlow.detailed_breakdown.expenses.total || 0),
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
                average_monthly_cash_flow: (detailedCashFlow.summary.net_change_in_cash || 0) / 12,
                ending_cash_balance: runningBalance,
                // Additional detailed insights
                total_income: detailedCashFlow.detailed_breakdown.income.total || 0,
                total_expenses: detailedCashFlow.detailed_breakdown.expenses.total || 0,
                transaction_count: detailedCashFlow.summary.transaction_count || 0,
                payment_count: detailedCashFlow.summary.payment_count || 0,
                expense_count: detailedCashFlow.summary.expense_count || 0,
                // Income breakdown summary
                income_breakdown: detailedCashFlow.detailed_breakdown.income.by_source,
                // Expense breakdown summary
                expense_breakdown: detailedCashFlow.detailed_breakdown.expenses.by_category,
                // Advance payments summary
                advance_payments: detailedCashFlow.detailed_breakdown.income.advance_payments,
                // Residence breakdown
                residence_breakdown: {
                    income: detailedCashFlow.detailed_breakdown.income.by_residence,
                    expenses: detailedCashFlow.detailed_breakdown.expenses.by_residence
                }
            };
            
            // RESTRUCTURED: Monthly-focused response structure
            const enhancedCashFlowData = {
                period,
                basis,
                
                // PRIMARY: Monthly breakdown as main data
                monthly_breakdown: detailedCashFlow.monthly_breakdown,
                tabular_monthly_breakdown: detailedCashFlow.tabular_monthly_breakdown,
                
                // SECONDARY: Yearly totals derived from monthly data
                yearly_totals: detailedCashFlow.yearly_totals,
                
                // CASH FLOW SUMMARY (monthly-focused)
                cash_breakdown: detailedCashFlow.cash_breakdown,
                
                // MONTHLY-FOCUSED SUMMARY
                summary: {
                    best_cash_flow_month: detailedCashFlow.summary.best_cash_flow_month,
                    worst_cash_flow_month: detailedCashFlow.summary.worst_cash_flow_month,
                    average_monthly_cash_flow: detailedCashFlow.summary.average_monthly_cash_flow,
                    total_months_with_data: detailedCashFlow.summary.total_months_with_data,
                    monthly_consistency_score: detailedCashFlow.summary.monthly_consistency_score,
                    total_transactions: detailedCashFlow.summary.total_transactions,
                    net_change_in_cash: detailedCashFlow.summary.net_change_in_cash,
                    total_income: detailedCashFlow.summary.total_income,
                    total_expenses: detailedCashFlow.summary.total_expenses,
                    transaction_count: detailedCashFlow.summary.transaction_count,
                    payment_count: detailedCashFlow.summary.payment_count,
                    expense_count: detailedCashFlow.summary.expense_count
                },
                
                // FORMATTED STATEMENTS
                formatted_cash_flow_statement: detailedCashFlow.formatted_cash_flow_statement,
                tabular_cash_flow_statement: detailedCashFlow.tabular_cash_flow_statement,
                
                // DETAILED BREAKDOWN (monthly-focused)
                detailed_breakdown: {
                    income: detailedCashFlow.detailed_breakdown.income,
                    expenses: detailedCashFlow.detailed_breakdown.expenses,
                    individual_expenses: detailedCashFlow.detailed_breakdown.individual_expenses, // NEW: Individual expenses
                    transactions: detailedCashFlow.detailed_breakdown.transactions,
                    payments: detailedCashFlow.detailed_breakdown.payments,
                    expenses_detail: detailedCashFlow.detailed_breakdown.expenses_detail,
                    monthly_breakdown: detailedCashFlow.detailed_breakdown.monthly_breakdown
                },
                
                // ACTIVITIES BREAKDOWN
                operating_activities: detailedCashFlow.operating_activities,
                investing_activities: detailedCashFlow.investing_activities,
                financing_activities: detailedCashFlow.financing_activities,
                
                // CASH BALANCE BY ACCOUNT
                cash_balance_by_account: detailedCashFlow.cash_balance_by_account,
                
                // METADATA
                metadata: detailedCashFlow.metadata
            };
            
            res.json({
                success: true,
                data: enhancedCashFlowData,
                message: `Enhanced monthly cash flow with detailed breakdowns generated for ${period} (${basis} basis)${residence ? ` for residence: ${residence}` : ' (all residences)'}`
            });
            
        } catch (error) {
            console.error('Error generating enhanced monthly cash flow:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code
            });
            res.status(500).json({
                success: false,
                message: 'Error generating enhanced monthly cash flow',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
            
            // Use the FIXED balance sheet service that includes ALL accounts
            const FinancialReportingService = require('../services/financialReportingService');
            
            // Fetch balance sheet for each month (1-12)
            for (let month = 1; month <= 12; month++) {
                try {
                    // Calculate end of month date
                    const endOfMonth = new Date(year, month, 0); // Last day of month
                    const monthEndDateStr = endOfMonth.toISOString().split('T')[0];
                    
                    console.log(`🔧 Generating FIXED balance sheet for ${month}/${year} (${monthEndDateStr})`);
                    
                    // Use the fixed balance sheet service
                    const monthData = await FinancialReportingService.generateBalanceSheet(monthEndDateStr, basis);
                    
                    if (monthData) {
                        // Transform the fixed balance sheet data to match expected structure
                        const transformedData = transformFixedBalanceSheetToMonthly(monthData, month, year);
                        
                        monthlyData[month] = transformedData;
                        
                        totalAnnualAssets += monthData.assets?.total_assets || 0;
                        totalAnnualLiabilities += monthData.liabilities?.total_liabilities || 0;
                        totalAnnualEquity += monthData.equity?.total_equity || 0;
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
            
            // Use EnhancedCashFlowService which properly handles residence filtering at the database level
            const detailedCashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            res.json({
                success: true,
                data: detailedCashFlowStatement,
                message: `Enhanced monthly cash flow with detailed breakdowns generated for ${period} (${basis} basis)${residence ? ` (residence: ${residence})` : ' (all residences)'}`
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
            
            // Use EnhancedCashFlowService for better residence filtering
            const cashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
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
     * Generate Simple Monthly Balance Sheet
     * GET /api/financial-reports/simple-monthly-balance-sheet
     * 
     * A clean, simple balance sheet that follows proper accounting principles:
     * - Assets = Liabilities + Equity
     * - Proper parent-child account aggregation
     * - Monthly balance tracking
     * - Works seamlessly with the frontend
     */
    static async generateSimpleMonthlyBalanceSheet(req, res) {
        try {
            const { period, residence, type = 'cumulative' } = req.query;
            
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2025)'
                });
            }
            
            if (!['cumulative', 'monthly'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Type must be either "cumulative" (balance as of month end) or "monthly" (monthly changes)'
                });
            }
            
            console.log(`🚀 Generating Simple Monthly Balance Sheet for ${period}${residence ? ` (residence: ${residence})` : ''} (${type})`);
            const startTime = Date.now();
            
            // Use the simple balance sheet service
            const monthlyBalanceSheet = await SimpleBalanceSheetService.generateMonthlyBalanceSheet(
                parseInt(period), 
                residence, 
                type
            );
            
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            console.log(`✅ Simple balance sheet generation completed in ${duration.toFixed(2)} seconds`);
            
            // Add performance metrics
            monthlyBalanceSheet.performance = {
                generationTime: duration,
                timestamp: new Date().toISOString(),
                service: 'SimpleBalanceSheetService',
                type: type
            };
            
            // Add cache-busting headers
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.json({
                success: true,
                data: monthlyBalanceSheet,
                message: `Simple monthly balance sheet generated for ${period}${residence ? ` (residence: ${residence})` : ''} (${type} type)`
            });
            
        } catch (error) {
            console.error('Error generating simple monthly balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating simple monthly balance sheet',
                error: error.message
            });
        }
    }

}

module.exports = FinancialReportsController; 