const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

class FixedBalanceSheetService {
    /**
     * Generate Fixed Balance Sheet that includes ALL accounts from chart of accounts
     * This ensures opening balances and zero-balance accounts are properly shown
     */
    static async generateFixedBalanceSheet(asOf, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`🔧 Generating FIXED balance sheet as of ${asOfDate}`);
            
            // Get ALL accounts from chart of accounts
            const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 });
            console.log(`📋 Found ${allAccounts.length} active accounts in chart of accounts`);
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate },
                status: 'posted'
            });
            
            console.log(`📋 Found ${entries.length} transaction entries up to ${asOfDate}`);
            
            // Initialize ALL accounts with zero balances
            const accountBalances = {};
            allAccounts.forEach(account => {
                const key = `${account.code} - ${account.name}`;
                accountBalances[key] = {
                    code: account.code,
                    name: account.name,
                    type: account.type,
                    category: account.category,
                    balance: 0,
                    debit_total: 0,
                    credit_total: 0
                };
            });
            
            // Process transactions to calculate actual balances
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        
                        // Update balance if account exists in chart of accounts
                        if (accountBalances[key]) {
                            accountBalances[key].debit_total += debit;
                            accountBalances[key].credit_total += credit;
                            
                            // Calculate balance based on account type
                            if (accountType === 'Asset' || accountType === 'Expense') {
                                accountBalances[key].balance += debit - credit;
                            } else {
                                accountBalances[key].balance += credit - debit;
                            }
                        }
                    });
                }
            });
            
            // Group accounts by type
            const assets = {};
            const liabilities = {};
            const equity = {};
            const income = {};
            const expenses = {};
            
            Object.values(accountBalances).forEach(account => {
                const key = `${account.code} - ${account.name}`;
                
                switch (account.type) {
                    case 'Asset':
                        assets[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name,
                            category: account.category
                        };
                        break;
                    case 'Liability':
                        liabilities[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name,
                            category: account.category
                        };
                        break;
                    case 'Equity':
                        equity[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name,
                            category: account.category
                        };
                        break;
                    case 'Income':
                        income[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name,
                            category: account.category
                        };
                        break;
                    case 'Expense':
                        expenses[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name,
                            category: account.category
                        };
                        break;
                }
            });
            
            // Calculate totals
            const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
            const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
            const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
            
            // Calculate retained earnings
            const retainedEarnings = totalIncome - totalExpenses;
            
            console.log(`✅ FIXED Balance Sheet Summary as of ${asOfDate}:`);
            console.log(`  Total Assets: $${totalAssets}`);
            console.log(`  Total Liabilities: $${totalLiabilities}`);
            console.log(`  Total Equity: $${totalEquity + retainedEarnings}`);
            console.log(`  Retained Earnings: $${retainedEarnings}`);
            
            // Show key accounts
            const keyAccounts = [
                '1000 - Cash',
                '1001 - Bank Account',
                '10003 - Cbz Vault',
                '3001 - Owner Capital'
            ];
            
            console.log(`\n📊 Key Account Balances:`);
            keyAccounts.forEach(key => {
                if (assets[key]) {
                    console.log(`  ${assets[key].code} - ${assets[key].name}: $${assets[key].balance.toFixed(2)}`);
                } else if (equity[key]) {
                    console.log(`  ${equity[key].code} - ${equity[key].name}: $${equity[key].balance.toFixed(2)}`);
                }
            });
            
            return {
                asOf: asOfDate,
                basis,
                assets: {
                    ...assets,
                    total_assets: totalAssets
                },
                liabilities: {
                    ...liabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    retained_earnings: retainedEarnings,
                    total_equity: totalEquity + retainedEarnings
                },
                income: {
                    ...income,
                    total_income: totalIncome
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
                },
                transaction_count: entries.length,
                account_count: allAccounts.length,
                accounts_included: Object.keys(accountBalances).length
            };
            
        } catch (error) {
            console.error('❌ Error generating fixed balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Generate Monthly Balance Sheet with ALL accounts
     */
    static async generateMonthlyBalanceSheet(year, month, basis = 'cash') {
        try {
            // Calculate end of month date
            const endOfMonth = new Date(year, month, 0); // Last day of month
            const monthName = endOfMonth.toLocaleString('default', { month: 'long' });
            
            console.log(`🔧 Generating FIXED monthly balance sheet for ${monthName} ${year}`);
            
            return await this.generateFixedBalanceSheet(endOfMonth, basis);
            
        } catch (error) {
            console.error('❌ Error generating monthly balance sheet:', error);
            throw error;
        }
    }
}

module.exports = FixedBalanceSheetService;
