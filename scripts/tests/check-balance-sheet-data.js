const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Expense = require('./src/models/finance/Expense');
const Payment = require('./src/models/Payment');
const Debtor = require('./src/models/Debtor');
const Vendor = require('./src/models/Vendor');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await analyzeBalanceSheetData();
});

async function analyzeBalanceSheetData() {
    console.log('\n📊 BALANCE SHEET DATA ANALYSIS');
    console.log('================================\n');

    try {
        // 1. Get all transaction entries
        const transactionEntries = await TransactionEntry.find({});
        console.log(`📋 Total Transaction Entries: ${transactionEntries.length}`);

        // 2. Get all accounts
        const accounts = await Account.find({});
        console.log(`🏦 Total Accounts: ${accounts.length}`);

        // 3. Calculate account balances from transaction entries
        const accountBalances = {};
        
        transactionEntries.forEach(transaction => {
            transaction.entries.forEach(entry => {
                const accountCode = entry.accountCode;
                if (!accountBalances[accountCode]) {
                    accountBalances[accountCode] = {
                        accountName: entry.accountName,
                        accountType: entry.accountType,
                        debit: 0,
                        credit: 0,
                        balance: 0
                    };
                }
                
                accountBalances[accountCode].debit += entry.debit || 0;
                accountBalances[accountCode].credit += entry.credit || 0;
            });
        });

        // Calculate net balance for each account
        Object.keys(accountBalances).forEach(accountCode => {
            const account = accountBalances[accountCode];
            account.balance = account.debit - account.credit;
        });

        // 4. Categorize accounts by type
        const assets = {};
        const liabilities = {};
        const equity = {};
        const income = {};
        const expenses = {};

        Object.keys(accountBalances).forEach(accountCode => {
            const account = accountBalances[accountCode];
            const type = account.accountType?.toLowerCase();

            if (type === 'asset') {
                assets[accountCode] = account;
            } else if (type === 'liability') {
                liabilities[accountCode] = account;
            } else if (type === 'equity') {
                equity[accountCode] = account;
            } else if (type === 'income' || type === 'revenue') {
                income[accountCode] = account;
            } else if (type === 'expense') {
                expenses[accountCode] = account;
            }
        });

        // 5. Display Balance Sheet Structure
        console.log('🏦 BALANCE SHEET STRUCTURE');
        console.log('==========================');

        console.log('\n📈 ASSETS:');
        console.log('----------');
        let totalAssets = 0;
        Object.keys(assets).forEach(code => {
            const account = assets[code];
            console.log(`${code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            totalAssets += account.balance;
        });
        console.log(`Total Assets: $${totalAssets.toFixed(2)}`);

        console.log('\n📉 LIABILITIES:');
        console.log('---------------');
        let totalLiabilities = 0;
        Object.keys(liabilities).forEach(code => {
            const account = liabilities[code];
            console.log(`${code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            totalLiabilities += account.balance;
        });
        console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);

        console.log('\n💰 EQUITY:');
        console.log('----------');
        let totalEquity = 0;
        Object.keys(equity).forEach(code => {
            const account = equity[code];
            console.log(`${code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            totalEquity += account.balance;
        });
        console.log(`Total Equity: $${totalEquity.toFixed(2)}`);

        // 6. Check Balance Sheet Equation
        console.log('\n⚖️ BALANCE SHEET EQUATION CHECK:');
        console.log('================================');
        console.log(`Assets: $${totalAssets.toFixed(2)}`);
        console.log(`Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`Equity: $${totalEquity.toFixed(2)}`);
        console.log(`Liabilities + Equity: $${(totalLiabilities + totalEquity).toFixed(2)}`);
        
        const difference = totalAssets - (totalLiabilities + totalEquity);
        console.log(`Difference: $${difference.toFixed(2)}`);
        
        if (Math.abs(difference) < 0.01) {
            console.log('✅ Balance Sheet is balanced!');
        } else {
            console.log('❌ Balance Sheet is NOT balanced!');
        }

        // 7. Income Statement Summary
        console.log('\n📊 INCOME STATEMENT SUMMARY:');
        console.log('============================');

        console.log('\n💵 INCOME:');
        console.log('----------');
        let totalIncome = 0;
        Object.keys(income).forEach(code => {
            const account = income[code];
            console.log(`${code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            totalIncome += account.balance;
        });
        console.log(`Total Income: $${totalIncome.toFixed(2)}`);

        console.log('\n💸 EXPENSES:');
        console.log('------------');
        let totalExpenses = 0;
        Object.keys(expenses).forEach(code => {
            const account = expenses[code];
            console.log(`${code} - ${account.accountName}: $${account.balance.toFixed(2)}`);
            totalExpenses += account.balance;
        });
        console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);

        const netIncome = totalIncome - totalExpenses;
        console.log(`\nNet Income: $${netIncome.toFixed(2)}`);

        // 8. Transaction Analysis
        console.log('\n📋 TRANSACTION ANALYSIS:');
        console.log('========================');

        const transactionTypes = {};
        transactionEntries.forEach(transaction => {
            const source = transaction.source;
            if (!transactionTypes[source]) {
                transactionTypes[source] = 0;
            }
            transactionTypes[source]++;
        });

        console.log('\nTransaction Types:');
        Object.keys(transactionTypes).forEach(type => {
            console.log(`${type}: ${transactionTypes[type]} transactions`);
        });

        // 9. Account Details
        console.log('\n🏦 ACCOUNT DETAILS:');
        console.log('===================');
        
        Object.keys(accountBalances).forEach(code => {
            const account = accountBalances[code];
            console.log(`${code} - ${account.accountName} (${account.accountType})`);
            console.log(`  Debits: $${account.debit.toFixed(2)}`);
            console.log(`  Credits: $${account.credit.toFixed(2)}`);
            console.log(`  Balance: $${account.balance.toFixed(2)}`);
            console.log('');
        });

        // 10. Summary
        console.log('\n📝 SUMMARY:');
        console.log('===========');
        console.log(`✅ Total Transaction Entries: ${transactionEntries.length}`);
        console.log(`✅ Total Accounts with Activity: ${Object.keys(accountBalances).length}`);
        console.log(`✅ Total Assets: $${totalAssets.toFixed(2)}`);
        console.log(`✅ Total Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`✅ Total Equity: $${totalEquity.toFixed(2)}`);
        console.log(`✅ Net Income: $${netIncome.toFixed(2)}`);
        
        if (Math.abs(difference) < 0.01) {
            console.log('✅ Balance Sheet Equation: Assets = Liabilities + Equity ✓');
        } else {
            console.log('❌ Balance Sheet Equation: Assets ≠ Liabilities + Equity ✗');
        }

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Balance sheet analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Balance Sheet Data Analysis...'); 