const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const Account = require('./src/models/Account');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

// Direct MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function checkPaymentsAndAccounts() {
    try {
        console.log('🔍 Checking Payments and Accounts...');
        console.log('=' .repeat(60));
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Check all payments
        console.log('\n📋 All Payments in Database:');
        console.log('-'.repeat(50));
        
        const allPayments = await Payment.find({}).sort({ createdAt: -1 });
        console.log(`Total Payments: ${allPayments.length}`);
        
        if (allPayments.length > 0) {
            allPayments.slice(0, 5).forEach((payment, index) => {
                console.log(`\n${index + 1}. Payment ID: ${payment.paymentId}`);
                console.log(`   Student: ${payment.student}`);
                console.log(`   Residence: ${payment.residence}`);
                console.log(`   Total Amount: $${payment.totalAmount}`);
                console.log(`   Method: ${payment.method}`);
                console.log(`   Status: ${payment.status}`);
                console.log(`   Created At: ${payment.createdAt}`);
            });
            
            if (allPayments.length > 5) {
                console.log(`   ... and ${allPayments.length - 5} more payments`);
            }
        } else {
            console.log('✅ No payments found in database');
        }
        
        // Check all accounts
        console.log('\n🏦 All Accounts in Database:');
        console.log('-'.repeat(50));
        
        const allAccounts = await Account.find({}).sort({ code: 1 });
        console.log(`Total Accounts: ${allAccounts.length}`);
        
        if (allAccounts.length > 0) {
            allAccounts.forEach(account => {
                console.log(`   ${account.code}: ${account.name} (${account.type})`);
            });
        } else {
            console.log('❌ No accounts found in database');
        }
        
        // Check all transactions
        console.log('\n📊 All Transactions in Database:');
        console.log('-'.repeat(50));
        
        const allTransactions = await Transaction.find({}).sort({ createdAt: -1 });
        console.log(`Total Transactions: ${allTransactions.length}`);
        
        if (allTransactions.length > 0) {
            allTransactions.slice(0, 3).forEach((txn, index) => {
                console.log(`\n${index + 1}. Transaction ID: ${txn._id}`);
                console.log(`   Description: ${txn.description}`);
                console.log(`   Reference: ${txn.reference}`);
                console.log(`   Residence: ${txn.residence}`);
                console.log(`   Entries Count: ${txn.entries?.length || 0}`);
                console.log(`   Created At: ${txn.createdAt}`);
            });
            
            if (allTransactions.length > 3) {
                console.log(`   ... and ${allTransactions.length - 3} more transactions`);
            }
        } else {
            console.log('✅ No transactions found in database');
        }
        
        // Check all transaction entries
        console.log('\n📋 All Transaction Entries in Database:');
        console.log('-'.repeat(50));
        
        const allTransactionEntries = await TransactionEntry.find({}).sort({ createdAt: -1 });
        console.log(`Total Transaction Entries: ${allTransactionEntries.length}`);
        
        if (allTransactionEntries.length > 0) {
            allTransactionEntries.slice(0, 3).forEach((entry, index) => {
                console.log(`\n${index + 1}. Entry ID: ${entry._id}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   Debit: $${entry.debit || 0}`);
                console.log(`   Credit: $${entry.credit || 0}`);
                console.log(`   Account: ${entry.account}`);
                console.log(`   Residence: ${entry.residence}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Created At: ${entry.createdAt}`);
            });
            
            if (allTransactionEntries.length > 3) {
                console.log(`   ... and ${allTransactionEntries.length - 3} more entries`);
            }
        } else {
            console.log('✅ No transaction entries found in database');
        }
        
        // Summary
        console.log('\n📊 Summary:');
        console.log('=' .repeat(30));
        console.log(`Payments: ${allPayments.length}`);
        console.log(`Accounts: ${allAccounts.length}`);
        console.log(`Transactions: ${allTransactions.length}`);
        console.log(`Transaction Entries: ${allTransactionEntries.length}`);
        
        // Check if we have the required accounts for payment processing
        console.log('\n🔍 Required Accounts Check:');
        console.log('-'.repeat(50));
        
        const cashAccount = await Account.findOne({ code: '1015' });
        const bankAccount = await Account.findOne({ code: '1000' });
        const rentAccount = await Account.findOne({ code: '4000' });
        const arAccount = await Account.findOne({ code: '1100' });
        
        console.log(`Cash Account (1015): ${cashAccount ? '✅' : '❌'}`);
        console.log(`Bank Account (1000): ${bankAccount ? '✅' : '❌'}`);
        console.log(`Rental Income (4000): ${rentAccount ? '✅' : '❌'}`);
        console.log(`Accounts Receivable (1100): ${arAccount ? '✅' : '❌'}`);
        
        if (!cashAccount || !bankAccount || !rentAccount || !arAccount) {
            console.log('\n⚠️  Missing required accounts for payment processing!');
            console.log('   This is why transaction entries are not being created.');
        }
        
    } catch (error) {
        console.error('❌ Error checking payments and accounts:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the check
checkPaymentsAndAccounts();
