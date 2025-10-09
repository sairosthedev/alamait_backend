const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function findTransaction() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to database');

        // Search for the specific transaction
        const transactionId = 'TXN1758013575885NKXXM';
        console.log(`\n🔍 Searching for transaction: ${transactionId}`);

        const transaction = await TransactionEntry.findOne({ transactionId: transactionId });
        
        if (transaction) {
            console.log(`\n✅ Found transaction!`);
            console.log(`\n📋 Transaction Details:`);
            console.log(`Transaction ID: ${transaction.transactionId}`);
            console.log(`Date: ${transaction.date}`);
            console.log(`Description: ${transaction.description}`);
            console.log(`Reference: ${transaction.reference}`);
            console.log(`Source: ${transaction.source}`);
            console.log(`Status: ${transaction.status}`);
            console.log(`Total Debit: $${transaction.totalDebit}`);
            console.log(`Total Credit: $${transaction.totalCredit}`);
            
            if (transaction.metadata) {
                console.log(`\n📊 Metadata:`);
                console.log(JSON.stringify(transaction.metadata, null, 2));
            }
            
            console.log(`\n📝 Transaction Entries:`);
            transaction.entries.forEach((entry, index) => {
                console.log(`\n  Entry ${index + 1}:`);
                console.log(`    Account Code: ${entry.accountCode}`);
                console.log(`    Account Name: ${entry.accountName}`);
                console.log(`    Account Type: ${entry.accountType}`);
                console.log(`    Debit: $${entry.debit || 0}`);
                console.log(`    Credit: $${entry.credit || 0}`);
                console.log(`    Description: ${entry.description}`);
                console.log(`    Balance Impact: $${(entry.debit || 0) - (entry.credit || 0)}`);
            });
            
            // Check if this transaction is balanced
            const isBalanced = Math.abs(transaction.totalDebit - transaction.totalCredit) < 0.01;
            console.log(`\n⚖️ Transaction Balance Check:`);
            console.log(`Total Debits: $${transaction.totalDebit}`);
            console.log(`Total Credits: $${transaction.totalCredit}`);
            console.log(`Difference: $${(transaction.totalDebit - transaction.totalCredit).toFixed(2)}`);
            console.log(`Is Balanced: ${isBalanced ? '✅ YES' : '❌ NO'}`);
            
        } else {
            console.log(`\n❌ Transaction not found in database`);
            
            // Search for similar transactions
            console.log(`\n🔍 Searching for similar transactions...`);
            const similarTransactions = await TransactionEntry.find({
                description: { $regex: 'Payment allocation.*rent.*2025-09', $options: 'i' },
                date: { $gte: new Date('2025-09-16T00:00:00Z'), $lt: new Date('2025-09-17T00:00:00Z') }
            }).limit(10);
            
            console.log(`\n📋 Found ${similarTransactions.length} similar transactions:`);
            similarTransactions.forEach(tx => {
                console.log(`  - ${tx.transactionId}: ${tx.description} (${tx.date})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

findTransaction();







