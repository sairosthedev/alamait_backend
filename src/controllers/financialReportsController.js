const mongoose = require('mongoose');
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

    // Helper function to convert account name to camelCase key
    const toCamelCase = (str) => {
        return str
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word, index) => {
                if (index === 0) {
                    return word.toLowerCase();
                }
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join('')
            .replace(/[^a-zA-Z0-9]/g, '');
    };
    
    // Process ALL liabilities with parent-child aggregation
    // Define accounts that are already included in specific sections to avoid duplication
    const specificLiabilityAccountCodes = ['2000', '2020', '2200'];
    const BalanceSheetService = require('../services/balanceSheetService');
    
    const currentLiabilities = {};
    const nonCurrentLiabilities = {};
    
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
            
            // Check if this is a current or non-current liability
            const isCurrent = BalanceSheetService.isCurrentLiability(account.code, account.name);
            
            // Create clean camelCase key from account name (like accountsPayable, tenantDeposits, deferredIncome)
            const cleanKey = toCamelCase(account.name || `account_${account.code}`);
            
            const liabilityData = {
                amount: account.balance || 0,
                accountCode: account.code,
                accountName: account.name
            };
            
            if (isCurrent) {
                currentLiabilities[cleanKey] = liabilityData;
            } else {
                nonCurrentLiabilities[cleanKey] = liabilityData;
            }
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
                },
                ...currentLiabilities
            },
            nonCurrent: nonCurrentLiabilities,
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
            console.log(`🏠 Residence parameter: ${residence ? residence : 'NOT PROVIDED'}`);
            console.log(`📊 Type parameter: ${type}`);
            console.log(`💰 Basis parameter: ${basis}`);
            console.log(`🔍 Full query parameters:`, req.query);
            const startTime = Date.now();
            
            // Set a timeout promise to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Balance sheet generation timed out after 4 minutes'));
                }, 240000); // 4 minutes timeout (increased to allow parallel processing)
            });
            
            // Always use BalanceSheetService with flexible residence filtering
            // The service now handles both filtered and unfiltered requests
            const BalanceSheetService = require('../services/balanceSheetService');
            const numericPeriod = parseInt(period, 10);
            
            // Resolve residence to ObjectId if needed
            let resolvedResidence = null;
            if (residence) {
                if (mongoose.Types.ObjectId.isValid(residence)) {
                    resolvedResidence = new mongoose.Types.ObjectId(residence);
                } else {
                    const Residence = require('../models/Residence');
                    const residenceDoc = await Residence.findOne({ name: { $regex: new RegExp(residence, 'i') } }).select('_id name');
                    if (!residenceDoc) {
                        return res.status(404).json({
                            success: false,
                            message: `Residence not found: ${residence}`
                        });
                    }
                    resolvedResidence = residenceDoc._id;
                    console.log(`🏠 Resolved residence name "${residence}" to id ${resolvedResidence} (${residenceDoc.name})`);
                }
            }
            
            console.log(`✅ Using BalanceSheetService for ${resolvedResidence ? `residence: ${resolvedResidence}` : 'all residences'}`);
            const balanceSheetPromise = BalanceSheetService.generateMonthlyBalanceSheet(
                numericPeriod, 
                resolvedResidence ? resolvedResidence.toString() : null, 
                type
            );
            
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
            
            
            // Add cache-busting headers to prevent 304 responses
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
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
            
            // Check cache first
            const { cache } = require('../utils/cache');
            const cacheKey = `cashflow:${period}:${basis}:${residence || 'all'}`;
            const cached = cache.get(cacheKey);
            if (cached) {
                const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
                if (isDebugMode) {
                    console.log('✅ Returning cached cash flow data');
                }
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    message: `Cached cash flow data for ${period} (${basis} basis)${residence ? ` for residence: ${residence}` : ' (all residences)'}`
                });
            }
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            
            // Use the Enhanced Cash Flow Service for detailed breakdowns
            const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            // Transform the data to match the expected format while adding detailed breakdowns
            const monthlyBreakdown = {};
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            
            monthNames.forEach((month, index) => {
                const monthKey = `${period}-${String(index + 1).padStart(2, '0')}`;
                const monthData = detailedCashFlow.detailed_breakdown.monthly_breakdown[monthKey] || {
                    income: { total: 0, rental_income: 0, admin_fees: 0, deposits: 0, utilities: 0, advance_payments: 0 },
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
                    outflows: detailedCashFlow.detailed_breakdown.expenses.total_amount || 0,
                    net: (detailedCashFlow.detailed_breakdown.income.total || 0) - (detailedCashFlow.detailed_breakdown.expenses.total_amount || 0),
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
                        // Expense breakdown - Updated to use expenses_by_category
                        maintenance_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.maintenance.total, 
                            description: 'Total Maintenance Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.maintenance.transactions.length
                        },
                        utilities_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.utilities.total, 
                            description: 'Total Utility Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.utilities.transactions.length
                        },
                        cleaning_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.cleaning.total, 
                            description: 'Total Cleaning Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.cleaning.transactions.length
                        },
                        security_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.security.total, 
                            description: 'Total Security Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.security.transactions.length
                        },
                        management_expenses: { 
                            amount: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.management.total, 
                            description: 'Total Management Expenses',
                            transactions: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category.management.transactions.length
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
                total_expenses: detailedCashFlow.detailed_breakdown.expenses.total_amount || 0,
                transaction_count: detailedCashFlow.summary.transaction_count || 0,
                payment_count: detailedCashFlow.summary.payment_count || 0,
                expense_count: detailedCashFlow.summary.expense_count || 0,
                // Income breakdown summary
                income_breakdown: detailedCashFlow.detailed_breakdown.income.by_source,
                // Expense breakdown summary
                expense_breakdown: detailedCashFlow.detailed_breakdown.expenses_by_category.by_category,
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
            
            // Cache the result for 5 minutes (300000ms) - reuse cache from above
            cache.set(cacheKey, enhancedCashFlowData, 300000);
            if (isDebugMode) {
                console.log('✅ Cash flow data cached for 5 minutes');
            }
            
            res.json({
                success: true,
                data: enhancedCashFlowData,
                cached: false,
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
            
            // Check cache first (unless bypassCache is true)
            const { cache } = require('../utils/cache');
            const cacheKey = `balancesheet:${period}:${basis}:${residence || 'all'}`;
            const bypassCache = req.query.bypassCache === 'true' || req.query.bypassCache === '1';
            
            if (!bypassCache) {
            const cached = cache.get(cacheKey);
            if (cached) {
                console.log('✅ Returning cached balance sheet data');
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                        message: `Cached balance sheet data for ${period} (${basis} basis)${residence ? ` for residence: ${residence}` : ' (all residences)'}. Add ?bypassCache=true to force refresh.`
                });
                }
            } else {
                console.log('🔄 Bypassing cache - generating fresh balance sheet data');
                cache.delete(cacheKey); // Clear the cache
            }
            
            const year = parseInt(period);
            const monthlyData = {};
            let totalAnnualAssets = 0;
            let totalAnnualLiabilities = 0;
            let totalAnnualEquity = 0;
            
            // Use the FIXED balance sheet service that includes ALL accounts
            const FinancialReportingService = require('../services/financialReportingService');
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            
            // Fetch balance sheet for each month (1-12) - can be parallelized for better performance
            const monthPromises = [];
            for (let month = 1; month <= 12; month++) {
                monthPromises.push((async () => {
                try {
                    // Calculate end of month date using UTC to avoid timezone issues
                    // Date.UTC(year, month, 0) gives us the last day of the previous month (which is the last day of the target month)
                    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
                    const monthEndDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                    
                    console.log(`🔧 Generating FIXED balance sheet for ${month}/${year} (${monthEndDateStr})`);
                    
                    // Use the residence-filtered balance sheet service when residence is provided
                    let monthData;
                    if (residence) {
                        // Use residence-filtered method
                        const residenceFilteredData = await FinancialReportingService.generateResidenceFilteredMonthlyBalanceSheet(
                            period, residence, basis
                        );
                        // Extract the specific month data
                        if (residenceFilteredData.data && residenceFilteredData.data.monthly) {
                            const monthKey = (month - 1).toString(); // Convert to 0-based index
                            const monthBreakdown = residenceFilteredData.data.monthly[monthKey];
                            if (monthBreakdown) {
                                // Transform the residence-filtered data to match the expected structure
                                monthData = transformResidenceFilteredToFixed(monthBreakdown, month, year);
                            }
                        }
                    } else {
                        // Use the original fixed balance sheet service
                        try {
                        monthData = await FinancialReportingService.generateBalanceSheet(monthEndDateStr, basis);
                            if (!monthData) {
                                console.log(`⚠️ generateBalanceSheet returned null/undefined for ${monthEndDateStr}`);
                            } else {
                                console.log(`✅ generateBalanceSheet returned data for ${monthEndDateStr}:`, {
                                    hasAssets: !!monthData.assets,
                                    hasLiabilities: !!monthData.liabilities,
                                    hasEquity: !!monthData.equity,
                                    totalAssets: monthData.assets?.total_assets,
                                    totalLiabilities: monthData.liabilities?.total_liabilities,
                                    totalEquity: monthData.equity?.total_equity
                                });
                            }
                        } catch (balanceSheetError) {
                            console.error(`❌ Error generating balance sheet for ${monthEndDateStr}:`, balanceSheetError);
                            console.error(`   Stack:`, balanceSheetError.stack);
                            monthData = null;
                        }
                    }
                    
                    if (monthData) {
                        // Transform the fixed balance sheet data to match expected structure
                        const transformedData = transformFixedBalanceSheetToMonthly(monthData, month, year);
                        
                        return {
                            month,
                            data: transformedData,
                            totals: {
                                assets: monthData.assets?.total_assets || 0,
                                liabilities: monthData.liabilities?.total_liabilities || 0,
                                equity: monthData.equity?.total_equity || 0
                            }
                        };
                    }
                    return {
                        month,
                        data: {
                            month: month,
                            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            assets: { total: 0, current: { cashAndBank: { total: 0 }, accountsReceivable: { amount: 0 } } },
                            liabilities: { total: 0, current: { accountsPayable: { amount: 0 }, tenantDeposits: { amount: 0 } } },
                            equity: { total: 0, retainedEarnings: { amount: 0 } },
                            balanceCheck: 'No data',
                            summary: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }
                        },
                        totals: { assets: 0, liabilities: 0, equity: 0 }
                    };
                } catch (monthError) {
                    if (isDebugMode) {
                        console.log(`⚠️ Failed to fetch month ${month}:`, monthError.message);
                    }
                    return {
                        month,
                        data: {
                            month: month,
                            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
                            assets: { total: 0, current: { cashAndBank: { total: 0 }, accountsReceivable: { amount: 0 } } },
                            liabilities: { total: 0, current: { accountsPayable: { amount: 0 }, tenantDeposits: { amount: 0 } } },
                            equity: { total: 0, retainedEarnings: { amount: 0 } },
                            balanceCheck: 'No data',
                            summary: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }
                        },
                        totals: { assets: 0, liabilities: 0, equity: 0 }
                    };
                }
                })());
            }
            
            // Wait for all months to complete in parallel
            const monthResults = await Promise.all(monthPromises);
            
            // Process results
            monthResults.forEach(result => {
                monthlyData[result.month] = result.data;
                totalAnnualAssets += result.totals.assets;
                totalAnnualLiabilities += result.totals.liabilities;
                totalAnnualEquity += result.totals.equity;
            });
            
            const result = {
                monthly: monthlyData,
                annualSummary: {
                    totalAnnualAssets: totalAnnualAssets / 12, // Average monthly
                    totalAnnualLiabilities: totalAnnualLiabilities / 12, // Average monthly
                    totalAnnualEquity: totalAnnualEquity / 12 // Average monthly
                }
            };
            
            // Cache the result for 5 minutes (300000ms)
            cache.set(cacheKey, result, 300000);
            if (isDebugMode) {
                console.log('✅ Balance sheet data cached for 5 minutes');
            }
            
            res.json({
                success: true,
                data: result,
                cached: false,
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
            
            // Check cache first
            const { cache } = require('../utils/cache');
            const cacheKey = `cashflow-statement:${period}:${basis}:${residence || 'all'}`;
            const cached = cache.get(cacheKey);
            if (cached) {
                const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
                if (isDebugMode) {
                    console.log('✅ Returning cached cash flow statement data');
                }
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    message: `Cached cash flow statement for ${period}${residence ? ` (residence: ${residence})` : ''} (${basis} basis)`
                });
            }
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            
            let cashFlowStatement;
            if (residence) {
                // Use enhanced cash flow service with residence filtering
                const EnhancedCashFlowService = require('../services/enhancedCashFlowService');
                cashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            } else {
                // Use enhanced cash flow service without residence filter
                const EnhancedCashFlowService = require('../services/enhancedCashFlowService');
                cashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, null);
            }
            
            // Cache the result for 5 minutes (300000ms)
            cache.set(cacheKey, cashFlowStatement, 300000);
            if (isDebugMode) {
                console.log('✅ Cash flow statement data cached for 5 minutes');
            }
            
            res.json({
                success: true,
                data: cashFlowStatement,
                cached: false,
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
            
            // Check cache first
            const { cache } = require('../utils/cache');
            const cacheKey = `detailed-cashflow:${period}:${basis}:${residence || 'all'}`;
            const cached = cache.get(cacheKey);
            if (cached) {
                const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
                if (isDebugMode) {
                    console.log('✅ Returning cached detailed cash flow statement data');
                }
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    message: `Cached detailed cash flow statement for ${period} (${basis} basis)${residence ? ` (residence: ${residence})` : ' (all residences)'}`
                });
            }
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            
            // Use EnhancedCashFlowService which properly handles residence filtering at the database level
            const detailedCashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            // Cache the result for 5 minutes (300000ms)
            cache.set(cacheKey, detailedCashFlowStatement, 300000);
            if (isDebugMode) {
                console.log('✅ Detailed cash flow statement data cached for 5 minutes');
            }
            
            res.json({
                success: true,
                data: detailedCashFlowStatement,
                cached: false,
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
            
            // Check cache first
            const { cache } = require('../utils/cache');
            const cacheKey = `residence-cashflow:${period}:${basis}:${residence}`;
            const cached = cache.get(cacheKey);
            if (cached) {
                const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
                if (isDebugMode) {
                    console.log('✅ Returning cached residence-filtered cash flow statement data');
                }
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    message: `Cached residence-filtered cash flow statement for ${period} (${basis} basis) - Residence: ${residence}`
                });
            }
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            
            if (!['cash', 'accrual'].includes(basis)) {
                return res.status(400).json({
                    success: false,
                    message: 'Basis must be either "cash" or "accrual"'
                });
            }
            
            // Use EnhancedCashFlowService for better residence filtering
            const EnhancedCashFlowService = require('../services/enhancedCashFlowService');
            const cashFlowStatement = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis, residence);
            
            // Cache the result for 5 minutes (300000ms)
            cache.set(cacheKey, cashFlowStatement, 300000);
            if (isDebugMode) {
                console.log('✅ Residence-filtered cash flow statement data cached for 5 minutes');
            }
            
            res.json({
                success: true,
                data: cashFlowStatement,
                cached: false,
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

    /**
     * Get account details for cash flow report
     * GET /api/financial-reports/cash-flow/account-details?period=2025&month=october&accountCode=4001
     */
    static async getCashFlowAccountDetails(req, res) {
        try {
            const { period, month, accountCode, residenceId } = req.query;
            
            console.log(`📊 Getting cash flow account details for account ${accountCode} in ${month} ${period}${residenceId ? ` (residence: ${residenceId})` : ''}`);
            
            if (!period || !accountCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Period and accountCode are required'
                });
            }
            
            // Get the account details
            // For deposits, fetch all deposit accounts
            let account = null;
            let depositAccounts = [];
            const depositAccountCodes = ['2201', '2020', '20002', '2002', '2028', '20020'];
            
            if (depositAccountCodes.includes(accountCode)) {
                // Fetch all deposit accounts
                depositAccounts = await Account.find({
                    $or: [
                        { code: { $in: depositAccountCodes } },
                        { 
                            type: 'Liability',
                            $or: [
                                { name: /deposit/i },
                                { name: /security deposit/i },
                                { name: /tenant deposit/i }
                            ]
                        }
                    ]
                });
                
                // Use the requested account code as primary, or first found
                account = depositAccounts.find(acc => acc.code === accountCode) || depositAccounts[0];
                
                if (!account || depositAccounts.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Deposit account not found'
                    });
                }
            } else {
                // Special handling for virtual income accounts
                if (accountCode === 'other_income' || accountCode === '4006') {
                    // Create a virtual account object for other_income
                    account = {
                        code: accountCode === 'other_income' ? '4006' : accountCode,
                        name: 'Other Income',
                        type: 'Income',
                        category: 'Income',
                        isVirtual: true
                    };
                } else if (accountCode === '4003') {
                    // Account code 4003 is used for deposits in cashflow (virtual account)
                    // Create a virtual account object for deposits
                    account = {
                        code: '4003',
                        name: 'Deposits Income',
                        type: 'Income',
                        category: 'Income',
                        isVirtual: true
                    };
                } else {
                    account = await Account.findOne({ code: accountCode });
                    if (!account) {
                        return res.status(404).json({
                            success: false,
                            message: 'Account not found'
                        });
                    }
                }
            }
            
            // Generate cash flow data for the specific account
            // IMPORTANT: Pass residenceId to match the filtered cash flow statement
            let cashFlowData = null;
            let accountData = null;
            
            try {
                cashFlowData = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, 'cash', residenceId);
                
                // Find the account in the cash flow data
                // Search in income section (check both individual accounts and aggregated data)
                if (cashFlowData.income && cashFlowData.income[accountCode]) {
                    accountData = {
                        ...cashFlowData.income[accountCode],
                        type: 'income',
                        category: 'income'
                    };
                } else if (account.type === 'Income' && cashFlowData.monthly_breakdown) {
                    // For income accounts, check if they're part of aggregated income
                    const monthlyBreakdown = cashFlowData.monthly_breakdown;
                    
                    // If month is specified, get data for that specific month
                    // Cash flow service uses lowercase month names (e.g., "november"), not "2025-11"
                    let targetMonthKey = null;
                    if (month && period) {
                        targetMonthKey = month.toLowerCase(); // e.g., "november"
                    }
                    
                    // Check the specific month if provided, otherwise check all months
                    const monthsToCheck = targetMonthKey ? [targetMonthKey] : Object.keys(monthlyBreakdown);
                    
                    // Sum across all months if no specific month is requested
                    let totalRentalIncome = 0;
                    let totalAdminFees = 0;
                    let totalDeposits = 0;
                    let totalOtherIncome = 0;
                    
                    for (const monthKey of monthsToCheck) {
                        const monthData = monthlyBreakdown[monthKey];
                        if (monthData && monthData.income) {
                            const incomeData = monthData.income;
                            
                            // Sum income across all months
                            if (accountCode === '4001' && incomeData.rental_income) {
                                totalRentalIncome += incomeData.rental_income || 0;
                            } else if (accountCode === '4002' && incomeData.admin_fees) {
                                totalAdminFees += incomeData.admin_fees || 0;
                            } else if (accountCode === '4003' && incomeData.deposits) {
                                totalDeposits += incomeData.deposits || 0;
                            } else if ((accountCode === '4006' || accountCode === 'other_income') && incomeData.other_income) {
                                // Support for other income (account code 4006 or virtual 'other_income')
                                totalOtherIncome += incomeData.other_income || 0;
                            }
                        }
                    }
                    
                    // Set accountData based on account code (even if total is 0, to match cash flow statement)
                    if (accountCode === '4001') {
                                accountData = {
                            totalCredit: totalRentalIncome,
                                    totalDebit: 0,
                            netAmount: totalRentalIncome,
                                    transactionCount: 0, // Will be calculated from transactions
                                    type: 'income',
                            category: 'income'
                                };
                    } else if (accountCode === '4002') {
                                accountData = {
                            totalCredit: totalAdminFees,
                                    totalDebit: 0,
                            netAmount: totalAdminFees,
                                    transactionCount: 0,
                                    type: 'income',
                            category: 'income'
                                };
                    } else if (accountCode === '4003') {
                                accountData = {
                            totalCredit: totalDeposits,
                                    totalDebit: 0,
                            netAmount: totalDeposits,
                                    transactionCount: 0,
                                    type: 'income',
                            category: 'income'
                        };
                    } else if (accountCode === '4006' || accountCode === 'other_income') {
                                accountData = {
                            totalCredit: totalOtherIncome,
                                    totalDebit: 0,
                            netAmount: totalOtherIncome,
                                    transactionCount: 0,
                                    type: 'income',
                            category: 'income'
                        };
                    }
                }
                
                // Search in expenses section - check monthly breakdown for expense categories
                if (!accountData && account.type === 'Expense' && cashFlowData.monthly_breakdown) {
                    const monthlyBreakdown = cashFlowData.monthly_breakdown;
                    
                    // If month is specified, get data for that specific month
                    let targetMonthKey = null;
                    if (month && period) {
                        targetMonthKey = month.toLowerCase(); // e.g., "november"
                    }
                    
                    // Check the specific month if provided, otherwise check all months
                    const monthsToCheck = targetMonthKey ? [targetMonthKey] : Object.keys(monthlyBreakdown);
                    
                    // Map expense account codes to cash flow service expense categories
                    const expenseCategoryMap = {
                        // Map account codes/names to expense categories used by cash flow service
                        '5001': 'maintenance',
                        '5002': 'cleaning',
                        '5003': 'electricity',
                        '5004': 'water',
                        '5005': 'gas',
                        '5006': 'internet',
                        '5007': 'security',
                        '5008': 'management',
                        '5012': 'insurance',
                        // Add more mappings as needed
                    };
                    
                    // Also check by account name keywords
                    const accountNameLower = (account.name || '').toLowerCase();
                    let expenseCategory = null;
                    
                    if (accountNameLower.includes('council') || accountNameLower.includes('rates')) {
                        expenseCategory = 'council_rates';
                    } else if (accountNameLower.includes('maintenance')) {
                        expenseCategory = 'maintenance';
                    } else if (accountNameLower.includes('cleaning')) {
                        expenseCategory = 'cleaning';
                    } else if (accountNameLower.includes('electricity')) {
                        expenseCategory = 'electricity';
                    } else if (accountNameLower.includes('water')) {
                        expenseCategory = 'water';
                    } else if (accountNameLower.includes('gas')) {
                        expenseCategory = 'gas';
                    } else if (accountNameLower.includes('internet') || accountNameLower.includes('wifi')) {
                        expenseCategory = 'internet';
                    } else if (accountNameLower.includes('security')) {
                        expenseCategory = 'security';
                    } else if (accountNameLower.includes('management')) {
                        expenseCategory = 'management';
                    } else if (accountNameLower.includes('insurance')) {
                        expenseCategory = 'insurance';
                    } else if (accountNameLower.includes('plumbing')) {
                        expenseCategory = 'plumbing';
                    } else if (accountNameLower.includes('sanitary')) {
                        expenseCategory = 'sanitary';
                    } else if (accountNameLower.includes('solar')) {
                        expenseCategory = 'solar';
                    } else {
                        // Try account code mapping
                        expenseCategory = expenseCategoryMap[accountCode];
                    }
                    
                    // If we found a category, get the amount from monthly breakdown
                    // Prioritize operating_activities.breakdown (what cash flow statement uses)
                    if (expenseCategory) {
                        let totalExpense = 0;
                        for (const monthKey of monthsToCheck) {
                            const monthData = monthlyBreakdown[monthKey];
                            if (monthData) {
                                // Check operating_activities.breakdown first (cash flow service uses this for display)
                                if (monthData.operating_activities && monthData.operating_activities.breakdown) {
                                    const breakdownValue = monthData.operating_activities.breakdown[expenseCategory];
                                    if (breakdownValue !== undefined && breakdownValue !== null) {
                                        totalExpense += breakdownValue || 0;
                                    }
                                }
                                // Fallback to expenses object if breakdown doesn't have it
                                else if (monthData.expenses && monthData.expenses[expenseCategory] !== undefined) {
                                    totalExpense += monthData.expenses[expenseCategory] || 0;
                                }
                            }
                        }
                        
                        // Always set accountData if we found a category (even if total is 0, to match cash flow statement)
                        accountData = {
                            totalDebit: totalExpense,
                            totalCredit: 0,
                            netAmount: totalExpense,
                            transactionCount: 0, // Will be calculated from transactions
                            type: 'expense',
                            category: 'expense'
                        };
                    }
                }
                
                // Also check direct expenses object (fallback)
                if (!accountData && cashFlowData.expenses && cashFlowData.expenses[accountCode]) {
                    accountData = {
                        ...cashFlowData.expenses[accountCode],
                        type: 'expense',
                        category: 'expense'
                    };
                }
                
                // Search in cash flow section
                if (!accountData && cashFlowData.cashFlow && cashFlowData.cashFlow[accountCode]) {
                    accountData = {
                        ...cashFlowData.cashFlow[accountCode],
                        type: 'cash_flow',
                        category: 'cash_flow'
                    };
                }
            } catch (error) {
                console.log('⚠️ Cash flow service error, using fallback method:', error.message);
                
                // Fallback: Calculate account data from transactions directly
                const TransactionEntry = require('../models/TransactionEntry');
                const query = {
                    'entries.accountCode': accountCode,
                    status: { $nin: ['reversed', 'draft'] }
                };
                
                // Add date filter if period is specified
                if (period && period.length === 4) {
                    // Year filter
                    const startDate = new Date(`${period}-01-01`);
                    const endDate = new Date(`${period}-12-31`);
                    query.date = { $gte: startDate, $lte: endDate };
                } else if (period && period.includes('-')) {
                    // Month filter (YYYY-MM)
                    const startDate = new Date(`${period}-01`);
                    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                    query.date = { $gte: startDate, $lte: endDate };
                }
                
                const accountTransactions = await TransactionEntry.find(query);
                
                // Calculate totals
                let totalDebit = 0;
                let totalCredit = 0;
                
                accountTransactions.forEach(transaction => {
                    const accountEntry = transaction.entries.find(entry => entry.accountCode === accountCode);
                    if (accountEntry) {
                        totalDebit += accountEntry.debit || 0;
                        totalCredit += accountEntry.credit || 0;
                    }
                });
                
                // Create fallback account data
                accountData = {
                    totalDebit,
                    totalCredit,
                    netAmount: totalDebit - totalCredit,
                    transactionCount: accountTransactions.length,
                    type: account.type === 'Income' ? 'income' : account.type === 'Expense' ? 'expense' : 'cash_flow',
                    category: account.type === 'Income' ? 'income' : account.type === 'Expense' ? 'expense' : 'cash_flow'
                };
            }
            
            // For all accounts, if accountData is not found in cashFlowData, create a placeholder
            // We'll calculate the actual data from transactions
            // This ensures all accounts work, not just those found in cash flow data
            if (!accountData) {
                accountData = {
                    totalDebit: 0,
                    totalCredit: 0,
                    netAmount: 0,
                    transactionCount: 0,
                    type: depositAccountCodes.includes(accountCode) ? 'deposit' : 
                          account.type === 'Income' ? 'income' : 
                          account.type === 'Expense' ? 'expense' : 'cash_flow',
                    category: account.category || account.type || 'Other'
                };
            }
            
            // Get detailed transactions for this account
            const TransactionEntry = require('../models/TransactionEntry');
            
            let query = {};
            
            // For income accounts, we need to show:
            // 1. Payment transactions (cash received) - these have cash (1000) and AR (1100-...)
            // 2. Accrual transactions (income earned) - these have the income account code (4001) directly
            if (account.type === 'Income') {
                // For cash flow account details, query payment transactions (cash received)
                // Match the same sources as the cash flow service uses
                // Special handling for other_income - fetch ALL payment transactions (will filter by description)
                if (accountCode === '4006' || accountCode === 'other_income') {
                    // For other_income, fetch ONLY transactions that debit cash account (1000) and credit debtors
                    // Uses cash account code 1000 (regex ^100), NOT account code 4003
                    // This includes: DR Cash CR Debtor (council payments, etc.)
                    query = {
                        $or: [
                            {
                                // Any transaction with cash account debit (cash received) - account code 1000 series
                                // Regex ^100 matches 1000, 1001, etc. but NOT 4003
                                'entries.accountCode': { $regex: '^100' }, // Cash account entry (1000, 1001, etc.) - NOT 4003
                                'entries.debit': { $gt: 0 }, // Cash is debited (money coming in)
                                source: { 
                                    $in: [
                                        'payment', 
                                        'expense_payment', 
                                        'rental_payment', 
                                        'manual', 
                                        'payment_collection', 
                                        'bank_transfer', 
                                        'advance_payment', 
                                        'debt_settlement', 
                                        'current_payment',
                                        'accounts_receivable_collection',
                                        'payment_allocation'
                                    ] 
                                }
                            },
                            {
                                // Manual transactions with cash debit (DR Cash CR Debtor, etc.)
                                source: 'manual',
                                'entries.accountCode': { $regex: '^100' }, // Cash account entry (1000) - NOT 4003
                                'entries.debit': { $gt: 0 } // Cash is debited
                            }
                        ],
                        status: { $nin: ['reversed', 'draft'] }
                    };
                } else if (accountCode === '4003') {
                    // For deposits (4003), fetch cash receipt transactions (DR Cash CR Debtor)
                    // These are the actual cash receipts, not the accounting entries that credit account 4003
                    query = {
                        $or: [
                            {
                                // Cash debit transactions (cash received) - DR Cash CR Debtor pattern
                                'entries.accountCode': { $regex: '^100' }, // Has cash account entry (1000, 1001, etc.)
                                'entries.debit': { $gt: 0 }, // Cash is debited (money coming in)
                                source: { 
                                    $in: [
                                        'payment', 
                                        'expense_payment', 
                                        'rental_payment', 
                                        'manual', 
                                        'payment_collection', 
                                        'bank_transfer', 
                                        'advance_payment', 
                                        'debt_settlement', 
                                        'current_payment',
                                        'accounts_receivable_collection',
                                        'payment_allocation'
                                    ] 
                                }
                            },
                            {
                                // Manual transactions with cash debit (DR Cash CR Debtor, etc.)
                                source: 'manual',
                                'entries.accountCode': { $regex: '^100' }, // Has cash account entry
                                'entries.debit': { $gt: 0 } // Cash is debited
                            }
                        ],
                        status: { $nin: ['reversed', 'draft'] }
                    };
                } else {
                    // For other income accounts (rental, admin), use standard query
                    query = {
                        $or: [
                            {
                                // Payment transactions: cash received (match cash flow service sources)
                                'entries.accountCode': { $regex: '^1000' }, // Has cash account entry
                                source: { 
                                    $in: [
                                        'payment', 
                                        'expense_payment', 
                                        'rental_payment', 
                                        'manual', 
                                        'payment_collection', 
                                        'bank_transfer', 
                                        'advance_payment', 
                                        'debt_settlement', 
                                        'current_payment',
                                        'accounts_receivable_collection'
                                    ] 
                                }
                            },
                            {
                                // Accrual transactions: income earned (lease start, monthly accruals)
                                // Note: These will be filtered out later for cash flow, but included here for query completeness
                                'entries.accountCode': accountCode, // Has the income account code directly
                                source: { $in: ['rental_accrual', 'expense_accrual'] }
                            }
                        ],
                        status: { $nin: ['reversed', 'draft'] }
                    };
                }
            } else if (account.type === 'Expense') {
                // For expense accounts, show ONLY transactions that have the specific expense account code
                // Each expense account should only show its own transactions, not other expense accounts
                // Exception: For account 50005 (Alamait Management fee), also include liability account payments (20101) with matching descriptions
                if (accountCode === '50005') {
                    query = {
                        $or: [
                            { 'entries.accountCode': accountCode }, // Direct expense account entries
                            {
                                // Payments to liability accounts categorized as this expense (e.g., 20101 for management fees)
                                'entries.accountCode': { $regex: '^2' }, // Liability account (e.g., 20101)
                                'entries.type': 'debit', // Payment to reduce liability
                                'entries.description': { $regex: /(management|alamait|alaimait)/i }, // Matching description
                                'entries.accountCode': { $ne: '2028' } // Exclude security deposits
                            }
                        ],
                        status: { $nin: ['reversed', 'draft'] }
                    };
                } else {
                    // For all other expense accounts, ONLY include transactions with the specific account code
                    query = {
                        'entries.accountCode': accountCode, // Direct expense account entries ONLY
                        status: { $nin: ['reversed', 'draft'] }
                    };
                }
            } else if (depositAccountCodes.includes(accountCode)) {
                // For deposit accounts, show payment transactions with cash and deposits
                // Include all deposit account codes and payment transactions with deposits
                const allDepositCodes = depositAccounts.length > 0 
                    ? depositAccounts.map(acc => acc.code)
                    : depositAccountCodes;
                
                query = {
                    $or: [
                        { 'entries.accountCode': { $in: allDepositCodes } }, // All deposit account entries
                        {
                            'entries.accountCode': { $regex: '^1000' }, // Payment transactions with cash
                            source: { $in: ['payment', 'accounts_receivable_collection'] },
                            description: { $regex: /deposit|security/i }
                        }
                    ],
                    status: { $nin: ['reversed', 'draft'] }
                };
            } else {
                // For non-income accounts, query by account code directly
                query = {
                'entries.accountCode': accountCode,
                status: { $nin: ['reversed', 'draft'] }
            };
            }
            
            // Add date filter - use transaction date (same as cash flow service)
            // For cash flow, we use transaction date, not allocation month
            if (period && period.length === 4) {
                // Year filter
                if (month) {
                    // Month name provided (e.g., "october")
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthIndex = monthNames.indexOf(month.toLowerCase());
                    if (monthIndex !== -1) {
                        // Specific month within the year - use transaction date
                        const startDate = new Date(parseInt(period), monthIndex, 1);
                        const endDate = new Date(parseInt(period), monthIndex + 1, 0, 23, 59, 59, 999); // Last day of the month
                        query.date = { $gte: startDate, $lte: endDate };
                    } else {
                        // Year only
                        const startDate = new Date(`${period}-01-01`);
                        const endDate = new Date(`${period}-12-31`);
                        query.date = { $gte: startDate, $lte: endDate };
                    }
                } else {
                    // Year only
                    const startDate = new Date(`${period}-01-01`);
                    const endDate = new Date(`${period}-12-31`);
                    query.date = { $gte: startDate, $lte: endDate };
                }
            } else if (period && period.includes('-')) {
                // Month filter (YYYY-MM)
                const startDate = new Date(`${period}-01`);
                const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
                query.date = { $gte: startDate, $lte: endDate };
            }
            
            // Add residence filtering if specified (same as cash flow service)
            if (residenceId) {
                const mongoose = require('mongoose');
                const residenceObjectId = mongoose.Types.ObjectId.isValid(residenceId) 
                    ? new mongoose.Types.ObjectId(residenceId) 
                    : residenceId;
                
                // Build residence filter (same as cash flow service)
                const residenceFilter = {
                    residence: residenceObjectId
                };
                
                // If query has $or, wrap both in $and
                if (query.$or && Array.isArray(query.$or)) {
                    query = {
                        $and: [
                            { $or: query.$or },
                            residenceFilter
                        ]
                    };
                } else {
                    // For simple queries, add residence filter using $and
                    query = {
                        $and: [
                            query,
                            residenceFilter
                        ]
                    };
                }
                
                console.log(`🔍 Filtering transactions by residence: ${residenceId}`);
            }
            
            // Add forfeiture exclusion (same as cash flow service)
            query['metadata.isForfeiture'] = { $ne: true };
            
            let transactions = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .limit(500); // Get more transactions to filter by description
            
            // For income accounts in cash flow, ONLY include payment transactions (cash received)
            // Use the EXACT same categorization logic as the cash flow service
            if (account.type === 'Income') {
                // First, filter by month metadata if month is specified
                // Payment allocations use monthSettled metadata to indicate which month they belong to
                if (month && period) {
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthIndex = monthNames.indexOf(month.toLowerCase());
                    if (monthIndex !== -1) {
                        const requestedMonth = monthIndex + 1; // 1-based month
                        const requestedYear = parseInt(period);
                        const requestedMonthKey = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}`; // e.g., "2025-11"
                        
                transactions = transactions.filter(tx => {
                            // For cash flow, use ONLY transaction date (when cash was received)
                            // Do NOT use monthSettled or description parsing - cash flow is about when cash moved
                            const txDate = new Date(tx.date);
                            const txYear = txDate.getFullYear();
                            const txMonth = txDate.getMonth() + 1;
                            
                            // Only include if transaction date matches requested month
                            return txYear === requestedYear && txMonth === requestedMonth;
                        });
                        
                        console.log(`📅 Filtered transactions by month ${requestedMonthKey}: ${transactions.length} transactions remaining`);
                    }
                }
                
                transactions = transactions.filter(tx => {
                    // Exclude accrual transactions - they don't involve cash
                    if (tx.source === 'rental_accrual' || tx.source === 'expense_accrual') {
                        return false;
                    }
                    
                    // Exclude transactions with "accrual" in description (unless it's a payment allocation)
                        const description = (tx.description || '').toLowerCase();
                    if (description.includes('accrual') && !description.includes('payment allocation')) {
                        return false;
                    }
                    
                    // Only include transactions with cash account debit (cash received)
                    // This includes: DR Cash CR Debtor, DR Cash CR Income, payment transactions
                    // Must have cash account entry (1000 series) with debit (cash coming in)
                    const cashEntry = tx.entries?.find(e => {
                        const code = String(e.accountCode || '').trim();
                        const isCashAccount = code.match(/^100/);
                        const hasCashDebit = (e.debit || 0) > 0;
                        return isCashAccount && hasCashDebit;
                    });
                    
                    if (cashEntry && cashEntry.debit > 0) {
                        // This is a cash receipt transaction - categorize using same logic as cash flow service
                        if (accountCode === '4001') {
                            // Rental income - match cash flow service logic exactly
                            // Check for: "rent", "rental", "accommodation", or "payment allocation" in description
                            return description.includes('rent') || 
                                   description.includes('rental') || 
                                   description.includes('accommodation') || 
                                   description.includes('payment allocation');
                        } else if (accountCode === '4002') {
                            // Admin fees - match cash flow service logic
                            return description.includes('admin') || 
                                   description.includes('administrative') || 
                                   description.includes('fee');
                        } else if (accountCode === '4003') {
                            // Deposits - match cash flow service logic
                            return description.includes('deposit') || 
                                   description.includes('security');
                        } else if (accountCode === '4006' || accountCode === 'other_income') {
                            // Other income - ONLY transactions that debited cash (1000) and credited debtors (1100 series)
                            // Must be DR Cash CR Debtor pattern - NOT account code 4003 or deposit liability accounts
                            
                            // EXCLUDE: Check if transaction has account code 4003 (deposits) in any entry
                            const hasDepositAccountCode = tx.entries?.some(e => {
                                const code = String(e.accountCode || '').trim();
                                return code === '4003';
                            });
                            if (hasDepositAccountCode) {
                                return false; // This is a deposit transaction - exclude from other_income
                            }
                            
                            // EXCLUDE: Check if transaction has deposit liability account codes (2028, 20002, 2020, etc.) credited
                            const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020', '2201'];
                            const hasDepositLiabilityAccount = tx.entries?.some(e => {
                                const code = String(e.accountCode || '').trim();
                                return depositAccountCodes.includes(code) && (e.credit || 0) > 0;
                            });
                            if (hasDepositLiabilityAccount) {
                                return false; // This is a deposit transaction - exclude from other_income
                            }
                            
                            // REQUIRE: Must have debtor/AR account credited (1100 series) - DR Cash CR Debtor pattern
                            const hasDebtorCredit = tx.entries?.some(e => {
                                const code = String(e.accountCode || '').trim();
                                return code.match(/^1100/) && (e.credit || 0) > 0;
                            });
                            if (!hasDebtorCredit) {
                                return false; // Must credit a debtor account - exclude if not
                            }
                            
                            // Exclude rent, admin, deposits, utilities, advance payments by description
                            const isRent = description.includes('rent') || 
                                         description.includes('rental') || 
                                         description.includes('accommodation') || 
                                         description.includes('payment allocation');
                            const isAdmin = description.includes('admin') || 
                                          description.includes('administrative') || 
                                          description.includes('fee');
                            const isDeposit = description.includes('deposit') || 
                                            description.includes('security');
                            const isUtilities = description.includes('utilit') || 
                                               description.includes('internet') || 
                                               description.includes('wifi');
                            const isAdvance = description.includes('advance') || 
                                            description.includes('prepaid') || 
                                            description.includes('future');
                            
                            // Check if this is an internal cash transfer (cash to cash) - exclude
                            const hasCashCredit = tx.entries?.some(e => {
                                const code = String(e.accountCode || '').trim();
                                return code.match(/^100/) && (e.credit || 0) > 0;
                            });
                            if (hasCashCredit && cashEntry) {
                                // Check if there's a non-cash entry (debtor, income, etc.) - if not, it's an internal transfer
                                const hasNonCashEntry = tx.entries?.some(e => {
                                    const code = String(e.accountCode || '').trim();
                                    const accountType = (e.accountType || '').toLowerCase();
                                    return !code.match(/^100/) && 
                                           (accountType === 'expense' || 
                                            accountType === 'income' || 
                                            accountType === 'liability' || 
                                            accountType === 'asset' ||
                                            code.match(/^1100/)); // Debtor/AR accounts
                                });
                                if (!hasNonCashEntry) {
                                    return false; // Internal cash transfer - exclude
                                }
                            }
                            
                            // Include if it's other income (council, DR Cash CR Debtor, etc.) and not any of the excluded categories
                            return !isRent && !isAdmin && !isDeposit && !isUtilities && !isAdvance;
                        }
                        // For other income accounts, include all payment transactions
                        return true;
                    }
                    
                    return false;
                });
                
                // Deduplicate transactions by transaction ID (in case same transaction appears multiple times)
                const seenTransactionIds = new Set();
                transactions = transactions.filter(tx => {
                    const txId = tx._id?.toString() || tx.id?.toString() || tx.transactionId;
                    if (seenTransactionIds.has(txId)) {
                        return false; // Skip duplicate
                    }
                    seenTransactionIds.add(txId);
                    return true;
                });
                
                // Limit to 100 after filtering
                transactions = transactions.slice(0, 100);
            } else if (account.type === 'Expense') {
                // First, filter by month if month is specified (expenses use transaction date)
                // For expenses, we use transaction date for month filtering (not monthSettled like payments)
                if (month && period) {
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthIndex = monthNames.indexOf(month.toLowerCase());
                    if (monthIndex !== -1) {
                        const requestedMonth = monthIndex + 1; // 1-based month
                        const requestedYear = parseInt(period);
                        
                        transactions = transactions.filter(tx => {
                            // For expenses, use transaction date (expenses are paid when incurred, not allocated to months)
                            const txDate = new Date(tx.date);
                            return txDate.getFullYear() === requestedYear && (txDate.getMonth() + 1) === requestedMonth;
                        });
                        
                        console.log(`📅 Filtered expense transactions by month ${month} ${requestedYear}: ${transactions.length} transactions remaining`);
                    }
                }
                
                // For expense accounts, filter to include ONLY transactions that have the specific expense account code
                // Each expense account should only show its own transactions, not other expense accounts
                transactions = transactions.filter(tx => {
                    // STRICT: Only include transactions that have the specific expense account code
                    const expenseEntry = tx.entries.find(e => {
                        // Handle both string and number account codes
                        const entryAccountCode = String(e.accountCode || '').trim();
                        const requestedAccountCode = String(accountCode || '').trim();
                        return entryAccountCode === requestedAccountCode && (e.debit || 0) > 0;
                    });
                    
                    if (expenseEntry) {
                        return true; // Include transactions with the specific expense account code
                    }
                    
                    // For expense accounts, we should ONLY show transactions with the specific account code
                    // Don't include transactions with other expense accounts just because they have cash credits
                    // This ensures each expense account only shows its own transactions
                    return false;
                });
                
                // Deduplicate transactions by transaction ID (in case same transaction appears multiple times)
                const seenTransactionIds = new Set();
                transactions = transactions.filter(tx => {
                    const txId = tx._id?.toString() || tx.id?.toString() || tx.transactionId;
                    if (seenTransactionIds.has(txId)) {
                        return false; // Skip duplicate
                    }
                    seenTransactionIds.add(txId);
                    return true;
                });
                
                // Limit to 100 after filtering
                transactions = transactions.slice(0, 100);
            } else if (depositAccountCodes.includes(accountCode)) {
                // For deposit accounts, filter to include only deposit-related transactions
                const allDepositCodes = depositAccounts.length > 0 
                    ? depositAccounts.map(acc => acc.code)
                    : depositAccountCodes;
                
                transactions = transactions.filter(tx => {
                    // SPECIAL CASE: For account 2028 (Security deposit payable), only show expense transactions
                    // Expense transactions: dr 2028, cr cash (security deposit returns)
                    // Exclude: dr cash cr 2028 (deposit receipts), dr 10005 cr 2028 (opening balance), lease start entries
                    if (accountCode === '2028') {
                        const account2028Entry = tx.entries.find(e => String(e.accountCode || '').trim() === '2028');
                        const cashEntry = tx.entries.find(e => String(e.accountCode || '').trim().match(/^1000/));
                        const openingBalanceEntry = tx.entries.find(e => String(e.accountCode || '').trim() === '10005');
                        const isLeaseStart = tx.source === 'rental_accrual' || (tx.description || '').toLowerCase().includes('lease start');
                        
                        // Only include if: 2028 is debited (expense) AND cash is credited AND no opening balance entry
                        if (account2028Entry && account2028Entry.debit > 0 && cashEntry && cashEntry.credit > 0 && !openingBalanceEntry && !isLeaseStart) {
                            return true; // This is an expense transaction (security deposit return)
                        }
                        
                        // Exclude all other transactions for 2028
                        return false;
                    }
                    
                    // For other deposit accounts, use original logic
                    // Check if transaction has any deposit account entry
                    const depositEntry = tx.entries.find(e => allDepositCodes.includes(e.accountCode));
                    if (depositEntry) {
                        return true; // Include transactions with any deposit account code
                    }
                    
                    // Or check if it's a payment transaction with deposit in description
                    const cashEntry = tx.entries.find(e => e.accountCode.match(/^1000/));
                    const description = (tx.description || '').toLowerCase();
                    if (cashEntry && (description.includes('deposit') || description.includes('security'))) {
                        return true;
                    }
                    
                    return false;
                });
                
                // Limit to 100 after filtering
                transactions = transactions.slice(0, 100);
            }
            
            // Calculate monthly breakdown
            const monthlyBreakdown = {};
            transactions.forEach(transaction => {
                const monthKey = transaction.date.toISOString().slice(0, 7); // YYYY-MM
                if (!monthlyBreakdown[monthKey]) {
                    monthlyBreakdown[monthKey] = {
                        month: monthKey,
                        totalDebit: 0,
                        totalCredit: 0,
                        netAmount: 0,
                        transactionCount: 0
                    };
                }
                
                if (account.type === 'Income') {
                    // For income accounts in cash flow, only handle payment transactions (cash received)
                    // Accruals are excluded as they don't involve actual cash movement
                    const cashEntry = transaction.entries.find(entry => entry.accountCode.match(/^1000/));
                    
                    if (cashEntry && cashEntry.debit > 0) {
                        // This is a payment transaction - use cash received amount (cash debit)
                        const cashAmount = cashEntry.debit || 0;
                        monthlyBreakdown[monthKey].totalDebit += 0; // Income accounts don't have debits in cash flow
                        monthlyBreakdown[monthKey].totalCredit += cashAmount; // Cash received = income credit
                        monthlyBreakdown[monthKey].netAmount += cashAmount; // Net amount = cash received
                        monthlyBreakdown[monthKey].transactionCount += 1;
                    }
                } else if (depositAccountCodes.includes(accountCode)) {
                    // SPECIAL CASE: For account 2028, only count expense transactions (dr 2028, cr cash)
                    if (accountCode === '2028') {
                        const account2028Entry = transaction.entries.find(entry => String(entry.accountCode || '').trim() === '2028');
                        const cashEntry = transaction.entries.find(entry => String(entry.accountCode || '').trim().match(/^1000/));
                        const openingBalanceEntry = transaction.entries.find(entry => String(entry.accountCode || '').trim() === '10005');
                        const isLeaseStart = transaction.source === 'rental_accrual' || (transaction.description || '').toLowerCase().includes('lease start');
                        
                        // Only count if: 2028 is debited (expense) AND cash is credited AND no opening balance
                        if (account2028Entry && account2028Entry.debit > 0 && cashEntry && cashEntry.credit > 0 && !openingBalanceEntry && !isLeaseStart) {
                            const expenseAmount = account2028Entry.debit || 0;
                            monthlyBreakdown[monthKey].totalDebit += expenseAmount;
                            monthlyBreakdown[monthKey].totalCredit += 0;
                            monthlyBreakdown[monthKey].netAmount += expenseAmount; // Expense amount
                            monthlyBreakdown[monthKey].transactionCount += 1;
                        }
                        // Skip all other transactions (deposit receipts, opening balances, lease starts)
                    } else {
                        // For other deposit accounts, show cash received for deposits
                        // Check for any deposit account entry across all deposit accounts
                        const allDepositCodes = depositAccounts.length > 0 
                            ? depositAccounts.map(acc => acc.code)
                            : depositAccountCodes;
                        
                        const depositEntry = transaction.entries.find(entry => allDepositCodes.includes(entry.accountCode));
                        const cashEntry = transaction.entries.find(entry => entry.accountCode.match(/^1000/));
                        
                        if (depositEntry) {
                            // Direct deposit account entry - use credit amount (liability increases)
                            const depositAmount = depositEntry.credit || 0;
                            monthlyBreakdown[monthKey].totalDebit += depositEntry.debit || 0;
                            monthlyBreakdown[monthKey].totalCredit += depositAmount;
                            // For deposits: netAmount = credit - debit (credits increase liability, which means cash received)
                            monthlyBreakdown[monthKey].netAmount += depositAmount - (depositEntry.debit || 0);
                            monthlyBreakdown[monthKey].transactionCount += 1;
                        } else if (cashEntry && cashEntry.debit > 0) {
                            // Payment transaction with deposit - use cash amount received
                            const cashAmount = cashEntry.debit || 0;
                            monthlyBreakdown[monthKey].totalDebit += 0;
                            monthlyBreakdown[monthKey].totalCredit += cashAmount; // Cash received = deposit credit
                            monthlyBreakdown[monthKey].netAmount += cashAmount; // Net amount = cash received
                            monthlyBreakdown[monthKey].transactionCount += 1;
                        }
                    }
                } else if (account.type === 'Expense') {
                    // For expense accounts, use ONLY the specific expense account entry amount
                    // For multi-entry transactions, only count the amount for this specific account code
                const accountEntry = transaction.entries.find(entry => entry.accountCode === accountCode);
                    const cashEntry = transaction.entries.find(entry => entry.accountCode.match(/^1000/));
                    
                if (accountEntry) {
                        // Direct expense account entry - use debit amount (expenses increase with debits)
                        // This ensures we only count the amount for this specific account (e.g., 100 for 5004, not 300 for the whole transaction)
                        const expenseAmount = accountEntry.debit || 0;
                        monthlyBreakdown[monthKey].totalDebit += expenseAmount;
                    monthlyBreakdown[monthKey].totalCredit += accountEntry.credit || 0;
                        // For expenses: netAmount = debit - credit (debits increase expenses)
                        monthlyBreakdown[monthKey].netAmount += expenseAmount - (accountEntry.credit || 0);
                        monthlyBreakdown[monthKey].transactionCount += 1;
                    } else if (cashEntry && cashEntry.credit > 0) {
                        // Fallback: Expense transaction with cash paid out
                        // But only use this if it's a single-expense transaction for this account
                        const expenseEntries = transaction.entries.filter(e => {
                            const accCode = String(e.accountCode || '').trim();
                            const accType = e.accountType;
                            return (accType === 'Expense' || accCode.startsWith('5')) && (e.debit || 0) > 0;
                        });
                        
                        // Only use cash credit if there's only one expense entry and it matches this account
                        if (expenseEntries.length === 1 && expenseEntries[0].accountCode === accountCode) {
                            const cashAmount = cashEntry.credit || 0;
                            monthlyBreakdown[monthKey].totalDebit += cashAmount; // Cash paid out = expense debit
                            monthlyBreakdown[monthKey].totalCredit += 0;
                            monthlyBreakdown[monthKey].netAmount += cashAmount; // Net amount = expense amount
                            monthlyBreakdown[monthKey].transactionCount += 1;
                        }
                        // If it's a multi-entry transaction without a direct account entry, skip it
                    }
                    } else {
                    // For all other accounts (assets, liabilities, equity, etc.), use the account entry directly
                    const accountEntry = transaction.entries.find(entry => entry.accountCode === accountCode);
                    if (accountEntry) {
                        monthlyBreakdown[monthKey].totalDebit += accountEntry.debit || 0;
                        monthlyBreakdown[monthKey].totalCredit += accountEntry.credit || 0;
                        
                        // Calculate netAmount based on account type
                        // For assets: netAmount = debit - credit (debits increase)
                        // For liabilities, equity, and income: netAmount = credit - debit (credits increase)
                        if (account.type === 'Asset') {
                        monthlyBreakdown[monthKey].netAmount += (accountEntry.debit || 0) - (accountEntry.credit || 0);
                        } else {
                            // Liability, Equity, Income
                            monthlyBreakdown[monthKey].netAmount += (accountEntry.credit || 0) - (accountEntry.debit || 0);
                    }
                    monthlyBreakdown[monthKey].transactionCount += 1;
                }
                }
            });
            
            // Calculate cashFlowData from monthlyBreakdown to ensure consistency
            let cashFlowType = 'cash_flow';
            if (account.type === 'Income') {
                cashFlowType = 'income';
            } else if (account.type === 'Expense') {
                cashFlowType = 'expense';
            } else if (depositAccountCodes.includes(accountCode)) {
                cashFlowType = 'deposit'; // Deposits are liability accounts
            }
            
            // Use cash flow service data if available (to ensure it matches the cash flow statement)
            // Otherwise calculate from transactions
            let finalCashFlowData;
            let finalMonthlyBreakdown = monthlyBreakdown; // Default to transaction-based breakdown
            
            if (accountData && (accountData.totalCredit !== undefined || accountData.totalDebit !== undefined || accountData.netAmount !== undefined)) {
                // Use the data from cash flow service (ensures it matches the cash flow statement)
                // This works for both income (totalCredit) and expenses (totalDebit)
                finalCashFlowData = {
                    totalCredit: accountData.totalCredit || 0,
                    totalDebit: accountData.totalDebit || 0,
                    netAmount: accountData.netAmount !== undefined ? accountData.netAmount : (accountData.totalCredit || 0) - (accountData.totalDebit || 0),
                    transactionCount: transactions.length,
                    type: cashFlowType
                };
                
                // Also use cash flow service's monthly breakdown if available
                if (cashFlowData && cashFlowData.monthly_breakdown) {
                    const cashFlowMonthlyBreakdown = cashFlowData.monthly_breakdown;
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                      'july', 'august', 'september', 'october', 'november', 'december'];
                    
                    // Build monthly breakdown from cash flow service data
                    finalMonthlyBreakdown = {};
                    
                    // If month is specified, only process that month
                    let monthsToProcess = monthNames;
                    if (month && period) {
                        const targetMonth = month.toLowerCase();
                        if (monthNames.includes(targetMonth)) {
                            monthsToProcess = [targetMonth];
                        }
                    }
                    
                    for (const monthName of monthsToProcess) {
                        const monthData = cashFlowMonthlyBreakdown[monthName];
                        if (!monthData) continue;
                        
                        let monthTotalCredit = 0;
                        let monthTotalDebit = 0;
                        let monthNetAmount = 0;
                        
                        if (account.type === 'Income') {
                            // For income accounts, get from income section
                            if (accountCode === '4001' && monthData.income?.rental_income) {
                                monthTotalCredit = monthData.income.rental_income || 0;
                            } else if (accountCode === '4002' && monthData.income?.admin_fees) {
                                monthTotalCredit = monthData.income.admin_fees || 0;
                            } else if (accountCode === '4003' && monthData.income?.deposits) {
                                monthTotalCredit = monthData.income.deposits || 0;
                            } else if ((accountCode === '4006' || accountCode === 'other_income') && monthData.income?.other_income) {
                                monthTotalCredit = monthData.income.other_income || 0;
                            }
                            monthNetAmount = monthTotalCredit;
                        } else if (account.type === 'Expense') {
                            // For expense accounts, get from operating_activities.breakdown
                            const accountNameLower = (account.name || '').toLowerCase();
                            let expenseCategory = null;
                            
                            if (accountNameLower.includes('council') || accountNameLower.includes('rates')) {
                                expenseCategory = 'council_rates';
                            } else if (accountNameLower.includes('maintenance')) {
                                expenseCategory = 'maintenance';
                            } else if (accountNameLower.includes('cleaning')) {
                                expenseCategory = 'cleaning';
                            } else if (accountNameLower.includes('electricity')) {
                                expenseCategory = 'electricity';
                            } else if (accountNameLower.includes('water')) {
                                expenseCategory = 'water';
                            } else if (accountNameLower.includes('gas')) {
                                expenseCategory = 'gas';
                            } else if (accountNameLower.includes('internet') || accountNameLower.includes('wifi')) {
                                expenseCategory = 'internet';
                            } else if (accountNameLower.includes('security')) {
                                expenseCategory = 'security';
                            } else if (accountNameLower.includes('management')) {
                                expenseCategory = 'management';
                            } else if (accountNameLower.includes('insurance')) {
                                expenseCategory = 'insurance';
                            } else if (accountNameLower.includes('plumbing')) {
                                expenseCategory = 'plumbing';
                            } else if (accountNameLower.includes('sanitary')) {
                                expenseCategory = 'sanitary';
                            } else if (accountNameLower.includes('solar')) {
                                expenseCategory = 'solar';
                            }
                            
                            if (expenseCategory && monthData.operating_activities?.breakdown) {
                                monthTotalDebit = monthData.operating_activities.breakdown[expenseCategory] || 0;
                            }
                            monthNetAmount = monthTotalDebit;
                        }
                        
                        if (monthTotalCredit > 0 || monthTotalDebit > 0 || monthNetAmount !== 0) {
                            finalMonthlyBreakdown[monthName] = {
                                month: monthName,
                                totalDebit: monthTotalDebit,
                                totalCredit: monthTotalCredit,
                                netAmount: monthNetAmount,
                                transactionCount: 0 // Will be calculated from transactions
                            };
                        }
                    }
                    
                    // Update transaction counts from actual transactions
                    for (const transaction of transactions) {
                        const transactionDate = new Date(transaction.date);
                        const transactionMonth = monthNames[transactionDate.getMonth()];
                        
                        if (finalMonthlyBreakdown[transactionMonth]) {
                            finalMonthlyBreakdown[transactionMonth].transactionCount += 1;
                        }
                    }
                }
            } else {
                // Fallback: calculate from transactions
                finalCashFlowData = {
                totalCredit: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.totalCredit, 0),
                totalDebit: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.totalDebit, 0),
                netAmount: Object.values(monthlyBreakdown).reduce((sum, month) => sum + month.netAmount, 0),
                transactionCount: transactions.length,
                type: cashFlowType
            };
            }
            
            const response = {
                success: true,
                account: {
                    code: account.code,
                    name: account.name,
                    type: account.type,
                    category: account.category
                },
                // Include all deposit accounts if querying for deposits
                ...(depositAccounts.length > 0 && depositAccountCodes.includes(accountCode) ? {
                    depositAccounts: depositAccounts.map(acc => ({
                        code: acc.code,
                        name: acc.name,
                        type: acc.type,
                        category: acc.category
                    }))
                } : {}),
                cashFlowData: finalCashFlowData,
                transactions: (await Promise.all(transactions.map(async (tx, index) => {
                    // For cash flow, we want to show the cash amount that came in
                    // Look for cash account entries (1000 series) in payment transactions
                    const cashEntry = tx.entries.find(e => e.accountCode.match(/^100/));
                    const accountEntry = tx.entries.find(e => e.accountCode === accountCode);
                    
                    let amount = 0;
                    let type = 'credit';
                    
                    if (account.type === 'Income') {
                        // For income accounts in cash flow, only show cash received (payment transactions)
                        // Cash received is when cash account is debited
                        if (cashEntry && cashEntry.debit > 0) {
                            // Cash is debited (money coming in) - this is the cash received amount
                        amount = cashEntry.debit || 0;
                            type = 'debit'; // Cash debit means cash received
                        }
                    } else if (depositAccountCodes.includes(accountCode)) {
                        // SPECIAL CASE: For account 2028, only show expense transactions (dr 2028, cr cash)
                        if (accountCode === '2028') {
                            const account2028Entry = tx.entries.find(e => String(e.accountCode || '').trim() === '2028');
                            const openingBalanceEntry = tx.entries.find(e => String(e.accountCode || '').trim() === '10005');
                            const isLeaseStart = tx.source === 'rental_accrual' || (tx.description || '').toLowerCase().includes('lease start');
                            
                            // Only show if: 2028 is debited (expense) AND cash is credited AND no opening balance
                            if (account2028Entry && account2028Entry.debit > 0 && cashEntry && cashEntry.credit > 0 && !openingBalanceEntry && !isLeaseStart) {
                                amount = account2028Entry.debit || 0;
                                type = 'debit'; // Expense transaction
                            } else {
                                // Skip this transaction for 2028 (it's a deposit receipt, opening balance, or lease start)
                                amount = 0;
                            }
                        } else {
                            // For other deposit accounts, show cash received for deposits
                            // Check for any deposit account entry across all deposit accounts
                            const allDepositCodes = depositAccounts.length > 0 
                                ? depositAccounts.map(acc => acc.code)
                                : depositAccountCodes;
                            
                            const depositEntry = tx.entries.find(e => allDepositCodes.includes(e.accountCode));
                            
                            if (cashEntry && cashEntry.debit > 0) {
                                // Cash is debited (money coming in) - this is the cash received amount
                                amount = cashEntry.debit || 0;
                                type = 'debit'; // Cash debit means cash received
                            } else if (depositEntry) {
                                // Use deposit account credit (liability increases = cash received)
                                amount = depositEntry.credit || 0;
                                type = 'credit';
                            } else if (accountEntry) {
                                // Fallback to requested account code entry
                                amount = accountEntry.credit || 0;
                                type = 'credit';
                            }
                        }
                    } else {
                        // For all other accounts (expenses, assets, liabilities, equity, etc.), use account entry directly
                        if (account.type === 'Expense') {
                            // For expense accounts, use the specific expense entry amount (not the full transaction amount)
                            // This handles multi-entry transactions where we only want to show the amount for this specific account
                            if (accountEntry) {
                                // Use the expense entry amount directly (for account 5004, show only 100, not 300)
                                amount = accountEntry.debit || 0; // Expense debits are the expense amount
                                type = 'debit';
                            } else if (cashEntry && cashEntry.credit > 0) {
                                // Fallback: If no direct expense entry found, use cash credit
                                // But only if this is a single-expense transaction
                                const expenseEntries = tx.entries.filter(e => {
                                    const accCode = String(e.accountCode || '').trim();
                                    const accType = e.accountType;
                                    return (accType === 'Expense' || accCode.startsWith('5')) && (e.debit || 0) > 0;
                                });
                                
                                // Only use cash credit if there's only one expense entry (single-expense transaction)
                                if (expenseEntries.length === 1 && expenseEntries[0].accountCode === accountCode) {
                                    amount = cashEntry.credit || 0; // Cash credit means cash paid out
                                    type = 'credit';
                                } else {
                                    // Multi-entry transaction without direct account entry - skip or use 0
                                    amount = 0;
                                    type = 'credit';
                                }
                            }
                        } else {
                            // For non-expense accounts, use cash entry or account entry
                            if (cashEntry) {
                                // For cash flow, show cash movement
                                amount = cashEntry.debit || cashEntry.credit || 0;
                                type = cashEntry.debit > 0 ? 'debit' : 'credit';
                            } else if (accountEntry) {
                                // Use account entry amount directly
                                amount = accountEntry.debit || accountEntry.credit || 0;
                                type = accountEntry.debit > 0 ? 'debit' : 'credit';
                            }
                        }
                    }
                    
                    // Try to get student information from the transaction
                    let studentName = null;
                    let studentId = null;
                    
                    try {
                        // Method 1: Look for student ID in AR account entries (1100-<studentId>)
                        const arEntry = tx.entries.find(e => e.accountCode.match(/^1100-/));
                        if (arEntry) {
                            studentId = arEntry.accountCode.replace('1100-', '');
                        }
                        
                        // Method 2: Check transaction metadata for studentId
                        if (!studentId && tx.metadata && tx.metadata.studentId) {
                            studentId = tx.metadata.studentId.toString();
                            // Try to fetch student name immediately if we have the ID
                            if (studentId && !studentName) {
                                try {
                                    const User = require('../models/User');
                                    const mongoose = require('mongoose');
                                    if (mongoose.Types.ObjectId.isValid(studentId)) {
                                        const student = await User.findById(studentId).select('firstName lastName email').lean();
                                        if (student) {
                                            studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
                                        }
                                    }
                                } catch (err) {
                                    // Continue to other methods if this fails
                                }
                            }
                        }
                        
                        // Method 3: Check sourceId if it's a Payment or relates to a student
                        // Also check for advance_payment source type
                        if (!studentId && tx.sourceId) {
                            if (tx.sourceModel === 'Payment' || !tx.sourceModel || tx.source === 'advance_payment' || tx.source === 'payment') {
                                const Payment = require('../models/Payment');
                                const payment = await Payment.findById(tx.sourceId)
                                    .select('student user')
                                    .populate('student', 'firstName lastName')
                                    .populate('user', 'firstName lastName');
                                if (payment) {
                                    // Try student field first, then user field
                                    const studentRef = payment.student || payment.user;
                                    if (studentRef) {
                                        studentId = studentRef._id ? studentRef._id.toString() : studentRef.toString();
                                        if (studentRef.firstName && studentRef.lastName) {
                                            studentName = `${studentRef.firstName} ${studentRef.lastName}`;
                                        }
                                    }
                                }
                            } else if (tx.sourceModel === 'Lease') {
                                const Lease = require('../models/Lease');
                                const lease = await Lease.findById(tx.sourceId).select('student').populate('student', 'firstName lastName');
                                if (lease && lease.student) {
                                    studentId = lease.student._id ? lease.student._id.toString() : lease.student.toString();
                                    if (lease.student.firstName && lease.student.lastName) {
                                        studentName = `${lease.student.firstName} ${lease.student.lastName}`;
                                    }
                                }
                            } else if (tx.sourceModel === 'Application') {
                                const Application = require('../models/Application');
                                const application = await Application.findById(tx.sourceId).select('student firstName lastName').populate('student', 'firstName lastName');
                                if (application) {
                                    if (application.student) {
                                        studentId = application.student._id ? application.student._id.toString() : application.student.toString();
                                        if (application.student.firstName && application.student.lastName) {
                                            studentName = `${application.student.firstName} ${application.student.lastName}`;
                                        }
                                    } else if (application.firstName && application.lastName) {
                                        studentName = `${application.firstName} ${application.lastName}`;
                                    }
                                }
                            }
                        }
                        
                        // Method 4: Check reference field for Payment ID or student ID
                        if (!studentId && tx.reference) {
                            const mongoose = require('mongoose');
                            if (mongoose.Types.ObjectId.isValid(tx.reference)) {
                                // First try as Payment ID (for advance payments)
                                const Payment = require('../models/Payment');
                                const payment = await Payment.findById(tx.reference)
                                    .select('student user')
                                    .populate('student', 'firstName lastName')
                                    .populate('user', 'firstName lastName');
                                if (payment) {
                                    const studentRef = payment.student || payment.user;
                                    if (studentRef) {
                                        studentId = studentRef._id ? studentRef._id.toString() : studentRef.toString();
                                        if (studentRef.firstName && studentRef.lastName) {
                                            studentName = `${studentRef.firstName} ${studentRef.lastName}`;
                                        }
                                    }
                                } else {
                                    // If not a Payment, try as User ID
                                    const User = require('../models/User');
                                    const user = await User.findById(tx.reference).select('firstName lastName');
                                    if (user) {
                                        studentId = tx.reference.toString();
                                        studentName = `${user.firstName} ${user.lastName}`;
                                    }
                                }
                            }
                        }
                        
                        // If we have studentId but no studentName, fetch it
                        if (studentId && !studentName) {
                            try {
                                const User = require('../models/User');
                                const mongoose = require('mongoose');
                                
                                // Validate ObjectId format and convert if needed
                                let studentIdToUse = studentId;
                                if (typeof studentId === 'string' && mongoose.Types.ObjectId.isValid(studentId)) {
                                    studentIdToUse = new mongoose.Types.ObjectId(studentId);
                                } else if (!mongoose.Types.ObjectId.isValid(studentId)) {
                                    console.log(`⚠️ Invalid ObjectId format for studentId: ${studentId}`);
                                    studentIdToUse = null;
                                }
                                
                                if (studentIdToUse && mongoose.Types.ObjectId.isValid(studentIdToUse)) {
                                    // Try User collection first
                                    const student = await User.findById(studentIdToUse).select('firstName lastName email').lean();
                                    if (student) {
                                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
                                        console.log(`✅ Found student name for ID ${studentId}: ${studentName}`);
                                    } else {
                                        console.log(`⚠️ Student not found in User collection for ID: ${studentId}`);
                                        
                                        // If still no name, try Application collection as fallback
                                        const Application = require('../models/Application');
                                        const application = await Application.findOne({ student: studentIdToUse }).select('firstName lastName email').lean();
                                        if (application) {
                                            studentName = `${application.firstName || ''} ${application.lastName || ''}`.trim();
                                            console.log(`✅ Found student name from Application for ID ${studentId}: ${studentName}`);
                                        } else {
                                            // If still no name, try Debtor collection (for expired students)
                                            const Debtor = require('../models/Debtor');
                                            const debtor = await Debtor.findOne({ user: studentIdToUse }).populate('user', 'firstName lastName').lean();
                                            if (debtor) {
                                                // First try populated user (if student is still active)
                                                if (debtor.user && debtor.user.firstName) {
                                                studentName = `${debtor.user.firstName || ''} ${debtor.user.lastName || ''}`.trim();
                                                    console.log(`✅ Found student name from Debtor.user for ID ${studentId}: ${studentName}`);
                                                } 
                                                // If user is null (expired student), use contactInfo
                                                else if (debtor.contactInfo && debtor.contactInfo.name) {
                                                studentName = debtor.contactInfo.name;
                                                    console.log(`✅ Found expired student name from Debtor contactInfo for ID ${studentId}: ${studentName}`);
                                                } else if (debtor.debtorCode) {
                                                    // Last resort: use debtor code
                                                    studentName = `Debtor ${debtor.debtorCode}`;
                                                    console.log(`⚠️ Using debtor code as name for ID ${studentId}: ${studentName}`);
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // Last resort: try to get name from account name if it contains a name
                                if (!studentName && arEntry && arEntry.accountName) {
                                    const accountNameParts = arEntry.accountName.split('-');
                                    if (accountNameParts.length > 1) {
                                        const nameFromAccount = accountNameParts.slice(1).join('-').trim();
                                        if (nameFromAccount && nameFromAccount !== 'Student' && nameFromAccount.length > 2) {
                                            studentName = nameFromAccount;
                                        }
                                    }
                                }
                            } catch (fetchError) {
                                console.log(`Error fetching student name for ID ${studentId}:`, fetchError.message);
                            }
                        }
                        
                        // Method 5: Try to extract from description (for deposit transactions)
                        // Example: "Security deposit Marula" - try to find student by name
                        if (!studentId && !studentName && tx.description) {
                            // Look for common patterns like "Security deposit [Name]" or "Deposit for [Name]"
                            const namePatterns = [
                                /(?:security\s+)?deposit\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
                                /deposit\s+(?:for|from|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
                                /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+deposit/i
                            ];
                            
                            for (const pattern of namePatterns) {
                                const match = tx.description.match(pattern);
                                if (match && match[1]) {
                                    const possibleName = match[1].trim();
                                    // Skip common words that aren't names
                                    const skipWords = ['tenant', 'student', 'security', 'deposit', 'payment', 'for', 'from', 'of'];
                                    if (skipWords.includes(possibleName.toLowerCase())) {
                                        continue;
                                    }
                                    
                                    // Try to find student by name
                                    const User = require('../models/User');
                                    const nameParts = possibleName.split(/\s+/).filter(part => part.length > 0);
                                    if (nameParts.length >= 1) {
                                        const firstName = nameParts[0];
                                        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                                        
                                        let student = null;
                                        if (lastName) {
                                            student = await User.findOne({ 
                                                firstName: new RegExp(`^${firstName}$`, 'i'),
                                                lastName: new RegExp(`^${lastName}$`, 'i')
                                            }).select('firstName lastName');
                                        } else {
                                            // Try to find by first name only (might match multiple, take first)
                                            student = await User.findOne({ 
                                                firstName: new RegExp(`^${firstName}$`, 'i')
                                            }).select('firstName lastName');
                                        }
                                        
                                        if (student) {
                                            studentId = student._id.toString();
                                            studentName = `${student.firstName} ${student.lastName}`;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.log('Could not fetch student name for transaction:', tx.transactionId, error.message);
                    }
                    
                    // Get account names for all entries
                    const Account = require('../models/Account');
                    const entriesWithAccountNames = await Promise.all((tx.entries || []).map(async (entry) => {
                        let accountName = entry.accountName || entry.account?.name;
                        let accountType = entry.accountType || entry.account?.type;
                        
                        // If account name is not in entry, fetch from Account model
                        if (!accountName && entry.accountCode) {
                            try {
                                const accountDoc = await Account.findOne({ code: entry.accountCode }).select('name type').lean();
                                if (accountDoc) {
                                    accountName = accountDoc.name;
                                    accountType = accountDoc.type;
                                }
                            } catch (err) {
                                // Ignore errors
                            }
                        }
                        
                        return {
                            accountCode: entry.accountCode,
                            accountName: accountName || entry.accountCode,
                            accountType: accountType || 'Unknown',
                            debit: entry.debit || 0,
                            credit: entry.credit || 0,
                            description: entry.description || tx.description || ''
                        };
                    }));
                    
                    return {
                        id: tx._id,
                        transactionId: tx.transactionId,
                        date: tx.date,
                        description: tx.description,
                        amount: amount,
                        type: type,
                        source: tx.source,
                        status: tx.status,
                        studentId: studentId,
                        studentName: studentName,
                        tenant: studentName || 'N/A', // Tenant/Reference field
                        reference: tx.transactionId, // Reference field
                        entries: entriesWithAccountNames // Include all entries for full double-entry view
                    };
                }))).map((tx, index, array) => {
                    // Calculate running balance (cumulative sum)
                    // For liability accounts (2200), credits increase balance, debits decrease
                    // For asset accounts, debits increase balance, credits decrease
                    if (index === 0) {
                        // First transaction
                        if (account.type === 'Liability' || account.type === 'Equity') {
                            tx.runningBalance = tx.type === 'credit' ? tx.amount : -tx.amount;
                        } else {
                            tx.runningBalance = tx.type === 'debit' ? tx.amount : -tx.amount;
                        }
                    } else {
                        // Cumulative balance from previous transaction
                        const prevTx = array[index - 1];
                        const prevBalance = prevTx.runningBalance || 0;
                        if (account.type === 'Liability' || account.type === 'Equity') {
                            tx.runningBalance = prevBalance + (tx.type === 'credit' ? tx.amount : -tx.amount);
                        } else {
                            tx.runningBalance = prevBalance + (tx.type === 'debit' ? tx.amount : -tx.amount);
                        }
                    }
                    return tx;
                }).filter(tx => {
                    // For account 2028, filter out transactions with amount 0 (deposit receipts, opening balances, lease starts)
                    if (accountCode === '2028') {
                        return tx.amount > 0;
                    }
                    return true; // Include all transactions for other accounts
                }),
                monthlyBreakdown: Object.values(finalMonthlyBreakdown).sort((a, b) => b.month.localeCompare(a.month)),
                summary: {
                    totalTransactions: accountCode === '2028' 
                        ? transactions.filter(tx => {
                            const account2028Entry = tx.entries?.find(e => String(e.accountCode || '').trim() === '2028');
                            const cashEntry = tx.entries?.find(e => String(e.accountCode || '').trim().match(/^1000/));
                            const openingBalanceEntry = tx.entries?.find(e => String(e.accountCode || '').trim() === '10005');
                            const isLeaseStart = tx.source === 'rental_accrual' || (tx.description || '').toLowerCase().includes('lease start');
                            return account2028Entry && account2028Entry.debit > 0 && cashEntry && cashEntry.credit > 0 && !openingBalanceEntry && !isLeaseStart;
                        }).length
                        : transactions.length,
                    totalDebit: finalCashFlowData.totalDebit,
                    totalCredit: finalCashFlowData.totalCredit,
                    netAmount: finalCashFlowData.netAmount
                }
            };
            
            res.json(response);
            
        } catch (error) {
            console.error('Error getting cash flow account details:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting cash flow account details',
                error: error.message
            });
        }
    }

}

// Helper function to transform residence-filtered data to fixed balance sheet format
function transformResidenceFilteredToFixed(monthBreakdown, month, year) {
    try {
        // Extract data from the residence-filtered monthly breakdown
        const assets = monthBreakdown.assets || {};
        const liabilities = monthBreakdown.liabilities || {};
        const equity = monthBreakdown.equity || {};
        
        // Calculate totals from the residence-filtered data
        const totalAssets = monthBreakdown.total_assets || 0;
        const totalLiabilities = monthBreakdown.total_liabilities || 0;
        const totalEquity = monthBreakdown.total_equity || 0;
        
        console.log(`🔧 Transforming residence-filtered data for ${month}/${year}:`);
        console.log(`   Assets: $${totalAssets}, Liabilities: $${totalLiabilities}, Equity: $${totalEquity}`);
        
        // Calculate total AR from all individual AR accounts
        let totalAR = 0;
        Object.entries(assets).forEach(([key, account]) => {
            if (account.code && account.code.startsWith('1100')) {
                totalAR += account.balance || 0;
            }
        });
        
        // Calculate total cash from all cash accounts
        let totalCash = 0;
        let totalBank = 0;
        let totalPettyCash = 0;
        let totalVault = 0;
        let totalClearing = 0;
        
        Object.entries(assets).forEach(([key, account]) => {
            if (account.code === '1000') {
                totalCash += account.balance || 0;
            } else if (account.code === '1001') {
                totalBank += account.balance || 0;
            } else if (account.code === '1011') {
                totalPettyCash += account.balance || 0;
            } else if (account.code === '10003') {
                totalVault += account.balance || 0;
            } else if (account.code === '10005') {
                totalClearing += account.balance || 0;
            }
        });
        
        // Calculate individual liability balances
        const liabilityAccounts = {};
        Object.entries(liabilities).forEach(([key, account]) => {
            liabilityAccounts[key] = { balance: account.balance || 0, code: account.code, name: account.name };
        });
        
        // Calculate individual equity balances
        const equityAccounts = {};
        Object.entries(equity).forEach(([key, account]) => {
            equityAccounts[key] = { balance: account.balance || 0, code: account.code, name: account.name };
        });
        
        // Extract current and non-current assets from the actual assets data
        const BalanceSheetService = require('../services/balanceSheetService');
        const nonCurrentAssets = {};
        const allOtherCurrentAssets = {}; // All current assets not in the hardcoded list
        
        Object.entries(assets).forEach(([key, account]) => {
            if (account && account.code) {
                const accountCode = String(account.code || '');
                const accountName = String(account.name || '');
                const accountBalance = account.balance || 0;
                
                // Skip accounts we've already handled (cash accounts, AR)
                const isHandledAccount = ['1000', '1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014', '10003', '10005', '1100'].includes(accountCode);
                
                if (!isHandledAccount) {
                    // Check if it's a current or non-current asset
                    const isCurrent = BalanceSheetService.isCurrentAsset(accountCode, accountName);
                    
                    if (isCurrent) {
                        // Add to other current assets
                        allOtherCurrentAssets[key] = {
                            balance: accountBalance,
                            code: accountCode,
                            name: accountName
                        };
                        console.log(`💰 Extracted current asset: ${key} = $${accountBalance}`);
                    } else {
                        // Add to non-current assets
                        nonCurrentAssets[key] = {
                            balance: accountBalance,
                            code: accountCode,
                            name: accountName
                        };
                        console.log(`🏢 Extracted non-current asset: ${key} = $${accountBalance}`);
                    }
                }
            }
        });
        
        console.log(`🔧 Account totals: Cash: $${totalCash}, Bank: $${totalBank}, AR: $${totalAR}, Petty: $${totalPettyCash}, Vault: $${totalVault}, Clearing: $${totalClearing}`);
        console.log(`🔧 Liability totals: $${totalLiabilities}, Equity totals: $${totalEquity}`);
        console.log(`💰 Other current assets found: ${Object.keys(allOtherCurrentAssets).length} accounts`);
        console.log(`🏢 Non-current assets found: ${Object.keys(nonCurrentAssets).length} accounts`);
        
        // Transform to match the EXACT structure expected by transformFixedBalanceSheetToMonthly
        return {
            assets: {
                total_assets: totalAssets,
                current_assets: {
                    // Individual cash accounts that transformFixedBalanceSheetToMonthly expects
                    '1000 - Cash': { balance: totalCash, code: '1000', name: 'Cash' },
                    '1001 - Bank Account': { balance: totalBank, code: '1001', name: 'Bank Account' },
                    '1002 - Ecocash': { balance: 0, code: '1002', name: 'Ecocash' },
                    '1003 - Innbucks': { balance: 0, code: '1003', name: 'Innbucks' },
                    '1004 - Petty Cash': { balance: 0, code: '1004', name: 'Petty Cash' },
                    '1005 - Cash on Hand': { balance: 0, code: '1005', name: 'Cash on Hand' },
                    '1010 - General Petty Cash': { balance: 0, code: '1010', name: 'General Petty Cash' },
                    '1011 - Admin Petty Cash': { balance: totalPettyCash, code: '1011', name: 'Admin Petty Cash' },
                    '1012 - Finance Petty Cash': { balance: 0, code: '1012', name: 'Finance Petty Cash' },
                    '1013 - Property Manager Petty Cash': { balance: 0, code: '1013', name: 'Property Manager Petty Cash' },
                    '1014 - Maintenance Petty Cash': { balance: 0, code: '1014', name: 'Maintenance Petty Cash' },
                    '10003 - Cbz Vault': { balance: totalVault, code: '10003', name: 'Cbz Vault' },
                    '10005 - Opening balance clearing account': { balance: totalClearing, code: '10005', name: 'Opening balance clearing account' },
                    // AR accounts - aggregate all individual AR accounts
                    '1100 - Accounts Receivable': { balance: totalAR, code: '1100', name: 'Accounts Receivable' },
                    // Include ALL other current assets (like unfiltered does)
                    ...allOtherCurrentAssets
                },
                non_current_assets: nonCurrentAssets  // Use actual non-current assets from data
            },
            liabilities: {
                total_liabilities: totalLiabilities,
                // Include actual liability accounts from residence-filtered data
                ...liabilityAccounts,
                // Add standard liability accounts with $0 if not present
                '2000 - Accounts Payable': { balance: 0, code: '2000', name: 'Accounts Payable' },
                '2020 - Tenant Deposits': { balance: 0, code: '2020', name: 'Tenant Deposits' },
                '2100 - Other Current Liabilities': { balance: 0, code: '2100', name: 'Other Current Liabilities' },
                '2500 - Long Term Debt': { balance: 0, code: '2500', name: 'Long Term Debt' },
                '2600 - Other Non-Current Liabilities': { balance: 0, code: '2600', name: 'Other Non-Current Liabilities' }
            },
            equity: {
                total_equity: totalEquity,
                // Include actual equity accounts from residence-filtered data
                ...equityAccounts,
                // Add standard equity accounts with $0 if not present
                '3001 - Owner Capital': { balance: 0, code: '3001', name: 'Owner Capital' },
                '3201 - Current Year Earnings': { balance: 0, code: '3201', name: 'Current Year Earnings' }
            }
        };
    } catch (error) {
        console.error('Error transforming residence-filtered data:', error);
        return null;
    }
}

module.exports = FinancialReportsController; 