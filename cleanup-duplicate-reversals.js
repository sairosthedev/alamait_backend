/**
 * Script to clean up duplicate reversal transactions
 * 
 * This script will remove the duplicate reversal transactions that were created
 * and keep only the original lease start transaction for proper reversal.
 */

const mongoose = require('mongoose');

// Connect to database
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

async function cleanupDuplicateReversals() {
    try {
        await connectDB();
        
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        console.log('🧹 Cleaning up duplicate reversal transactions...\n');
        
        // Find all reversal transactions for Kudzai Vella
        const reversalTransactions = await TransactionEntry.find({
            $and: [
                { 'description': { $regex: 'Kudzai Vella', $options: 'i' } },
                { 'source': 'rental_accrual_reversal' },
                { 'metadata.isForfeiture': true }
            ]
        });
        
        console.log(`Found ${reversalTransactions.length} reversal transactions:`);
        reversalTransactions.forEach((transaction, index) => {
            console.log(`${index + 1}. ${transaction.transactionId} - ${transaction.description}`);
            console.log(`   Created: ${transaction.createdAt}`);
            console.log(`   Amount: $${transaction.totalDebit}`);
        });
        
        if (reversalTransactions.length > 1) {
            console.log('\n🗑️ Removing duplicate reversals...');
            
            // Keep the first one, delete the rest
            const toKeep = reversalTransactions[0];
            const toDelete = reversalTransactions.slice(1);
            
            console.log(`✅ Keeping: ${toKeep.transactionId}`);
            
            for (const transaction of toDelete) {
                console.log(`🗑️ Deleting: ${transaction.transactionId}`);
                await TransactionEntry.findByIdAndDelete(transaction._id);
            }
            
            console.log(`\n✅ Cleanup completed! Removed ${toDelete.length} duplicate reversals.`);
        } else {
            console.log('\n✅ No duplicate reversals found.');
        }
        
        // Also check for the original lease start transaction
        const originalTransaction = await TransactionEntry.findOne({
            transactionId: 'LEASE_START_APP1757943001482W209T_1757943002968'
        });
        
        if (originalTransaction) {
            console.log('\n📋 Original lease start transaction found:');
            console.log(`   ID: ${originalTransaction._id}`);
            console.log(`   Transaction ID: ${originalTransaction.transactionId}`);
            console.log(`   Amount: $${originalTransaction.totalDebit}`);
            console.log(`   Status: ${originalTransaction.status}`);
        } else {
            console.log('\n⚠️ Original lease start transaction not found!');
        }
        
        // Check for payment transactions
        const paymentTransactions = await TransactionEntry.find({
            $and: [
                { 'description': { $regex: 'Kudzai Vella', $options: 'i' } },
                {
                    $or: [
                        { source: 'payment' },
                        { source: 'advance_payment' },
                        { 'transactionId': { $regex: 'TXN', $options: 'i' } }
                    ]
                }
            ]
        });
        
        console.log(`\n💰 Found ${paymentTransactions.length} payment transactions:`);
        paymentTransactions.forEach((transaction, index) => {
            console.log(`${index + 1}. ${transaction.transactionId} - ${transaction.description}`);
            console.log(`   Amount: $${transaction.totalDebit}`);
            console.log(`   Source: ${transaction.source}`);
        });
        
        console.log('\n✅ Cleanup completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the cleanup
cleanupDuplicateReversals();

