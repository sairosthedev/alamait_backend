require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function fixUnknownEntries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔧 Fixing Unknown TransactionEntry Records...');

        // Find all entries without metadata.type
        const unknownEntries = await TransactionEntry.find({ 'metadata.type': { $exists: false } });
        console.log(`\n📊 Found ${unknownEntries.length} unknown entries to fix`);

        let fixedCount = 0;

        for (const entry of unknownEntries) {
            console.log(`\n🔄 Processing entry: ${entry._id}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Date: ${entry.date}`);
            console.log(`   Amount: $${entry.totalDebit}`);

            let metadataType = 'unknown';
            let shouldUpdate = false;

            // Analyze the entry to determine its type
            if (entry.entries && entry.entries.length === 2) {
                const entry1 = entry.entries[0];
                const entry2 = entry.entries[1];

                // Check if this is a rent payment
                if (entry1.accountCode === '1002' && entry2.accountCode === '4001') {
                    metadataType = 'rent_payment';
                    shouldUpdate = true;
                    console.log(`   ✅ Identified as: Rent Payment`);
                }
                // Check if this is a petty cash allocation
                else if (entry1.accountCode === '1011' && entry2.accountCode === '1002') {
                    metadataType = 'petty_cash_allocation';
                    shouldUpdate = true;
                    console.log(`   ✅ Identified as: Petty Cash Allocation`);
                }
                // Check if this is an accounts receivable collection
                else if (entry1.accountCode === '1002' && entry2.accountCode === '1101') {
                    metadataType = 'receivable_collection';
                    shouldUpdate = true;
                    console.log(`   ✅ Identified as: Receivable Collection`);
                }
                // Check if this is a rent payment to cash
                else if (entry1.accountCode === '1002' && entry2.accountCode === '4001') {
                    metadataType = 'rent_payment';
                    shouldUpdate = true;
                    console.log(`   ✅ Identified as: Rent Payment`);
                }
                else {
                    console.log(`   ⚠️ Could not identify type - Account codes: ${entry1.accountCode}, ${entry2.accountCode}`);
                }
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
        console.error('❌ Error fixing unknown entries:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the fix
fixUnknownEntries();

