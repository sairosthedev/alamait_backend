const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

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
            
            // OPTIMIZATION 1: Pre-fetch all transaction data for the entire year in one query
            console.log('📊 Pre-fetching all transaction data for the year...');
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31, 23, 59, 59);
            
            const query = {
                date: { $gte: yearStart, $lte: yearEnd },
                status: 'posted'
            };
            
            if (residence) {
                query.residence = residence;
            }
            
            const allTransactions = await TransactionEntry.find(query)
                .sort({ date: 1 })
                .lean(); // Use lean() for better performance
            
            console.log(`✅ Fetched ${allTransactions.length} transactions for ${year}`);
            
            // OPTIMIZATION 2: Process all months in parallel
            const monthPromises = [];
            
            for (let month = 1; month <= 12; month++) {
                monthPromises.push(
                    OptimizedFinancialReportsController.generateMonthBalanceSheetOptimized(month, year, residence, allTransactions)
                );
            }
            
            console.log('🔄 Processing all 12 months in parallel...');
            const monthResults = await Promise.all(monthPromises);
            
            // OPTIMIZATION 3: Build response from parallel results
            const monthlyData = {};
            let totalAnnualAssets = 0;
            let totalAnnualLiabilities = 0;
            let totalAnnualEquity = 0;
            
            monthResults.forEach((monthData, index) => {
                const month = index + 1;
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
                } else {
                    // Handle failed months with default values
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
                        totalTransactions: allTransactions.length
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
    
    /**
     * OPTIMIZED: Generate balance sheet for a single month using pre-fetched data
     */
    static async generateMonthBalanceSheetOptimized(month, year, residenceId, allTransactions) {
        try {
            const monthEnd = new Date(year, month, 0);
            
            // Filter transactions for this month and earlier
            const monthTransactions = allTransactions.filter(t => t.date <= monthEnd);
            
            // OPTIMIZATION: Calculate all account balances from filtered transactions
            const accountBalances = OptimizedFinancialReportsController.calculateAccountBalancesFromTransactions(monthTransactions, residenceId);
            
            // Build balance sheet structure
            const totalCashAndBank = (accountBalances['1000'] || 0) + (accountBalances['1001'] || 0) + 
                                   (accountBalances['1002'] || 0) + (accountBalances['1003'] || 0) + 
                                   (accountBalances['1004'] || 0) + (accountBalances['1005'] || 0) +
                                   (accountBalances['1010'] || 0) + (accountBalances['1011'] || 0) + 
                                   (accountBalances['1012'] || 0) + (accountBalances['1013'] || 0) + 
                                   (accountBalances['1014'] || 0);
            
            const accountsReceivable = (accountBalances['1100'] || 0) + (accountBalances['1101'] || 0);
            const totalAssets = totalCashAndBank + accountsReceivable;
            
            const accountsPayable = Math.abs(accountBalances['2000'] || 0);
            const tenantDeposits = Math.abs(accountBalances['2020'] || 0);
            const deferredIncome = Math.abs(accountBalances['2200'] || 0);
            const totalLiabilities = accountsPayable + tenantDeposits + deferredIncome;
            
            const retainedEarnings = accountBalances['3000'] || 0;
            const totalEquity = retainedEarnings;
            
            const balanceCheck = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            
            return {
                month,
                year,
                asOf: monthEnd,
                residence: residenceId,
                assets: {
                    current: {
                        cashAndBank: {
                            total: totalCashAndBank,
                            cash: { amount: accountBalances['1000'] || 0, accountCode: '1000', accountName: 'Cash' },
                            bank: { amount: accountBalances['1001'] || 0, accountCode: '1001', accountName: 'Bank Account' },
                            ecocash: { amount: accountBalances['1002'] || 0, accountCode: '1002', accountName: 'Ecocash' },
                            innbucks: { amount: accountBalances['1003'] || 0, accountCode: '1003', accountName: 'Innbucks' },
                            pettyCash: { amount: accountBalances['1004'] || 0, accountCode: '1004', accountName: 'Petty Cash' },
                            cashOnHand: { amount: accountBalances['1005'] || 0, accountCode: '1005', accountName: 'Cash on Hand' }
                        },
                        accountsReceivable: { 
                            amount: accountsReceivable, 
                            accountCode: '1100', 
                            accountName: 'Accounts Receivable' 
                        }
                    },
                    total: totalAssets
                },
                liabilities: {
                    current: {
                        accountsPayable: { 
                            amount: accountsPayable, 
                            accountCode: '2000', 
                            accountName: 'Accounts Payable' 
                        },
                        tenantDeposits: { 
                            amount: tenantDeposits, 
                            accountCode: '2020', 
                            accountName: 'Tenant Deposits' 
                        },
                        deferredIncome: { 
                            amount: deferredIncome, 
                            accountCode: '2200', 
                            accountName: 'Deferred Income' 
                        }
                    },
                    total: totalLiabilities
                },
                equity: {
                    retainedEarnings: { 
                        amount: retainedEarnings, 
                        accountCode: '3000', 
                        accountName: 'Retained Earnings' 
                    },
                    total: totalEquity
                },
                balanceCheck: balanceCheck < 0.01 ? 'Balanced' : `Off by $${balanceCheck.toFixed(2)}`
            };
            
        } catch (error) {
            console.error(`Error generating balance sheet for ${month}/${year}:`, error);
            return null;
        }
    }
    
    /**
     * OPTIMIZATION: Calculate all account balances from pre-fetched transactions
     */
    static calculateAccountBalancesFromTransactions(transactions, residenceId) {
        const accountBalances = {};
        
        transactions.forEach(transaction => {
            // Apply residence filter if specified
            if (residenceId && transaction.residence && transaction.residence.toString() !== residenceId) {
                return;
            }
            
            transaction.entries.forEach(entry => {
                const accountCode = entry.accountCode;
                
                if (!accountBalances[accountCode]) {
                    accountBalances[accountCode] = 0;
                }
                
                // Add debits, subtract credits
                accountBalances[accountCode] += (entry.debit || 0) - (entry.credit || 0);
            });
        });
        
        return accountBalances;
    }
}

module.exports = OptimizedFinancialReportsController;

