const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await checkPaidExpenseTransactions();
});

async function checkPaidExpenseTransactions() {
    console.log('\n🔍 CHECKING PAID EXPENSE TRANSACTIONS');
    console.log('=====================================\n');

    try {
        // Get all paid expenses
        const paidExpenses = await Expense.find({ paymentStatus: 'Paid' });
        console.log(`📊 Found ${paidExpenses.length} paid expenses`);

        for (const expense of paidExpenses) {
            console.log(`\n📋 EXPENSE: ${expense.expenseId}`);
            console.log(`   Description: ${expense.description}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Payment Status: ${expense.paymentStatus}`);
            console.log(`   Payment Method: ${expense.paymentMethod || 'N/A'}`);
            console.log(`   Paid Date: ${expense.paidDate || 'N/A'}`);

            // Find transaction entries for this expense
            const transactionEntries = await TransactionEntry.find({
                $or: [
                    { reference: expense.expenseId },
                    { sourceId: expense._id }
                ]
            });

            console.log(`   Transaction Entries Found: ${transactionEntries.length}`);

            transactionEntries.forEach((entry, index) => {
                console.log(`\n   📝 Transaction Entry ${index + 1}:`);
                console.log(`      Transaction ID: ${entry.transactionId}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Source: ${entry.source}`);
                console.log(`      Reference: ${entry.reference}`);
                console.log(`      Date: ${entry.date}`);
                console.log(`      Total Debit: $${entry.totalDebit}`);
                console.log(`      Total Credit: $${entry.totalCredit}`);
                
                console.log(`      📊 Account Entries:`);
                entry.entries.forEach((accEntry, accIndex) => {
                    console.log(`         ${accIndex + 1}. ${accEntry.accountCode} - ${accEntry.accountName}`);
                    console.log(`            Debit: $${accEntry.debit || 0}, Credit: $${accEntry.credit || 0}`);
                    console.log(`            Description: ${accEntry.description}`);
                });
            });

            console.log('   ' + '='.repeat(50));
        }

        // Now let's check what accounts are being affected
        console.log('\n🏦 ACCOUNT ANALYSIS FOR PAID EXPENSES:');
        console.log('======================================');

        const allTransactionEntries = await TransactionEntry.find({
            sourceModel: 'Expense'
        });

        const accountTotals = {};

        allTransactionEntries.forEach(entry => {
            entry.entries.forEach(accEntry => {
                const accountKey = `${accEntry.accountCode} - ${accEntry.accountName}`;
                if (!accountTotals[accountKey]) {
                    accountTotals[accountKey] = { debit: 0, credit: 0 };
                }
                accountTotals[accountKey].debit += accEntry.debit || 0;
                accountTotals[accountKey].credit += accEntry.credit || 0;
            });
        });

        console.log('\n📊 TOTAL IMPACT ON ACCOUNTS:');
        Object.entries(accountTotals).forEach(([account, totals]) => {
            console.log(`${account}:`);
            console.log(`   Total Debits: $${totals.debit.toFixed(2)}`);
            console.log(`   Total Credits: $${totals.credit.toFixed(2)}`);
            console.log(`   Net Impact: $${(totals.debit - totals.credit).toFixed(2)}`);
            console.log('');
        });

        // Check if there are any payment transactions (should be separate from approval transactions)
        console.log('\n💳 PAYMENT TRANSACTION CHECK:');
        console.log('============================');

        const paymentTransactions = await TransactionEntry.find({
            source: 'expense_payment'
        });

        console.log(`Payment Transactions Found: ${paymentTransactions.length}`);

        if (paymentTransactions.length > 0) {
            paymentTransactions.forEach((payment, index) => {
                console.log(`\nPayment Transaction ${index + 1}:`);
                console.log(`   Description: ${payment.description}`);
                console.log(`   Amount: $${payment.totalDebit}`);
                console.log(`   Date: ${payment.date}`);
                
                payment.entries.forEach((entry, entryIndex) => {
                    console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
                    console.log(`      Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
                });
            });
        } else {
            console.log('❌ No separate payment transactions found');
            console.log('   This means expenses are being marked as paid without creating payment transactions');
        }

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Paid Expense Transaction Analysis...'); 