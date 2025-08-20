const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function cleanupDuplicateRentalAccruals() {
    try {
        console.log('\n🧹 CLEANING UP DUPLICATE RENTAL ACCRUALS');
        console.log('=' .repeat(70));

        // Import required models
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Transaction = require('../src/models/Transaction');

        // Find all rental accrual entries grouped by student
        const rentalAccrualEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            'metadata.type': 'lease_start'
        }).sort({ createdAt: 1 }); // Oldest first

        console.log(`📋 Found ${rentalAccrualEntries.length} lease start rental accrual entries`);

        // Group by student ID
        const studentGroups = {};
        rentalAccrualEntries.forEach(entry => {
            const studentId = entry.metadata?.studentId;
            if (studentId) {
                if (!studentGroups[studentId]) {
                    studentGroups[studentId] = [];
                }
                studentGroups[studentId].push(entry);
            }
        });

        console.log(`👥 Found ${Object.keys(studentGroups).length} unique students with rental accrual entries`);

        let duplicatesRemoved = 0;
        let transactionsRemoved = 0;

        for (const [studentId, entries] of Object.entries(studentGroups)) {
            if (entries.length > 1) {
                const studentName = entries[0].metadata?.studentName || 'Unknown Student';
                console.log(`\n👤 ${studentName} has ${entries.length} duplicate entries`);
                
                // Keep the first (oldest) entry, remove the rest
                const entriesToRemove = entries.slice(1);
                
                for (const entry of entriesToRemove) {
                    console.log(`   🗑️ Removing duplicate entry: ${entry.transactionId}`);
                    
                    // Find and remove the associated transaction
                    const transaction = await Transaction.findOne({ 
                        transactionId: entry.transactionId 
                    });
                    
                    if (transaction) {
                        console.log(`   🗑️ Removing associated transaction: ${transaction.transactionId}`);
                        await Transaction.deleteOne({ _id: transaction._id });
                        transactionsRemoved++;
                    }
                    
                    // Remove the transaction entry
                    await TransactionEntry.deleteOne({ _id: entry._id });
                    duplicatesRemoved++;
                }
                
                console.log(`   ✅ Kept original entry: ${entries[0].transactionId}`);
            } else {
                const studentName = entries[0].metadata?.studentName || 'Unknown Student';
                console.log(`✅ ${studentName} has single entry (no duplicates)`);
            }
        }

        // Also clean up orphaned transactions (transactions without entries)
        const orphanedTransactions = await Transaction.find({
            type: 'accrual',
            description: { $regex: /lease start/i },
            entries: { $size: 0 }
        });

        if (orphanedTransactions.length > 0) {
            console.log(`\n🗑️ Found ${orphanedTransactions.length} orphaned transactions (no entries)`);
            
            for (const transaction of orphanedTransactions) {
                console.log(`   🗑️ Removing orphaned transaction: ${transaction.transactionId}`);
                await Transaction.deleteOne({ _id: transaction._id });
                transactionsRemoved++;
            }
        }

        console.log('\n📊 CLEANUP SUMMARY');
        console.log('=' .repeat(40));
        console.log(`🗑️ Duplicate entries removed: ${duplicatesRemoved}`);
        console.log(`🗑️ Transactions removed: ${transactionsRemoved}`);
        console.log(`✅ Unique students with entries: ${Object.keys(studentGroups).length}`);

        // Verify final state
        const finalEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            'metadata.type': 'lease_start'
        });

        const finalTransactions = await Transaction.find({
            type: 'accrual',
            description: { $regex: /lease start/i }
        });

        console.log('\n🔍 FINAL STATE');
        console.log('-'.repeat(30));
        console.log(`📋 Remaining rental accrual entries: ${finalEntries.length}`);
        console.log(`💼 Remaining rental transactions: ${finalTransactions.length}`);

        if (duplicatesRemoved > 0 || transactionsRemoved > 0) {
            console.log('\n🎉 CLEANUP COMPLETED');
            console.log('   Database cleaned of duplicate rental accrual entries');
            console.log('   Each student now has exactly one lease start entry');
        } else {
            console.log('\n✅ NO CLEANUP NEEDED');
            console.log('   No duplicate entries found');
        }

    } catch (error) {
        console.error('❌ Error cleaning up duplicate rental accruals:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await cleanupDuplicateRentalAccruals();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { cleanupDuplicateRentalAccruals };
