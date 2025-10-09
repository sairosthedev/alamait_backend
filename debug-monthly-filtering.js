require('dotenv').config();
const mongoose = require('mongoose');

async function debugMonthlyFiltering() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait');
        console.log('✅ Connected to database');
        
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        console.log('🔍 DEBUGGING MONTHLY FILTERING ISSUE...\n');
        
        // Check balance sheet as of September 30, 2025
        const septemberDate = new Date('2025-09-30T23:59:59.999Z');
        const asOfMonth = septemberDate.getMonth() + 1; // 9
        const asOfYear = septemberDate.getFullYear(); // 2025
        
        console.log(`📅 Analyzing balance sheet as of: ${septemberDate.toISOString().split('T')[0]}\n`);
        
        // Get all transactions up to September 30 (cumulative - correct approach)
        const cumulativeTransactions = await TransactionEntry.find({
            date: { $lte: septemberDate },
            status: 'posted'
        }).sort({ date: 1 });
        
        console.log(`📊 Found ${cumulativeTransactions.length} cumulative transactions up to September 30, 2025\n`);
        
        // Get only September transactions (monthly filtering - incorrect approach)
        const monthStart = new Date(Date.UTC(asOfYear, asOfMonth - 1, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(asOfYear, asOfMonth, 0, 23, 59, 59, 999));
        
        console.log(`📅 Monthly filter range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}\n`);
        
        const monthlyTransactions = await TransactionEntry.find({
            date: { $gte: monthStart, $lte: monthEnd },
            status: 'posted'
        }).sort({ date: 1 });
        
        console.log(`📊 Found ${monthlyTransactions.length} monthly transactions for September 2025\n`);
        
        // Find transactions that are in cumulative but not in monthly
        const cumulativeIds = new Set(cumulativeTransactions.map(tx => tx.transactionId));
        const monthlyIds = new Set(monthlyTransactions.map(tx => tx.transactionId));
        
        const missingFromMonthly = cumulativeTransactions.filter(tx => !monthlyIds.has(tx.transactionId));
        
        console.log(`📊 Transactions in cumulative but missing from monthly: ${missingFromMonthly.length}\n`);
        
        if (missingFromMonthly.length > 0) {
            console.log('📋 MISSING TRANSACTIONS:');
            missingFromMonthly.forEach((tx, index) => {
                console.log(`  ${index + 1}. ${tx.transactionId} - ${tx.date.toISOString().split('T')[0]} - ${tx.description}`);
                console.log(`     Source: ${tx.source}, Status: ${tx.status}`);
            });
        }
        
        // Find transactions that are in monthly but not in cumulative (shouldn't happen)
        const extraInMonthly = monthlyTransactions.filter(tx => !cumulativeIds.has(tx.transactionId));
        
        if (extraInMonthly.length > 0) {
            console.log(`\n📊 Transactions in monthly but missing from cumulative: ${extraInMonthly.length}\n`);
            console.log('📋 EXTRA TRANSACTIONS:');
            extraInMonthly.forEach((tx, index) => {
                console.log(`  ${index + 1}. ${tx.transactionId} - ${tx.date.toISOString().split('T')[0]} - ${tx.description}`);
                console.log(`     Source: ${tx.source}, Status: ${tx.status}`);
            });
        }
        
        // Calculate balance sheet for both approaches
        console.log('\n🔍 CALCULATING BALANCE SHEET FOR BOTH APPROACHES:\n');
        
        // Function to calculate balance sheet
        function calculateBalanceSheet(transactions) {
            let accountBalances = {};
            
            transactions.forEach(transaction => {
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
            
            // Calculate totals
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
            
            return {
                totalAssets,
                totalLiabilities,
                totalIncome,
                totalExpenses,
                totalEquity,
                balanceSheetDifference: totalAssets - (totalLiabilities + totalEquity)
            };
        }
        
        // Calculate for cumulative approach
        const cumulativeBalanceSheet = calculateBalanceSheet(cumulativeTransactions);
        
        console.log('📊 CUMULATIVE APPROACH (CORRECT):');
        console.log(`  Total Assets: $${cumulativeBalanceSheet.totalAssets.toFixed(2)}`);
        console.log(`  Total Liabilities: $${cumulativeBalanceSheet.totalLiabilities.toFixed(2)}`);
        console.log(`  Total Income: $${cumulativeBalanceSheet.totalIncome.toFixed(2)}`);
        console.log(`  Total Expenses: $${cumulativeBalanceSheet.totalExpenses.toFixed(2)}`);
        console.log(`  Total Equity: $${cumulativeBalanceSheet.totalEquity.toFixed(2)}`);
        console.log(`  Balance Sheet Difference: $${cumulativeBalanceSheet.balanceSheetDifference.toFixed(2)}`);
        
        // Calculate for monthly approach
        const monthlyBalanceSheet = calculateBalanceSheet(monthlyTransactions);
        
        console.log('\n📊 MONTHLY APPROACH (INCORRECT):');
        console.log(`  Total Assets: $${monthlyBalanceSheet.totalAssets.toFixed(2)}`);
        console.log(`  Total Liabilities: $${monthlyBalanceSheet.totalLiabilities.toFixed(2)}`);
        console.log(`  Total Income: $${monthlyBalanceSheet.totalIncome.toFixed(2)}`);
        console.log(`  Total Expenses: $${monthlyBalanceSheet.totalExpenses.toFixed(2)}`);
        console.log(`  Total Equity: $${monthlyBalanceSheet.totalEquity.toFixed(2)}`);
        console.log(`  Balance Sheet Difference: $${monthlyBalanceSheet.balanceSheetDifference.toFixed(2)}`);
        
        console.log('\n🔍 DIFFERENCES:');
        console.log(`  Assets: ${(cumulativeBalanceSheet.totalAssets - monthlyBalanceSheet.totalAssets).toFixed(2)}`);
        console.log(`  Liabilities: ${(cumulativeBalanceSheet.totalLiabilities - monthlyBalanceSheet.totalLiabilities).toFixed(2)}`);
        console.log(`  Equity: ${(cumulativeBalanceSheet.totalEquity - monthlyBalanceSheet.totalEquity).toFixed(2)}`);
        console.log(`  Difference: ${(cumulativeBalanceSheet.balanceSheetDifference - monthlyBalanceSheet.balanceSheetDifference).toFixed(2)}`);
        
        await mongoose.disconnect();
        console.log('\n✅ Monthly filtering debugging completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

debugMonthlyFiltering();







