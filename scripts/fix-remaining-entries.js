require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function fixRemainingEntries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔧 Fixing Remaining Unknown Entries...');

        const unknownEntries = await TransactionEntry.find({ 'metadata.type': { $exists: false } });
        console.log(`\n📊 Found ${unknownEntries.length} remaining unknown entries`);

        let fixedCount = 0;

        for (const entry of unknownEntries) {
            console.log(`\n🔄 Processing entry: ${entry._id}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Amount: $${entry.totalDebit}`);

            let metadataType = 'unknown';
            let shouldUpdate = false;

            // Check if this is a petty cash expense
            if (entry.description.includes('Petty cash expense') && entry.entries && entry.entries.length === 2) {
                const entry1 = entry.entries[0];
                const entry2 = entry.entries[1];
                
                if (entry1.accountCode === '5003' && entry2.accountCode === '1011') {
                    metadataType = 'petty_cash_expense';
                    shouldUpdate = true;
                    console.log(`   ✅ Identified as: Petty Cash Expense`);
                }
            }
            // Check if this is an August payment (has 6 sub-entries)
            else if (entry.description.includes('Payment for') && entry.description.includes('2025-08') && entry.entries && entry.entries.length === 6) {
                metadataType = 'august_payment';
                shouldUpdate = true;
                console.log(`   ✅ Identified as: August 2025 Payment`);
            }

            // Update the entry with proper metadata
            if (shouldUpdate) {
                const updateData = {
                    'metadata.type': metadataType,
                    'metadata.description': entry.description,
                    'metadata.date': entry.date,
                    'metadata.amount': entry.totalDebit
                };

                await TransactionEntry.updateOne(
                    { _id: entry._id },
                    { $set: updateData }
                );

                console.log(`   ✅ Updated with metadata type: ${metadataType}`);
                fixedCount++;
            } else {
                console.log(`   ⚠️ Could not identify type`);
            }
        }

        console.log(`\n🎉 Fix Complete!`);
        console.log(`📊 Total entries fixed: ${fixedCount}`);
        console.log(`📊 Total entries processed: ${unknownEntries.length}`);

        // Verify the fix
        const remainingUnknown = await TransactionEntry.find({ 'metadata.type': { $exists: false } });
        console.log(`📊 Remaining unknown entries: ${remainingUnknown.length}`);

        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error fixing remaining entries:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the fix
fixRemainingEntries();



