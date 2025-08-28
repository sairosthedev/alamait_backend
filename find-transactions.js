/**
 * Find Transactions
 * 
 * This script finds all transactions in the database to identify the payment transaction.
 */

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function findTransactions() {
    try {
        console.log('🔍 Finding All Transactions');
        console.log('==========================\n');

        // Get all transactions
        const allTransactions = await TransactionEntry.find().sort({ createdAt: -1 });
        
        console.log(`📊 Total transactions found: ${allTransactions.length}\n`);

        // Show recent transactions
        console.log('📋 Recent Transactions:');
        allTransactions.slice(0, 10).forEach((tx, index) => {
            console.log(`\n${index + 1}. ${tx.transactionId}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Date: ${tx.date}`);
            console.log(`   Amount: $${tx.amount || tx.totalDebit || 0}`);
            console.log(`   Total Debit: $${tx.totalDebit}`);
            console.log(`   Total Credit: $${tx.totalCredit}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Type: ${tx.type}`);
            console.log(`   Created: ${tx.createdAt}`);
            
            // Show entries
            tx.entries.forEach((entry, entryIndex) => {
                console.log(`     Entry ${entryIndex + 1}: ${entry.accountCode} - Debit: $${entry.debit}, Credit: $${entry.credit}`);
            });
        });

        // Look for payment-related transactions
        console.log('\n💰 Payment-Related Transactions:');
        const paymentTransactions = allTransactions.filter(tx => 
            tx.description.toLowerCase().includes('payment') ||
            tx.description.toLowerCase().includes('debt') ||
            tx.description.toLowerCase().includes('settlement') ||
            tx.source === 'payment' ||
            tx.type === 'current_payment'
        );

        console.log(`Found ${paymentTransactions.length} payment-related transactions:`);
        
        paymentTransactions.forEach((tx, index) => {
            console.log(`\n${index + 1}. ${tx.transactionId}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Amount: $${tx.amount || tx.totalDebit || 0}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Type: ${tx.type}`);
        });

        // Look for AR transactions
        console.log('\n📈 AR Transactions:');
        const arTransactions = allTransactions.filter(tx => 
            tx.entries.some(entry => entry.accountCode.startsWith('1100-'))
        );

        console.log(`Found ${arTransactions.length} AR transactions:`);
        
        arTransactions.forEach((tx, index) => {
            console.log(`\n${index + 1}. ${tx.transactionId}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Amount: $${tx.amount || tx.totalDebit || 0}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Type: ${tx.type}`);
            
            // Show AR entries
            tx.entries.forEach(entry => {
                if (entry.accountCode.startsWith('1100-')) {
                    console.log(`     AR Entry: ${entry.accountCode} - Debit: $${entry.debit}, Credit: $${entry.credit}`);
                }
            });
        });

        console.log('\n✅ Transaction Analysis Complete!');

    } catch (error) {
        console.error('❌ Analysis failed:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the analysis
if (require.main === module) {
    findTransactions();
}

module.exports = { findTransactions };

