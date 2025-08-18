require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const Account = require('./src/models/Account');
const Residence = require('./src/models/Residence');

async function investigateSpecificExpense() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Specific Expense: Internet Service...');
        console.log('==================================================');

        // Get all transactions and accounts
        const transactions = await Transaction.find({});
        const accounts = await Account.find({});
        const residences = await Residence.find({});

        console.log(`📊 Total Transactions: ${transactions.length}`);
        console.log(`📊 Total Accounts: ${accounts.length}`);
        console.log(`📊 Total Residences: ${residences.length}`);

        // Find the specific internet service expense
        console.log('\n🔍 Looking for Internet Service Expense...');
        console.log('==========================================');
        
        const internetExpenses = transactions.filter(t => 
            t.description && t.description.toLowerCase().includes('internet service')
        );

        console.log(`\n📡 Found ${internetExpenses.length} internet service transactions:`);
        internetExpenses.forEach((transaction, index) => {
            const residence = residences.find(r => r._id.toString() === transaction.residence?.toString());
            const residenceName = residence ? residence.name : 'Unknown';
            
            console.log(`\n   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
            console.log(`      Amount: $${transaction.amount}`);
            console.log(`      Type: ${transaction.type}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Residence: ${residenceName}`);
            console.log(`      Date: ${transaction.date}`);
            console.log(`      Reference: ${transaction.reference || 'N/A'}`);
            console.log(`      Account: ${transaction.account || 'N/A'}`);
            console.log(`      Debit Account: ${transaction.debitAccount || 'N/A'}`);
            console.log(`      Credit Account: ${transaction.creditAccount || 'N/A'}`);
            
            // Show all fields to understand the structure
            console.log(`      All Fields:`, Object.keys(transaction));
        });

        // Find petty cash transactions
        console.log('\n💰 Looking for Petty Cash Transactions...');
        console.log('========================================');
        
        const pettyCashTransactions = transactions.filter(t => 
            t.description && t.description.toLowerCase().includes('petty cash')
        );

        console.log(`\n💵 Found ${pettyCashTransactions.length} petty cash transactions:`);
        pettyCashTransactions.forEach((transaction, index) => {
            const residence = residences.find(r => r._id.toString() === transaction.residence?.toString());
            const residenceName = residence ? residence.name : 'Unknown';
            
            console.log(`\n   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
            console.log(`      Amount: $${transaction.amount}`);
            console.log(`      Type: ${transaction.type}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Residence: ${residenceName}`);
            console.log(`      Date: ${transaction.date}`);
            console.log(`      Reference: ${transaction.reference || 'N/A'}`);
            console.log(`      Account: ${transaction.account || 'N/A'}`);
            console.log(`      Debit Account: ${transaction.debitAccount || 'N/A'}`);
            console.log(`      Credit Account: ${transaction.creditAccount || 'N/A'}`);
        });

        // Check accounts related to transportation and utilities
        console.log('\n🏷️  Checking Account Types...');
        console.log('==============================');
        
        const transportationAccounts = accounts.filter(a => 
            a.name && a.name.toLowerCase().includes('transportation')
        );
        
        const utilityAccounts = accounts.filter(a => 
            a.name && a.name.toLowerCase().includes('utility')
        );
        
        const internetAccounts = accounts.filter(a => 
            a.name && a.name.toLowerCase().includes('internet')
        );

        console.log(`\n🚗 Transportation Accounts: ${transportationAccounts.length}`);
        transportationAccounts.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.name} (${account.type}) - Balance: $${account.balance || 0}`);
        });

        console.log(`\n⚡ Utility Accounts: ${utilityAccounts.length}`);
        utilityAccounts.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.name} (${account.type}) - Balance: $${account.balance || 0}`);
        });

        console.log(`\n🌐 Internet Accounts: ${internetAccounts.length}`);
        internetAccounts.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.name} (${account.type}) - Balance: $${account.balance || 0}`);
        });

        // Check for transactions with $500 amounts
        console.log('\n💰 Looking for $500 Transactions...');
        console.log('==================================');
        
        const fiveHundredTransactions = transactions.filter(t => 
            t.amount === 500 || t.amount === -500
        );

        console.log(`\n💵 Found ${fiveHundredTransactions.length} $500 transactions:`);
        fiveHundredTransactions.forEach((transaction, index) => {
            const residence = residences.find(r => r._id.toString() === transaction.residence?.toString());
            const residenceName = residence ? residence.name : 'Unknown';
            
            console.log(`\n   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
            console.log(`      Amount: $${transaction.amount}`);
            console.log(`      Type: ${transaction.type}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Residence: ${residenceName}`);
            console.log(`      Date: ${transaction.date}`);
            console.log(`      Reference: ${transaction.reference || 'N/A'}`);
            console.log(`      Account: ${transaction.account || 'N/A'}`);
            console.log(`      Debit Account: ${transaction.debitAccount || 'N/A'}`);
            console.log(`      Credit Account: ${transaction.creditAccount || 'N/A'}`);
        });

        // Check transaction structure
        console.log('\n🔍 Transaction Structure Analysis...');
        console.log('===================================');
        
        if (transactions.length > 0) {
            const sampleTransaction = transactions[0];
            console.log(`\n📋 Sample Transaction Structure:`);
            console.log(`   Fields: ${Object.keys(sampleTransaction).join(', ')}`);
            console.log(`   Amount: ${sampleTransaction.amount}`);
            console.log(`   Type: ${sampleTransaction.type}`);
            console.log(`   Description: ${sampleTransaction.description}`);
            console.log(`   Residence: ${sampleTransaction.residence}`);
            console.log(`   Account: ${sampleTransaction.account}`);
            console.log(`   Debit Account: ${sampleTransaction.debitAccount}`);
            console.log(`   Credit Account: ${sampleTransaction.creditAccount}`);
        }

        console.log('\n🎉 Specific Expense Investigation Complete!');
        console.log('==========================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Specific Expense Investigation...');
investigateSpecificExpense();
