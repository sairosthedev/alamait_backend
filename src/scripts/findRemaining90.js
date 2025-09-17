const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function findRemaining90() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Looking for the remaining $90 discrepancy...');
        console.log('We know $60 comes from the unbalanced forfeiture transaction.');
        console.log('We need to find where the other $90 is coming from.\n');
        
        // Let's look at all transactions from September specifically
        // since that's when the balance sheet starts showing "Off by $150"
        
        const septemberStart = new Date('2025-09-01T00:00:00.000Z');
        const septemberEnd = new Date('2025-09-30T23:59:59.999Z');
        
        const septemberTransactions = await TransactionEntry.find({
            date: { $gte: septemberStart, $lte: septemberEnd },
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${septemberTransactions.length} transactions in September 2025`);
        
        console.log('\n📋 September 2025 Transactions:');
        let totalSeptemberImbalance = 0;
        
        septemberTransactions.forEach((transaction, index) => {
            let totalDebits = 0;
            let totalCredits = 0;
            
            if (transaction.entries && Array.isArray(transaction.entries)) {
                transaction.entries.forEach(entry => {
                    totalDebits += entry.debit || 0;
                    totalCredits += entry.credit || 0;
                });
            }
            
            const difference = totalCredits - totalDebits; // Net effect on balance
            totalSeptemberImbalance += difference;
            
            console.log(`${index + 1}. ${transaction.transactionId} - ${transaction.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${transaction.description}`);
            console.log(`   Debits: $${totalDebits}, Credits: $${totalCredits}, Net: $${difference}`);
            
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                console.log(`   ⚠️  UNBALANCED by $${Math.abs(totalDebits - totalCredits)}`);
            }
        });
        
        console.log(`\n📊 Total net effect from September transactions: $${totalSeptemberImbalance}`);
        
        // Let's also check if there are any transactions with unusual patterns
        console.log('\n🔍 Looking for other potential issues...');
        
        // Check for transactions with very large amounts that might be incorrect
        const largeTransactions = await TransactionEntry.find({
            status: 'posted',
            $or: [
                { 'entries.debit': { $gt: 1000 } },
                { 'entries.credit': { $gt: 1000 } }
            ]
        });
        
        if (largeTransactions.length > 0) {
            console.log(`\n💰 Found ${largeTransactions.length} transactions with amounts > $1000:`);
            largeTransactions.forEach((transaction, index) => {
                console.log(`${index + 1}. ${transaction.transactionId} - ${transaction.date.toISOString().split('T')[0]}`);
                console.log(`   Description: ${transaction.description}`);
                
                transaction.entries.forEach(entry => {
                    if ((entry.debit || 0) > 1000 || (entry.credit || 0) > 1000) {
                        console.log(`   ${entry.accountCode} - ${entry.accountName}: Debit $${entry.debit || 0}, Credit $${entry.credit || 0}`);
                    }
                });
            });
        }
        
        // Check for duplicate transactions that might be causing issues
        console.log('\n🔍 Checking for potential duplicate transactions...');
        
        const allTransactions = await TransactionEntry.find({
            status: 'posted'
        });
        
        const transactionsByDescription = {};
        const potentialDuplicates = [];
        
        allTransactions.forEach(transaction => {
            const key = `${transaction.description}_${transaction.totalDebit}_${transaction.totalCredit}`;
            
            if (transactionsByDescription[key]) {
                transactionsByDescription[key].push(transaction);
            } else {
                transactionsByDescription[key] = [transaction];
            }
        });
        
        Object.keys(transactionsByDescription).forEach(key => {
            if (transactionsByDescription[key].length > 1) {
                potentialDuplicates.push({
                    description: transactionsByDescription[key][0].description,
                    count: transactionsByDescription[key].length,
                    transactions: transactionsByDescription[key]
                });
            }
        });
        
        if (potentialDuplicates.length > 0) {
            console.log(`Found ${potentialDuplicates.length} sets of potential duplicate transactions:`);
            potentialDuplicates.forEach((duplicate, index) => {
                console.log(`${index + 1}. "${duplicate.description}" appears ${duplicate.count} times:`);
                duplicate.transactions.forEach(txn => {
                    console.log(`   ${txn.transactionId} - ${txn.date.toISOString().split('T')[0]}`);
                });
            });
        } else {
            console.log('✅ No obvious duplicate transactions found');
        }
        
        // Let's also check the account balances calculation to see if there's a systematic error
        console.log('\n🔍 Checking account balance calculation logic...');
        
        // Calculate the balance equation manually
        const asOfDate = new Date('2025-09-30T23:59:59.999Z');
        
        const allTransactionsUpToSept = await TransactionEntry.find({
            date: { $lte: asOfDate },
            status: 'posted'
        });
        
        let totalAssetBalance = 0;
        let totalLiabilityBalance = 0;
        let totalEquityBalance = 0;
        let totalIncomeBalance = 0;
        let totalExpenseBalance = 0;
        
        allTransactionsUpToSept.forEach(transaction => {
            if (transaction.entries && Array.isArray(transaction.entries)) {
                transaction.entries.forEach(entry => {
                    const debit = entry.debit || 0;
                    const credit = entry.credit || 0;
                    
                    if (entry.accountType === 'Asset') {
                        totalAssetBalance += (debit - credit);
                    } else if (entry.accountType === 'Liability') {
                        totalLiabilityBalance += (credit - debit);
                    } else if (entry.accountType === 'Equity') {
                        totalEquityBalance += (credit - debit);
                    } else if (entry.accountType === 'Income') {
                        totalIncomeBalance += (credit - debit);
                    } else if (entry.accountType === 'Expense') {
                        totalExpenseBalance += (debit - credit);
                    }
                });
            }
        });
        
        const netIncome = totalIncomeBalance - totalExpenseBalance;
        const totalEquityWithIncome = totalEquityBalance + netIncome;
        
        console.log('\n⚖️ Manual Balance Sheet Calculation:');
        console.log(`Assets: $${totalAssetBalance.toFixed(2)}`);
        console.log(`Liabilities: $${totalLiabilityBalance.toFixed(2)}`);
        console.log(`Equity (before net income): $${totalEquityBalance.toFixed(2)}`);
        console.log(`Income: $${totalIncomeBalance.toFixed(2)}`);
        console.log(`Expenses: $${totalExpenseBalance.toFixed(2)}`);
        console.log(`Net Income: $${netIncome.toFixed(2)}`);
        console.log(`Total Equity (with net income): $${totalEquityWithIncome.toFixed(2)}`);
        
        const balanceSheetDifference = totalAssetBalance - (totalLiabilityBalance + totalEquityWithIncome);
        console.log(`\nBalance Sheet Difference: $${balanceSheetDifference.toFixed(2)}`);
        
        if (Math.abs(balanceSheetDifference - 150) < 1) {
            console.log('✅ This matches the $150 discrepancy in your balance sheet!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

findRemaining90();


