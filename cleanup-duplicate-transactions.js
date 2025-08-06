// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function cleanupDuplicateTransactions() {
    try {
        console.log('🧹 CLEANING UP DUPLICATE TRANSACTIONS');
        console.log('=====================================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Payment = require('./src/models/Payment');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        // ========================================
        // GET ALL PAYMENTS
        // ========================================
        console.log('📊 GETTING PAYMENT DATA');
        console.log('========================');
        
        const payments = await Payment.find({});
        console.log(`Total Payments: ${payments.length}`);
        
        // ========================================
        // FIND ALL PAYMENT TRANSACTIONS
        // ========================================
        console.log('\n\n🔍 FINDING PAYMENT TRANSACTIONS');
        console.log('===============================');
        
        const allTransactions = await Transaction.find({ type: 'payment' });
        console.log(`Total Payment Transactions: ${allTransactions.length}`);
        
        // Group transactions by description (which contains payment ID)
        const transactionsByDescription = {};
        allTransactions.forEach(txn => {
            const description = txn.description || '';
            if (!transactionsByDescription[description]) {
                transactionsByDescription[description] = [];
            }
            transactionsByDescription[description].push(txn);
        });
        
        // ========================================
        // IDENTIFY DUPLICATES
        // ========================================
        console.log('\n\n🔍 IDENTIFYING DUPLICATES');
        console.log('==========================');
        
        const duplicates = Object.entries(transactionsByDescription)
            .filter(([description, txns]) => txns.length > 1);
        
        console.log(`Duplicate Groups Found: ${duplicates.length}`);
        
        let transactionsToDelete = [];
        let entriesToDelete = [];
        
        duplicates.forEach(([description, txns]) => {
            console.log(`\nDescription: ${description}`);
            console.log(`Transactions: ${txns.length}`);
            
            // Keep the first transaction, delete the rest
            const toKeep = txns[0];
            const toDelete = txns.slice(1);
            
            console.log(`Keeping: ${toKeep.transactionId} (${toKeep.amount})`);
            
            toDelete.forEach(txn => {
                console.log(`Deleting: ${txn.transactionId} (${txn.amount})`);
                transactionsToDelete.push(txn._id);
                
                // Also delete associated entries
                if (txn.entries && txn.entries.length > 0) {
                    entriesToDelete.push(...txn.entries);
                }
            });
        });
        
        // ========================================
        // DELETE DUPLICATES
        // ========================================
        if (transactionsToDelete.length > 0) {
            console.log('\n\n🗑️ DELETING DUPLICATES');
            console.log('======================');
            
            console.log(`Transactions to delete: ${transactionsToDelete.length}`);
            console.log(`Entries to delete: ${entriesToDelete.length}`);
            
            // Delete transaction entries first
            if (entriesToDelete.length > 0) {
                const entryResult = await TransactionEntry.deleteMany({
                    _id: { $in: entriesToDelete }
                });
                console.log(`Deleted ${entryResult.deletedCount} transaction entries`);
            }
            
            // Delete transactions
            const transactionResult = await Transaction.deleteMany({
                _id: { $in: transactionsToDelete }
            });
            console.log(`Deleted ${transactionResult.deletedCount} transactions`);
        } else {
            console.log('\n\n✅ No duplicates found to delete');
        }
        
        // ========================================
        // VERIFY CLEANUP
        // ========================================
        console.log('\n\n✅ VERIFYING CLEANUP');
        console.log('====================');
        
        const finalTransactions = await Transaction.find({ type: 'payment' });
        const finalEntries = await TransactionEntry.find({ source: 'payment' });
        
        let totalTransactionAmount = 0;
        finalTransactions.forEach(txn => {
            totalTransactionAmount += txn.amount || 0;
        });
        
        let totalEntryAmount = 0;
        finalEntries.forEach(entry => {
            totalEntryAmount += entry.totalCredit || 0;
        });
        
        let totalPaymentAmount = 0;
        payments.forEach(payment => {
            totalPaymentAmount += payment.totalAmount || payment.rentAmount || 0;
        });
        
        console.log(`Final Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        console.log(`Final Transaction Amount: $${totalTransactionAmount.toFixed(2)}`);
        console.log(`Final Entry Amount: $${totalEntryAmount.toFixed(2)}`);
        
        const transactionDiff = Math.abs(totalTransactionAmount - totalPaymentAmount);
        const entryDiff = Math.abs(totalEntryAmount - totalPaymentAmount);
        
        console.log(`\nTransaction Difference: $${transactionDiff.toFixed(2)}`);
        console.log(`Entry Difference: $${entryDiff.toFixed(2)}`);
        
        if (transactionDiff < 0.01 && entryDiff < 0.01) {
            console.log('✅ Cleanup successful! All amounts are now balanced.');
        } else {
            console.log('⚠️ There are still discrepancies.');
        }
        
        // ========================================
        // SHOW FINAL TRANSACTION DETAILS
        // ========================================
        console.log('\n\n📋 FINAL TRANSACTION DETAILS');
        console.log('=============================');
        
        finalTransactions.forEach((txn, index) => {
            console.log(`${index + 1}. ${txn.transactionId}`);
            console.log(`   Amount: $${txn.amount}`);
            console.log(`   Date: ${new Date(txn.date).toLocaleDateString()}`);
            console.log(`   Description: ${txn.description}`);
            console.log('');
        });
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the cleanup
cleanupDuplicateTransactions(); 