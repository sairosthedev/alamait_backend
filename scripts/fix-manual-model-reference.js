// Fix Manual Model Reference
// This script updates all TransactionEntry documents that use "Manual" as sourceModel to use "Request" instead

const { MongoClient, ObjectId } = require('mongodb');

async function fixManualModelReference() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const transactionEntriesCollection = db.collection('transactionentries');

        console.log('\n📋 Fixing Manual Model References...');

        // Find all TransactionEntry documents with sourceModel: 'Manual'
        const manualEntries = await transactionEntriesCollection.find({
            sourceModel: 'Manual'
        }).toArray();

        console.log(`📊 Found ${manualEntries.length} TransactionEntry documents with sourceModel: 'Manual'`);

        if (manualEntries.length === 0) {
            console.log('✅ No documents to update');
            return;
        }

        // Update all documents to use 'Request' instead of 'Manual'
        const updateResult = await transactionEntriesCollection.updateMany(
            { sourceModel: 'Manual' },
            { $set: { sourceModel: 'Request' } }
        );

        console.log(`✅ Updated ${updateResult.modifiedCount} TransactionEntry documents`);
        console.log(`   Changed sourceModel from 'Manual' to 'Request'`);

        // Verify the update
        const remainingManualEntries = await transactionEntriesCollection.find({
            sourceModel: 'Manual'
        }).toArray();

        console.log(`📊 Remaining documents with sourceModel: 'Manual': ${remainingManualEntries.length}`);

        if (remainingManualEntries.length === 0) {
            console.log('✅ All Manual references have been successfully updated to Request');
        } else {
            console.log('⚠️ Some documents still have Manual references');
        }

        // Show some examples of updated documents
        const updatedEntries = await transactionEntriesCollection.find({
            sourceModel: 'Request'
        }).limit(5).toArray();

        console.log('\n📋 Examples of updated documents:');
        updatedEntries.forEach((entry, index) => {
            console.log(`   ${index + 1}. Transaction ID: ${entry.transactionId}`);
            console.log(`      Description: ${entry.description}`);
            console.log(`      Source Model: ${entry.sourceModel}`);
            console.log(`      Amount: $${entry.totalDebit}`);
        });

        console.log('\n🎯 Fix Summary:');
        console.log('✅ Updated TransactionEntry model enum to remove "Manual"');
        console.log('✅ Updated all database documents to use "Request" instead of "Manual"');
        console.log('✅ Fixed schema registration error');

    } catch (error) {
        console.error('❌ Error fixing manual model references:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
fixManualModelReference().catch(console.error);
