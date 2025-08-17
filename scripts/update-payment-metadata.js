const { MongoClient } = require('mongodb');

async function updatePaymentMetadata() {
    console.log('🔧 Updating Payment Transaction Entry Metadata');
    console.log('=============================================');
    
    // Connect to your MongoDB Atlas cluster
    const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
    const DB_NAME = 'test';
    
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log(`📊 Database: ${DB_NAME}`);
        
        const db = client.db(DB_NAME);
        
        // Collections
        const transactionEntriesCollection = db.collection('transactionentries');
        const residencesCollection = db.collection('residences');
        
        console.log('\n🔍 Step 1: Finding payment entries with incomplete metadata...');
        
        // Find payment entries that have residence but incomplete metadata
        const entriesWithIncompleteMetadata = await transactionEntriesCollection.find({
            source: 'payment',
            residence: { $exists: true, $ne: null, $ne: "" },
            $or: [
                { 'metadata.residenceId': { $exists: false } },
                { 'metadata.residenceId': null },
                { 'metadata.residenceName': { $exists: false } },
                { 'metadata.residenceName': null }
            ]
        }).toArray();
        
        console.log(`📝 Found ${entriesWithIncompleteMetadata.length} entries with incomplete metadata`);
        
        if (entriesWithIncompleteMetadata.length === 0) {
            console.log('🎉 All payment entries already have complete metadata!');
            return;
        }
        
        console.log('\n🔍 Step 2: Updating metadata with residence information...');
        
        let updatedCount = 0;
        for (const entry of entriesWithIncompleteMetadata) {
            // Get residence information
            const residence = await residencesCollection.findOne({ _id: entry.residence });
            if (!residence) {
                console.log(`   ⚠️  Could not find residence ${entry.residence} for entry ${entry._id}`);
                continue;
            }
            
            // Prepare update data
            const updateData = {
                metadata: {
                    ...entry.metadata,
                    residenceId: entry.residence,
                    residenceName: residence.name,
                    updatedAt: new Date(),
                    updateReason: 'Metadata enhancement for residence tracking'
                }
            };
            
            // Update the entry
            const result = await transactionEntriesCollection.updateOne(
                { _id: entry._id },
                { $set: updateData }
            );
            
            if (result.modifiedCount > 0) {
                updatedCount++;
                console.log(`   ✅ Updated entry ${entry._id}: ${residence.name}`);
            }
        }
        
        console.log(`\n📊 Metadata updates completed: ${updatedCount} entries updated`);
        
        console.log('\n🔍 Step 3: Final verification...');
        
        // Check final metadata completeness
        const finalEntriesWithCompleteMetadata = await transactionEntriesCollection.countDocuments({
            source: 'payment',
            'metadata.residenceId': { $exists: true, $ne: null, $ne: "" },
            'metadata.residenceName': { $exists: true, $ne: null, $ne: "" }
        });
        
        const totalPaymentEntries = await transactionEntriesCollection.countDocuments({
            source: 'payment'
        });
        
        console.log(`\n📋 FINAL STATUS:`);
        console.log(`===============`);
        console.log(`Total Payment Entries: ${totalPaymentEntries}`);
        console.log(`Complete Metadata: ${finalEntriesWithCompleteMetadata} ✅`);
        console.log(`Incomplete Metadata: ${totalPaymentEntries - finalEntriesWithCompleteMetadata} ❌`);
        
        if (finalEntriesWithCompleteMetadata === totalPaymentEntries) {
            console.log('\n🎉 SUCCESS: All payment entries now have complete metadata!');
        } else {
            console.log('\n⚠️  Some entries still need metadata updates');
        }
        
        // Show updated residence distribution
        console.log('\n📊 Updated Residence Distribution:');
        const residenceDistribution = await transactionEntriesCollection.aggregate([
            { $match: { 
                source: 'payment',
                'metadata.residenceId': { $exists: true, $ne: null, $ne: "" }
            }},
            { $group: { 
                _id: '$metadata.residenceId', 
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalDebit' }
            }},
            { $sort: { count: -1 } }
        ]).toArray();
        
        residenceDistribution.forEach((res, index) => {
            console.log(`   ${index + 1}. Residence ID: ${res._id}`);
            console.log(`      Payment Count: ${res.count}`);
            console.log(`      Total Amount: $${res.totalAmount}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 MongoDB Atlas connection closed.');
        }
    }
}

// Run the update
updatePaymentMetadata()
    .then(() => {
        console.log('\n✅ Metadata update completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Metadata update failed:', error);
    });
