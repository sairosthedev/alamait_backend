require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function fixTransactionStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔧 Fixing TransactionEntry Status Fields...');

        // Find all entries without status field
        const entriesWithoutStatus = await TransactionEntry.find({ status: { $exists: false } });
        console.log(`\n📊 Found ${entriesWithoutStatus.length} entries without status field`);

        if (entriesWithoutStatus.length > 0) {
            // Update all entries to have status: 'posted'
            const result = await TransactionEntry.updateMany(
                { status: { $exists: false } },
                { $set: { status: 'posted' } }
            );

            console.log(`✅ Updated ${result.modifiedCount} entries with status: 'posted'`);
        } else {
            console.log('✅ All entries already have status field');
        }

        // Verify the fix
        const totalEntries = await TransactionEntry.countDocuments();
        const entriesWithStatus = await TransactionEntry.countDocuments({ status: 'posted' });
        
        console.log(`\n📊 Verification:`);
        console.log(`   Total entries: ${totalEntries}`);
        console.log(`   Entries with status 'posted': ${entriesWithStatus}`);
        console.log(`   Entries without status: ${totalEntries - entriesWithStatus}`);

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error fixing transaction status:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the fix
fixTransactionStatus();



