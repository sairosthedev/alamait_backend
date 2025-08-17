// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function compareBeforeAfterMigration() {
    try {
        console.log('📊 BEFORE vs AFTER MIGRATION COMPARISON');
        console.log('========================================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Account = require('../src/models/Account');
        const Transaction = require('../src/models/Transaction');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Payment = require('../src/models/Payment');
        const Expense = require('../src/models/finance/Expense');
        const Vendor = require('../src/models/Vendor');
        const User = require('../src/models/User');
        
        // ========================================
        // BEFORE MIGRATION (Original Data)
        // ========================================
        console.log('🔴 BEFORE MIGRATION - ORIGINAL DATA');
        console.log('===================================');
        
        // Original Expenses Analysis
        console.log('\n💰 ORIGINAL EXPENSES:');
        console.log('---------------------');
        
        const originalExpenses = await Expense.find({});
        console.log(`Total Expenses: ${originalExpenses.length}`);
        
        let originalTotalExpenses = 0;
        let originalExpensesByCategory = {};
        let originalExpensesByVendor = {};
        let originalExpenseDetails = [];
        
        originalExpenses.forEach(expense => {
            const amount = expense.amount || 0;
            originalTotalExpenses += amount;
            
            const category = expense.category || expense.type || 'Uncategorized';
            originalExpensesByCategory[category] = (originalExpensesByCategory[category] || 0) + amount;
            
            const vendor = expense.vendor || expense.supplier || 'Unknown Vendor';
            originalExpensesByVendor[vendor] = (originalExpensesByVendor[vendor] || 0) + amount;
            
            originalExpenseDetails.push({
                id: expense._id,
                description: expense.description,
                amount: amount,
                category: category,
                vendor: vendor,
                date: expense.createdAt,
                status: expense.status || 'Unknown'
            });
        });
        
        console.log(`Total Amount: $${originalTotalExpenses.toFixed(2)}`);
        
        console.log('\n📋 Original Expenses by Category:');
        Object.entries(originalExpensesByCategory)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
                console.log(`  - ${category}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n🏢 Original Expenses by Vendor:');
        Object.entries(originalExpensesByVendor)
            .sort(([,a], [,b]) => b - a)
            .forEach(([vendor, amount]) => {
                console.log(`  - ${vendor}: $${amount.toFixed(2)}`);
            });
        
        // Original Income Analysis
        console.log('\n\n💵 ORIGINAL INCOME:');
        console.log('-------------------');
        
        const originalPayments = await Payment.find({});
        console.log(`Total Payments: ${originalPayments.length}`);
        
        let originalTotalIncome = 0;
        let originalIncomeByMethod = {};
        let originalIncomeByStudent = {};
        let originalPaymentDetails = [];
        
        originalPayments.forEach(payment => {
            const amount = payment.amount || 0;
            originalTotalIncome += amount;
            
            const method = payment.paymentMethod || 'Unknown Method';
            originalIncomeByMethod[method] = (originalIncomeByMethod[method] || 0) + amount;
            
            const student = payment.studentName || payment.studentId || 'Unknown Student';
            originalIncomeByStudent[student] = (originalIncomeByStudent[student] || 0) + amount;
            
            originalPaymentDetails.push({
                id: payment._id,
                studentName: payment.studentName,
                amount: amount,
                method: method,
                date: payment.createdAt,
                status: payment.status || 'Unknown'
            });
        });
        
        console.log(`Total Amount: $${originalTotalIncome.toFixed(2)}`);
        
        console.log('\n💳 Original Income by Payment Method:');
        Object.entries(originalIncomeByMethod)
            .sort(([,a], [,b]) => b - a)
            .forEach(([method, amount]) => {
                console.log(`  - ${method}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n👥 Original Income by Student:');
        Object.entries(originalIncomeByStudent)
            .sort(([,a], [,b]) => b - a)
            .forEach(([student, amount]) => {
                console.log(`  - ${student}: $${amount.toFixed(2)}`);
            });
        
        // ========================================
        // AFTER MIGRATION (New Double-Entry System)
        // ========================================
        console.log('\n\n🟢 AFTER MIGRATION - NEW DOUBLE-ENTRY SYSTEM');
        console.log('=============================================');
        
        // New Transaction Analysis
        console.log('\n📝 NEW TRANSACTIONS:');
        console.log('--------------------');
        
        const newTransactions = await Transaction.find({});
        console.log(`Total Transactions: ${newTransactions.length}`);
        
        let newTotalTransactionAmount = 0;
        let newTransactionsByType = {};
        let newTransactionDetails = [];
        
        newTransactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            newTotalTransactionAmount += amount;
            
            const type = transaction.type || 'Unknown';
            newTransactionsByType[type] = (newTransactionsByType[type] || 0) + 1;
            
            newTransactionDetails.push({
                id: transaction._id,
                transactionId: transaction.transactionId,
                description: transaction.description,
                amount: amount,
                type: type,
                date: transaction.date || transaction.createdAt,
                entries: transaction.entries || []
            });
        });
        
        console.log(`Total Transaction Amount: $${newTotalTransactionAmount.toFixed(2)}`);
        
        console.log('\n📋 New Transactions by Type:');
        Object.entries(newTransactionsByType)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`  - ${type}: ${count} transactions`);
            });
        
        // New Transaction Entries Analysis
        console.log('\n\n📊 NEW TRANSACTION ENTRIES:');
        console.log('---------------------------');
        
        const newTransactionEntries = await TransactionEntry.find({});
        console.log(`Total Transaction Entries: ${newTransactionEntries.length}`);
        
        let newTotalDebit = 0;
        let newTotalCredit = 0;
        let newEntriesBySource = {};
        let newEntryDetails = [];
        
        newTransactionEntries.forEach(entry => {
            newTotalDebit += entry.totalDebit || 0;
            newTotalCredit += entry.totalCredit || 0;
            
            const source = entry.source || 'Unknown';
            newEntriesBySource[source] = (newEntriesBySource[source] || 0) + 1;
            
            newEntryDetails.push({
                id: entry._id,
                transactionId: entry.transactionId,
                description: entry.description,
                totalDebit: entry.totalDebit || 0,
                totalCredit: entry.totalCredit || 0,
                source: source,
                date: entry.date || entry.createdAt,
                entries: entry.entries || []
            });
        });
        
        console.log(`Total Debits: $${newTotalDebit.toFixed(2)}`);
        console.log(`Total Credits: $${newTotalCredit.toFixed(2)}`);
        console.log(`Balance Check: ${newTotalDebit === newTotalCredit ? '✅ Balanced' : '❌ Unbalanced'}`);
        
        console.log('\n📋 New Entries by Source:');
        Object.entries(newEntriesBySource)
            .sort(([,a], [,b]) => b - a)
            .forEach(([source, count]) => {
                console.log(`  - ${source}: ${count} entries`);
            });
        
        // New Account Structure
        console.log('\n\n🏦 NEW ACCOUNT STRUCTURE:');
        console.log('-------------------------');
        
        const newAccounts = await Account.find({});
        console.log(`Total Accounts: ${newAccounts.length}`);
        
        let newAccountsByType = {};
        let newAccountDetails = [];
        
        newAccounts.forEach(account => {
            const type = account.type || 'Unknown';
            newAccountsByType[type] = (newAccountsByType[type] || 0) + 1;
            
            newAccountDetails.push({
                code: account.code,
                name: account.name,
                type: type,
                category: account.category,
                isActive: account.isActive
            });
        });
        
        console.log('\n📊 New Accounts by Type:');
        Object.entries(newAccountsByType)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`  - ${type}: ${count} accounts`);
            });
        
        // ========================================
        // COMPARISON SUMMARY
        // ========================================
        console.log('\n\n📊 COMPARISON SUMMARY');
        console.log('=====================');
        
        console.log('\n💰 EXPENSES COMPARISON:');
        console.log('----------------------');
        console.log(`Before Migration: $${originalTotalExpenses.toFixed(2)} (${originalExpenses.length} expenses)`);
        console.log(`After Migration:  $${newTotalTransactionAmount.toFixed(2)} (${newTransactions.length} transactions)`);
        console.log(`Difference:       $${(newTotalTransactionAmount - originalTotalExpenses).toFixed(2)}`);
        
        console.log('\n💵 INCOME COMPARISON:');
        console.log('--------------------');
        console.log(`Before Migration: $${originalTotalIncome.toFixed(2)} (${originalPayments.length} payments)`);
        console.log(`After Migration:  $${newTotalCredit.toFixed(2)} (${newTransactionEntries.length} entries)`);
        console.log(`Difference:       $${(newTotalCredit - originalTotalIncome).toFixed(2)}`);
        
        console.log('\n📈 NET INCOME COMPARISON:');
        console.log('-------------------------');
        const beforeNetIncome = originalTotalIncome - originalTotalExpenses;
        const afterNetIncome = newTotalCredit - newTotalDebit;
        console.log(`Before Migration: $${beforeNetIncome.toFixed(2)}`);
        console.log(`After Migration:  $${afterNetIncome.toFixed(2)}`);
        console.log(`Difference:       $${(afterNetIncome - beforeNetIncome).toFixed(2)}`);
        
        // ========================================
        // DETAILED LISTS
        // ========================================
        console.log('\n\n📋 DETAILED EXPENSE LIST (BEFORE):');
        console.log('===================================');
        originalExpenseDetails
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach((expense, index) => {
                console.log(`${index + 1}. ${expense.description}`);
                console.log(`   Amount: $${expense.amount.toFixed(2)}`);
                console.log(`   Category: ${expense.category}`);
                console.log(`   Vendor: ${expense.vendor}`);
                console.log(`   Date: ${new Date(expense.date).toLocaleDateString()}`);
                console.log(`   Status: ${expense.status}`);
                console.log('');
            });
        
        console.log('\n📋 DETAILED PAYMENT LIST (BEFORE):');
        console.log('===================================');
        originalPaymentDetails
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach((payment, index) => {
                console.log(`${index + 1}. ${payment.studentName || 'Unknown Student'}`);
                console.log(`   Amount: $${payment.amount.toFixed(2)}`);
                console.log(`   Method: ${payment.method}`);
                console.log(`   Date: ${new Date(payment.date).toLocaleDateString()}`);
                console.log(`   Status: ${payment.status}`);
                console.log('');
            });
        
        console.log('\n📋 DETAILED TRANSACTION LIST (AFTER):');
        console.log('=====================================');
        newTransactionDetails
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach((transaction, index) => {
                console.log(`${index + 1}. ${transaction.description}`);
                console.log(`   Transaction ID: ${transaction.transactionId}`);
                console.log(`   Amount: $${transaction.amount.toFixed(2)}`);
                console.log(`   Type: ${transaction.type}`);
                console.log(`   Date: ${new Date(transaction.date).toLocaleDateString()}`);
                console.log(`   Entries: ${transaction.entries.length}`);
                console.log('');
            });
        
        console.log('\n🎉 COMPARISON COMPLETE!');
        console.log('=======================');
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Comparison failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the comparison
compareBeforeAfterMigration(); 