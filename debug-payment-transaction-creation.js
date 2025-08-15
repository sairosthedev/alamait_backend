const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const Account = require('./src/models/Account');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

// Direct MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugPaymentTransactionCreation() {
    try {
        console.log('🔍 Debugging Payment Transaction Creation...');
        console.log('=' .repeat(60));
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Check the specific payment
        const paymentId = 'PAY-1755223730859';
        const payment = await Payment.findOne({ paymentId });
        
        if (!payment) {
            console.log(`❌ Payment not found: ${paymentId}`);
            return;
        }
        
        console.log('\n📋 Payment Details:');
        console.log('-'.repeat(50));
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`Student: ${payment.student}`);
        console.log(`Residence: ${payment.residence}`);
        console.log(`Total Amount: $${payment.totalAmount}`);
        console.log(`Method: ${payment.method}`);
        console.log(`Status: ${payment.status}`);
        console.log(`Created At: ${payment.createdAt}`);
        
        // Check if accounts exist
        console.log('\n🏦 Checking Required Accounts:');
        console.log('-'.repeat(50));
        
        // Check receiving account (Cash/Bank)
        let receivingAccount = null;
        if (payment.method && payment.method.toLowerCase().includes('bank')) {
            receivingAccount = await Account.findOne({ code: '1000' }); // Bank
            console.log(`Bank Account (1000): ${receivingAccount ? '✅ Found' : '❌ Not Found'}`);
        } else if (payment.method && payment.method.toLowerCase().includes('cash')) {
            receivingAccount = await Account.findOne({ code: '1015' }); // Cash
            console.log(`Cash Account (1015): ${receivingAccount ? '✅ Found' : '❌ Not Found'}`);
        }
        
        if (receivingAccount) {
            console.log(`   Account Name: ${receivingAccount.name}`);
            console.log(`   Account Type: ${receivingAccount.type}`);
            console.log(`   Account ID: ${receivingAccount._id}`);
        }
        
        // Check rent account
        const rentAccount = await Account.findOne({ code: '4000' }); // Rental Income
        console.log(`Rental Income Account (4000): ${rentAccount ? '✅ Found' : '❌ Not Found'}`);
        if (rentAccount) {
            console.log(`   Account Name: ${rentAccount.name}`);
            console.log(`   Account Type: ${rentAccount.type}`);
            console.log(`   Account ID: ${rentAccount._id}`);
        }
        
        // Check student account (Accounts Receivable)
        const studentAccount = await Account.findOne({ code: '1100' }); // Accounts Receivable
        console.log(`Accounts Receivable Account (1100): ${studentAccount ? '✅ Found' : '❌ Not Found'}`);
        if (studentAccount) {
            console.log(`   Account Name: ${studentAccount.name}`);
            console.log(`   Account Type: ${studentAccount.type}`);
            console.log(`   Account ID: ${studentAccount._id}`);
        }
        
        // Check if transaction was created
        console.log('\n📊 Checking Transaction Creation:');
        console.log('-'.repeat(50));
        
        const transaction = await Transaction.findOne({ reference: payment.paymentId });
        if (transaction) {
            console.log(`✅ Transaction Found: ${transaction._id}`);
            console.log(`   Description: ${transaction.description}`);
            console.log(`   Date: ${transaction.date}`);
            console.log(`   Residence: ${transaction.residence}`);
            console.log(`   Entries Count: ${transaction.entries?.length || 0}`);
        } else {
            console.log(`❌ No Transaction Found for Payment: ${payment.paymentId}`);
        }
        
        // Check if transaction entries were created
        console.log('\n📋 Checking Transaction Entries:');
        console.log('-'.repeat(50));
        
        const transactionEntries = await TransactionEntry.find({ 
            'metadata.paymentId': payment.paymentId 
        });
        
        if (transactionEntries.length > 0) {
            console.log(`✅ Transaction Entries Found: ${transactionEntries.length}`);
            transactionEntries.forEach((entry, index) => {
                console.log(`\n   Entry ${index + 1}:`);
                console.log(`     ID: ${entry._id}`);
                console.log(`     Description: ${entry.description}`);
                console.log(`     Debit: $${entry.debit || 0}`);
                console.log(`     Credit: $${entry.credit || 0}`);
                console.log(`     Account: ${entry.account}`);
                console.log(`     Residence: ${entry.residence}`);
            });
        } else {
            console.log(`❌ No Transaction Entries Found for Payment: ${payment.paymentId}`);
        }
        
        // Check all accounts to see what's available
        console.log('\n🏦 All Available Accounts:');
        console.log('-'.repeat(50));
        
        const allAccounts = await Account.find({}).sort({ code: 1 });
        console.log(`Total Accounts: ${allAccounts.length}`);
        
        allAccounts.slice(0, 10).forEach(account => {
            console.log(`   ${account.code}: ${account.name} (${account.type})`);
        });
        
        if (allAccounts.length > 10) {
            console.log(`   ... and ${allAccounts.length - 10} more accounts`);
        }
        
        // Analysis
        console.log('\n🔍 Analysis:');
        console.log('-'.repeat(50));
        
        if (!receivingAccount) {
            console.log(`❌ Missing Receiving Account for method: ${payment.method}`);
            console.log(`   Need to create account with code: ${payment.method.toLowerCase().includes('bank') ? '1000' : '1015'}`);
        }
        
        if (!rentAccount) {
            console.log(`❌ Missing Rental Income Account (4000)`);
        }
        
        if (!studentAccount) {
            console.log(`❌ Missing Accounts Receivable Account (1100)`);
        }
        
        if (receivingAccount && rentAccount && studentAccount) {
            console.log(`✅ All required accounts exist`);
            if (!transaction) {
                console.log(`❌ Transaction creation failed despite having all accounts`);
                console.log(`   This suggests an error in the transaction creation logic`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error debugging payment transaction creation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the debug
debugPaymentTransactionCreation();
