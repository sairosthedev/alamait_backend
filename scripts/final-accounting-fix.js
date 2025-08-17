const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Expense = require('../src/models/finance/Expense');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await finalAccountingFix();
});

async function finalAccountingFix() {
    console.log('\n🔧 FINAL ACCOUNTING FIX');
    console.log('========================\n');

    try {
        // 1. Fix duplicate transaction references
        console.log('🔧 1. FIXING DUPLICATE TRANSACTION REFERENCES');
        console.log('==============================================');
        
        const duplicateRefs = await TransactionEntry.aggregate([
            { $group: { _id: '$reference', count: { $sum: 1 }, ids: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        console.log(`Found ${duplicateRefs.length} duplicate references`);

        for (const duplicate of duplicateRefs) {
            console.log(`  Processing: ${duplicate._id} (${duplicate.count} duplicates)`);
            
            // Keep the first one, delete the rest
            const [keepId, ...deleteIds] = duplicate.ids;
            
            if (deleteIds.length > 0) {
                await TransactionEntry.deleteMany({ _id: { $in: deleteIds } });
                console.log(`    ✅ Kept ${keepId}, deleted ${deleteIds.length} duplicates`);
            }
        }

        // 2. Fix negative asset balances by checking the logic
        console.log('\n🔧 2. ANALYZING NEGATIVE ASSET BALANCES');
        console.log('========================================');

        const assetAccounts = await Account.find({ type: 'asset' });
        
        for (const account of assetAccounts) {
            const transactionEntries = await TransactionEntry.find({});
            let balance = 0;
            
            transactionEntries.forEach(entry => {
                entry.entries.forEach(accEntry => {
                    if (accEntry.accountCode === account.code) {
                        balance += (accEntry.debit || 0) - (accEntry.credit || 0);
                    }
                });
            });
            
            if (balance < 0) {
                console.log(`  ❌ Negative balance in ${account.name}: $${balance.toFixed(2)}`);
                console.log(`    Account Code: ${account.code}`);
                console.log(`    This indicates incorrect transaction logic`);
            }
        }

        // 3. Check payment transactions
        console.log('\n🔧 3. VERIFYING PAYMENT TRANSACTIONS');
        console.log('=====================================');

        const payments = await Payment.find({});
        console.log(`Found ${payments.length} payments`);

        for (const payment of payments) {
            const transactionEntry = await TransactionEntry.findOne({ reference: payment.paymentId });
            
            if (!transactionEntry) {
                console.log(`  ❌ Missing transaction for payment: ${payment.paymentId}`);
            } else {
                console.log(`  ✅ Payment ${payment.paymentId} has transaction`);
            }
        }

        // 4. Check expense transactions
        console.log('\n🔧 4. VERIFYING EXPENSE TRANSACTIONS');
        console.log('=====================================');

        const expenses = await Expense.find({});
        console.log(`Found ${expenses.length} expenses`);

        for (const expense of expenses) {
            const approvalTxn = await TransactionEntry.findOne({ 
                source: 'manual', 
                sourceModel: 'Expense',
                reference: expense.expenseId 
            });
            
            const paymentTxn = await TransactionEntry.findOne({ 
                source: 'expense_payment', 
                reference: expense.expenseId 
            });

            console.log(`  ${expense.expenseId}:`);
            console.log(`    Approval: ${approvalTxn ? '✅' : '❌'}`);
            console.log(`    Payment: ${paymentTxn ? '✅' : '❌'} (${expense.paymentStatus === 'Paid' ? 'Expected' : 'Not Expected'})`);
        }

        // 5. Calculate final balance sheet
        console.log('\n🔧 5. CALCULATING FINAL BALANCE SHEET');
        console.log('=====================================');

        const allTransactionEntries = await TransactionEntry.find({});
        
        // Calculate account balances
        const accountBalances = {};
        
        allTransactionEntries.forEach(entry => {
            entry.entries.forEach(accEntry => {
                const accountKey = accEntry.accountCode;
                if (!accountBalances[accountKey]) {
                    accountBalances[accountKey] = 0;
                }
                accountBalances[accountKey] += (accEntry.debit || 0) - (accEntry.credit || 0);
            });
        });

        // Get account details
        const accounts = await Account.find({});
        const accountMap = {};
        accounts.forEach(acc => {
            accountMap[acc.code] = acc;
        });

        // Calculate totals by type
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let totalIncome = 0;
        let totalExpenses = 0;

        Object.entries(accountBalances).forEach(([code, balance]) => {
            const account = accountMap[code];
            if (account) {
                const accountType = account.type.toLowerCase();
                
                if (accountType === 'asset') {
                    totalAssets += balance;
                } else if (accountType === 'liability') {
                    totalLiabilities += balance;
                } else if (accountType === 'equity') {
                    totalEquity += balance;
                } else if (accountType === 'income') {
                    totalIncome += balance;
                } else if (accountType === 'expense') {
                    totalExpenses += balance;
                }
            }
        });

        console.log('\n📊 FINAL BALANCE SHEET:');
        console.log('========================');
        console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
        console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
        
        const balanceSheetDifference = totalAssets - (totalLiabilities + totalEquity);
        if (Math.abs(balanceSheetDifference) < 0.01) {
            console.log('✅ Balance Sheet is balanced!');
        } else {
            console.log(`❌ Balance Sheet is unbalanced! Difference: $${balanceSheetDifference.toFixed(2)}`);
        }

        console.log('\n📈 FINAL INCOME STATEMENT:');
        console.log('===========================');
        console.log(`Total Income: $${totalIncome.toFixed(2)}`);
        console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`Net Income: $${(totalIncome - totalExpenses).toFixed(2)}`);

        // 6. Show account details for debugging
        console.log('\n🔍 ACCOUNT BALANCES DETAIL:');
        console.log('===========================');
        
        Object.entries(accountBalances).forEach(([code, balance]) => {
            const account = accountMap[code];
            if (account && Math.abs(balance) > 0.01) {
                console.log(`${code} - ${account.name}: $${balance.toFixed(2)} (${account.type})`);
            }
        });

        // 7. Final recommendations
        console.log('\n🎯 FINAL RECOMMENDATIONS:');
        console.log('==========================');
        
        if (duplicateRefs.length > 0) {
            console.log('✅ Fixed duplicate transaction references');
        }
        
        if (totalAssets < 0) {
            console.log('⚠️  Negative asset balances indicate incorrect transaction logic');
            console.log('   Review payment and expense transaction creation');
        }
        
        if (Math.abs(balanceSheetDifference) > 0.01) {
            console.log('⚠️  Balance sheet is still unbalanced');
            console.log('   This may indicate missing transactions or incorrect logic');
        }

        console.log('\n✅ Final accounting fix completed');

    } catch (error) {
        console.error('❌ Error during final fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Final accounting fix completed');
    }
}

// Run the final fix
console.log('🚀 Starting Final Accounting Fix...'); 