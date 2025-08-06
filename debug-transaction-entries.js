const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Expense = require('./src/models/finance/Expense');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await debugTransactionEntries();
});

async function debugTransactionEntries() {
    console.log('\n🔍 DEBUGGING TRANSACTION ENTRIES');
    console.log('=================================\n');

    try {
        // 1. Check all transaction entries
        console.log('📋 1. ALL TRANSACTION ENTRIES');
        console.log('=============================');
        
        const allTransactionEntries = await TransactionEntry.find({});
        console.log(`Total transaction entries: ${allTransactionEntries.length}`);
        
        allTransactionEntries.forEach((entry, index) => {
            console.log(`\n${index + 1}. Transaction Entry:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Transaction ID: ${entry.transactionId}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Source Model: ${entry.sourceModel}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Total Debit: $${entry.totalDebit}`);
            console.log(`   Total Credit: $${entry.totalCredit}`);
            console.log(`   Created By: ${entry.createdBy}`);
            console.log(`   Metadata:`, entry.metadata);
            
            console.log(`   Entries:`);
            entry.entries.forEach((e, i) => {
                console.log(`     ${i + 1}. ${e.accountCode} - ${e.accountName}: Dr. $${e.debit} Cr. $${e.credit}`);
            });
        });

        // 2. Check maintenance expenses
        console.log('\n📋 2. MAINTENANCE EXPENSES');
        console.log('==========================');
        
        const expenses = await Expense.find({
            category: { $in: ['Maintenance', 'maintenance'] }
        });
        
        console.log(`Total maintenance expenses: ${expenses.length}`);
        
        expenses.forEach((expense, index) => {
            console.log(`\n${index + 1}. Expense:`);
            console.log(`   ID: ${expense._id}`);
            console.log(`   Expense ID: ${expense.expenseId}`);
            console.log(`   Title: ${expense.title}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Category: ${expense.category}`);
            console.log(`   Transaction ID: ${expense.transactionId}`);
            console.log(`   Request ID: ${expense.requestId}`);
            console.log(`   Monthly Request ID: ${expense.monthlyRequestId}`);
        });

        // 3. Check for specific transaction entries
        console.log('\n📋 3. SEARCHING FOR MAINTENANCE TRANSACTIONS');
        console.log('=============================================');
        
        // Search by different criteria
        const sourceExpensePayment = await TransactionEntry.find({ source: 'expense_payment' });
        console.log(`Entries with source 'expense_payment': ${sourceExpensePayment.length}`);
        
        const sourceModelRequest = await TransactionEntry.find({ sourceModel: 'Request' });
        console.log(`Entries with sourceModel 'Request': ${sourceModelRequest.length}`);
        
        const sourceModelExpense = await TransactionEntry.find({ sourceModel: 'Expense' });
        console.log(`Entries with sourceModel 'Expense': ${sourceModelExpense.length}`);
        
        const hasMetadata = await TransactionEntry.find({ 'metadata.requestType': { $exists: true } });
        console.log(`Entries with metadata.requestType: ${hasMetadata.length}`);
        
        const maintenanceMetadata = await TransactionEntry.find({ 'metadata.requestType': 'maintenance' });
        console.log(`Entries with metadata.requestType 'maintenance': ${maintenanceMetadata.length}`);

        // 4. Check if transaction IDs match
        console.log('\n📋 4. TRANSACTION ID MATCHING');
        console.log('=============================');
        
        let matchedTransactions = 0;
        let unmatchedExpenses = 0;
        
        expenses.forEach(expense => {
            if (expense.transactionId) {
                const matchingTransaction = allTransactionEntries.find(t => 
                    t._id.toString() === expense.transactionId.toString()
                );
                
                if (matchingTransaction) {
                    matchedTransactions++;
                    console.log(`✅ Expense ${expense.expenseId} matches transaction ${matchingTransaction.transactionId}`);
                } else {
                    unmatchedExpenses++;
                    console.log(`❌ Expense ${expense.expenseId} has transactionId ${expense.transactionId} but no matching transaction found`);
                }
            } else {
                unmatchedExpenses++;
                console.log(`❌ Expense ${expense.expenseId} has no transactionId`);
            }
        });
        
        console.log(`\n📊 MATCHING SUMMARY:`);
        console.log(`   Matched transactions: ${matchedTransactions}`);
        console.log(`   Unmatched expenses: ${unmatchedExpenses}`);

        // 5. Calculate totals
        console.log('\n📋 5. TOTAL CALCULATIONS');
        console.log('========================');
        
        let totalExpenseAmount = 0;
        expenses.forEach(expense => {
            totalExpenseAmount += expense.amount || 0;
        });
        
        let totalTransactionAmount = 0;
        allTransactionEntries.forEach(entry => {
            const debitTotal = entry.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            totalTransactionAmount += debitTotal;
        });
        
        console.log(`Total expense amount: $${totalExpenseAmount.toFixed(2)}`);
        console.log(`Total transaction amount: $${totalTransactionAmount.toFixed(2)}`);
        console.log(`Difference: $${(totalExpenseAmount - totalTransactionAmount).toFixed(2)}`);

    } catch (error) {
        console.error('❌ Error during debugging:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Transaction entries debugging completed');
    }
}

// Run the debugging
console.log('🚀 Starting Transaction Entries Debugging...'); 