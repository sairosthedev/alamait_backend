const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debug150Discrepancy() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Debugging the $150 balance sheet discrepancy in September 2025...');
        
        const septemberEndDate = new Date('2025-09-30T23:59:59.999Z');
        
        // Get all transactions up to September 30, 2025
        const allTransactions = await TransactionEntry.find({
            date: { $lte: septemberEndDate },
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`\nFound ${allTransactions.length} transactions up to September 30, 2025`);

        // Calculate balances for each account
        const accountBalances = {};
        
        allTransactions.forEach(transaction => {
            if (transaction.entries && Array.isArray(transaction.entries)) {
                transaction.entries.forEach(entry => {
                    const accountCode = entry.accountCode;
                    const debit = entry.debit || 0;
                    const credit = entry.credit || 0;
                    
                    if (!accountBalances[accountCode]) {
                        accountBalances[accountCode] = {
                            accountName: entry.accountName,
                            accountType: entry.accountType,
                            totalDebits: 0,
                            totalCredits: 0,
                            balance: 0
                        };
                    }
                    
                    accountBalances[accountCode].totalDebits += debit;
                    accountBalances[accountCode].totalCredits += credit;
                    
                    // Calculate balance based on account type
                    if (entry.accountType === 'Asset') {
                        accountBalances[accountCode].balance = accountBalances[accountCode].totalDebits - accountBalances[accountCode].totalCredits;
                    } else if (entry.accountType === 'Liability' || entry.accountType === 'Equity') {
                        accountBalances[accountCode].balance = accountBalances[accountCode].totalCredits - accountBalances[accountCode].totalDebits;
                    } else if (entry.accountType === 'Income') {
                        accountBalances[accountCode].balance = accountBalances[accountCode].totalCredits - accountBalances[accountCode].totalDebits;
                    } else if (entry.accountType === 'Expense') {
                        accountBalances[accountCode].balance = accountBalances[accountCode].totalDebits - accountBalances[accountCode].totalCredits;
                    }
                });
            }
        });

        console.log('\n📊 ACCOUNT BALANCES AS OF SEPTEMBER 30, 2025:');
        
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let totalIncome = 0;
        let totalExpenses = 0;
        
        // Group accounts by type
        const assetAccounts = [];
        const liabilityAccounts = [];
        const equityAccounts = [];
        const incomeAccounts = [];
        const expenseAccounts = [];
        
        Object.keys(accountBalances).forEach(accountCode => {
            const account = accountBalances[accountCode];
            const balance = account.balance;
            
            if (account.accountType === 'Asset') {
                assetAccounts.push({ code: accountCode, ...account, balance });
                totalAssets += balance;
            } else if (account.accountType === 'Liability') {
                liabilityAccounts.push({ code: accountCode, ...account, balance });
                totalLiabilities += balance;
            } else if (account.accountType === 'Equity') {
                equityAccounts.push({ code: accountCode, ...account, balance });
                totalEquity += balance;
            } else if (account.accountType === 'Income') {
                incomeAccounts.push({ code: accountCode, ...account, balance });
                totalIncome += balance;
            } else if (account.accountType === 'Expense') {
                expenseAccounts.push({ code: accountCode, ...account, balance });
                totalExpenses += balance;
            }
        });
        
        console.log('\n🏦 ASSETS:');
        assetAccounts.forEach(account => {
            if (account.balance !== 0) {
                console.log(`  ${account.code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            }
        });
        console.log(`  TOTAL ASSETS: $${totalAssets.toFixed(2)}`);
        
        console.log('\n💳 LIABILITIES:');
        liabilityAccounts.forEach(account => {
            if (account.balance !== 0) {
                console.log(`  ${account.code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            }
        });
        console.log(`  TOTAL LIABILITIES: $${totalLiabilities.toFixed(2)}`);
        
        console.log('\n🏛️ EQUITY:');
        equityAccounts.forEach(account => {
            if (account.balance !== 0) {
                console.log(`  ${account.code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            }
        });
        
        // Calculate retained earnings from income statement
        const netIncome = totalIncome - totalExpenses;
        console.log(`\n📈 INCOME STATEMENT ACCOUNTS:`);
        console.log(`  Total Income: $${totalIncome.toFixed(2)}`);
        console.log(`  Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`  Net Income: $${netIncome.toFixed(2)}`);
        
        const calculatedRetainedEarnings = totalEquity + netIncome;
        console.log(`  Calculated Retained Earnings: $${calculatedRetainedEarnings.toFixed(2)}`);
        console.log(`  TOTAL EQUITY (including net income): $${calculatedRetainedEarnings.toFixed(2)}`);
        
        console.log('\n⚖️ BALANCE SHEET EQUATION CHECK:');
        console.log(`Assets: $${totalAssets.toFixed(2)}`);
        console.log(`Liabilities + Equity: $${(totalLiabilities + calculatedRetainedEarnings).toFixed(2)}`);
        const difference = totalAssets - (totalLiabilities + calculatedRetainedEarnings);
        console.log(`Difference: $${difference.toFixed(2)}`);
        
        if (Math.abs(difference) > 0.01) {
            console.log(`\n❌ BALANCE SHEET IS OFF BY: $${difference.toFixed(2)}`);
            
            // Look for specific accounts that might be causing the issue
            console.log('\n🔍 LOOKING FOR POTENTIAL ISSUES:');
            
            // Check for unbalanced transactions
            console.log('\n📋 Checking for unbalanced transactions...');
            let unbalancedTransactions = [];
            
            allTransactions.forEach(transaction => {
                let totalDebits = 0;
                let totalCredits = 0;
                
                if (transaction.entries && Array.isArray(transaction.entries)) {
                    transaction.entries.forEach(entry => {
                        totalDebits += entry.debit || 0;
                        totalCredits += entry.credit || 0;
                    });
                }
                
                const transactionDifference = Math.abs(totalDebits - totalCredits);
                if (transactionDifference > 0.01) {
                    unbalancedTransactions.push({
                        id: transaction.transactionId,
                        date: transaction.date,
                        description: transaction.description,
                        totalDebits,
                        totalCredits,
                        difference: transactionDifference
                    });
                }
            });
            
            if (unbalancedTransactions.length > 0) {
                console.log(`Found ${unbalancedTransactions.length} unbalanced transactions:`);
                unbalancedTransactions.forEach(txn => {
                    console.log(`  ${txn.id} - ${txn.date.toISOString().split('T')[0]} - ${txn.description}`);
                    console.log(`    Debits: $${txn.totalDebits}, Credits: $${txn.totalCredits}, Difference: $${txn.difference}`);
                });
            } else {
                console.log('✅ All individual transactions are balanced');
            }
            
        } else {
            console.log('✅ Balance sheet is balanced!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debug150Discrepancy();





