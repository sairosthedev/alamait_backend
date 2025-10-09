require('dotenv').config();
const mongoose = require('mongoose');

async function verifyBalanceSheetAPI() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait');
        console.log('✅ Connected to database');
        
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        console.log('🔍 VERIFYING BALANCE SHEET API CALCULATION...\n');
        
        // Check balance sheet as of September 30, 2025
        const septemberDate = new Date('2025-09-30T23:59:59.999Z');
        
        console.log(`📅 Analyzing balance sheet as of: ${septemberDate.toISOString().split('T')[0]}\n`);
        
        // Get all transactions up to September 30
        const allTransactions = await TransactionEntry.find({
            date: { $lte: septemberDate },
            status: 'posted'
        }).sort({ date: 1 });
        
        console.log(`📊 Found ${allTransactions.length} transactions up to September 30, 2025\n`);
        
        // Calculate balance sheet manually using the same logic as the API
        let accountBalances = {};
        
        allTransactions.forEach(transaction => {
            if (transaction.entries && Array.isArray(transaction.entries)) {
                transaction.entries.forEach(entry => {
                    const accountCode = entry.accountCode;
                    const debit = entry.debit || 0;
                    const credit = entry.credit || 0;
                    
                    if (!accountBalances[accountCode]) {
                        accountBalances[accountCode] = {
                            code: accountCode,
                            name: entry.accountName,
                            type: entry.accountType,
                            debitTotal: 0,
                            creditTotal: 0,
                            balance: 0
                        };
                    }
                    
                    accountBalances[accountCode].debitTotal += debit;
                    accountBalances[accountCode].creditTotal += credit;
                });
            }
        });
        
        // Calculate net balance for each account
        Object.values(accountBalances).forEach(account => {
            switch (account.type) {
                case 'Asset':
                    account.balance = account.debitTotal - account.creditTotal;
                    break;
                case 'Liability':
                    account.balance = account.creditTotal - account.debitTotal;
                    break;
                case 'Equity':
                    account.balance = account.creditTotal - account.debitTotal;
                    break;
                case 'Income':
                    account.balance = account.creditTotal - account.debitTotal;
                    break;
                case 'Expense':
                    account.balance = account.debitTotal - account.creditTotal;
                    break;
            }
        });
        
        // Calculate balance sheet totals
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalIncome = 0;
        let totalExpenses = 0;
        
        Object.values(accountBalances).forEach(account => {
            if (account.type === 'Asset') {
                totalAssets += account.balance;
            } else if (account.type === 'Liability') {
                totalLiabilities += account.balance;
            } else if (account.type === 'Income') {
                totalIncome += account.balance;
            } else if (account.type === 'Expense') {
                totalExpenses += account.balance;
            }
        });
        
        const netIncome = totalIncome - totalExpenses;
        const totalEquity = netIncome;
        
        console.log('📊 MANUAL BALANCE SHEET CALCULATION:');
        console.log(`  Total Assets: $${totalAssets.toFixed(2)}`);
        console.log(`  Total Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`  Total Income: $${totalIncome.toFixed(2)}`);
        console.log(`  Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`  Net Income: $${netIncome.toFixed(2)}`);
        console.log(`  Total Equity: $${totalEquity.toFixed(2)}`);
        
        const balanceSheetDifference = totalAssets - (totalLiabilities + totalEquity);
        console.log(`  Balance Sheet Difference: $${balanceSheetDifference.toFixed(2)}`);
        
        console.log('\n📊 API RESPONSE VALUES:');
        console.log(`  Total Assets: $23,098.04`);
        console.log(`  Total Liabilities: $12,666.00`);
        console.log(`  Total Equity: $10,242.04`);
        console.log(`  Balance Sheet Difference: $190.00`);
        
        console.log('\n🔍 COMPARISON:');
        console.log(`  Assets: Manual $${totalAssets.toFixed(2)} vs API $23,098.04 = Difference $${(totalAssets - 23098.04).toFixed(2)}`);
        console.log(`  Liabilities: Manual $${totalLiabilities.toFixed(2)} vs API $12,666.00 = Difference $${(totalLiabilities - 12666).toFixed(2)}`);
        console.log(`  Equity: Manual $${totalEquity.toFixed(2)} vs API $10,242.04 = Difference $${(totalEquity - 10242.04).toFixed(2)}`);
        console.log(`  Difference: Manual $${balanceSheetDifference.toFixed(2)} vs API $190.00 = Difference $${(balanceSheetDifference - 190).toFixed(2)}`);
        
        // Check if there's a discrepancy in the forfeiture income
        console.log('\n🔍 CHECKING FORFEITURE INCOME SPECIFICALLY:');
        
        let forfeitureIncome = 0;
        Object.values(accountBalances).forEach(account => {
            if (account.code === '4003' && account.type === 'Income') {
                forfeitureIncome = account.balance;
                console.log(`  Account 4003 (Forfeited Deposits Income):`);
                console.log(`    Debits: $${account.debitTotal.toFixed(2)}`);
                console.log(`    Credits: $${account.creditTotal.toFixed(2)}`);
                console.log(`    Balance: $${account.balance.toFixed(2)}`);
            }
        });
        
        console.log(`  Total Forfeiture Income: $${forfeitureIncome.toFixed(2)}`);
        console.log(`  Expected: $100.00 (2 × $50 deposits)`);
        
        if (Math.abs(forfeitureIncome - 100) < 0.01) {
            console.log('  ✅ Forfeiture income is correct');
        } else {
            console.log(`  ❌ Forfeiture income is incorrect. Difference: $${(forfeitureIncome - 100).toFixed(2)}`);
        }
        
        // Check if the issue is in the balance sheet service logic
        console.log('\n🔍 CHECKING IF THE ISSUE IS IN BALANCE SHEET SERVICE LOGIC:');
        
        // The API shows equity as $10,242.04 but our manual calculation shows $10,342.04
        // This suggests the balance sheet service is using different logic
        
        console.log(`  Manual Equity Calculation: $${totalEquity.toFixed(2)}`);
        console.log(`  API Equity Calculation: $10,242.04`);
        console.log(`  Difference: $${(totalEquity - 10242.04).toFixed(2)}`);
        
        if (Math.abs(totalEquity - 10242.04) > 0.01) {
            console.log('  ❌ The balance sheet service is using different calculation logic!');
            console.log('  🔍 The service might be:');
            console.log('    1. Using cached data');
            console.log('    2. Using different date filtering');
            console.log('    3. Using different account aggregation logic');
            console.log('    4. Missing some transactions');
        } else {
            console.log('  ✅ The balance sheet service calculation matches manual calculation');
        }
        
        // Check if there are any transactions that might be missing from the service
        console.log('\n🔍 CHECKING FOR MISSING TRANSACTIONS:');
        
        // Look for any transactions that might not be included in the service calculation
        const recentTransactions = allTransactions.filter(tx => 
            tx.date >= new Date('2025-09-15') && tx.date <= septemberDate
        );
        
        console.log(`  Found ${recentTransactions.length} transactions from September 15-30, 2025`);
        
        recentTransactions.forEach(tx => {
            console.log(`    ${tx.transactionId} - ${tx.date.toISOString().split('T')[0]} - ${tx.description}`);
            console.log(`      Source: ${tx.source}, Status: ${tx.status}`);
        });
        
        await mongoose.disconnect();
        console.log('\n✅ Balance sheet API verification completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyBalanceSheetAPI();







