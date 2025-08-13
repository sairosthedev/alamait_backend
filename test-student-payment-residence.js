const { MongoClient } = require('mongodb');

async function testStudentPaymentResidence() {
    console.log('🧪 Testing Student Payment Residence Requirement');
    console.log('==============================================');
    
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
        const transactionsCollection = db.collection('transactions');
        const residencesCollection = db.collection('residences');
        
        console.log('\n🔍 Step 1: Analyzing current student payment transactions...');
        
        // Find all payment transaction entries
        const paymentEntries = await transactionEntriesCollection.find({
            source: 'payment'
        }).toArray();
        
        console.log(`📝 Found ${paymentEntries.length} payment transaction entries`);
        
        if (paymentEntries.length === 0) {
            console.log('⚠️  No payment transaction entries found');
            return;
        }
        
        // Check residence information in payment entries
        const entriesWithResidence = paymentEntries.filter(entry => 
            entry.residence && entry.residence.toString().length === 24
        );
        
        const entriesWithoutResidence = paymentEntries.filter(entry => 
            !entry.residence || entry.residence.toString().length !== 24
        );
        
        console.log(`\n📊 Residence Status in Payment Entries:`);
        console.log(`   With residence: ${entriesWithResidence.length} ✅`);
        console.log(`   Without residence: ${entriesWithoutResidence.length} ❌`);
        
        // Show sample entries with residence
        if (entriesWithResidence.length > 0) {
            console.log('\n✅ Sample payment entries WITH residence:');
            entriesWithResidence.slice(0, 3).forEach((entry, index) => {
                console.log(`   ${index + 1}. ID: ${entry._id}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Reference: ${entry.reference}`);
                console.log(`      Residence: ${entry.residence}`);
                console.log(`      Metadata Residence: ${entry.metadata?.residenceId || 'N/A'}`);
                console.log(`      Source: ${entry.source}`);
                console.log('');
            });
        }
        
        // Show entries without residence (if any)
        if (entriesWithoutResidence.length > 0) {
            console.log('\n❌ Payment entries WITHOUT residence:');
            entriesWithoutResidence.slice(0, 3).forEach((entry, index) => {
                console.log(`   ${index + 1}. ID: ${entry._id}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Reference: ${entry.reference}`);
                console.log(`      Residence: ${entry.residence || 'MISSING'}`);
                console.log(`      Source: ${entry.source}`);
                console.log('');
            });
        }
        
        console.log('\n🔍 Step 2: Analyzing residence distribution in payments...');
        
        // Get residence distribution for payment entries
        const residenceDistribution = await transactionEntriesCollection.aggregate([
            { $match: { 
                source: 'payment',
                residence: { $exists: true, $ne: null, $ne: "" }
            }},
            { $group: { 
                _id: '$residence', 
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalDebit' }
            }},
            { $sort: { count: -1 } }
        ]).toArray();
        
        console.log(`\n📊 Residence Distribution in Payment Entries:`);
        residenceDistribution.forEach((res, index) => {
            console.log(`   ${index + 1}. Residence ID: ${res._id}`);
            console.log(`      Payment Count: ${res.count}`);
            console.log(`      Total Amount: $${res.totalAmount}`);
        });
        
        // Get residence names
        if (residenceDistribution.length > 0) {
            console.log('\n🏠 Residence Names:');
            for (const res of residenceDistribution) {
                const residence = await residencesCollection.findOne({ _id: res._id });
                if (residence) {
                    console.log(`   ${res._id}: ${residence.name}`);
                }
            }
        }
        
        console.log('\n🔍 Step 3: Analyzing payment metadata...');
        
        // Check metadata completeness
        const entriesWithCompleteMetadata = paymentEntries.filter(entry => 
            entry.metadata && 
            entry.metadata.residenceId && 
            entry.metadata.residenceName
        );
        
        const entriesWithIncompleteMetadata = paymentEntries.filter(entry => 
            !entry.metadata || 
            !entry.metadata.residenceId || 
            !entry.metadata.residenceName
        );
        
        console.log(`\n📊 Metadata Completeness:`);
        console.log(`   Complete metadata: ${entriesWithCompleteMetadata.length} ✅`);
        console.log(`   Incomplete metadata: ${entriesWithIncompleteMetadata.length} ❌`);
        
        // Show sample complete metadata
        if (entriesWithCompleteMetadata.length > 0) {
            console.log('\n✅ Sample entries with complete metadata:');
            entriesWithCompleteMetadata.slice(0, 2).forEach((entry, index) => {
                console.log(`   ${index + 1}. ID: ${entry._id}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Residence ID: ${entry.metadata.residenceId}`);
                console.log(`      Residence Name: ${entry.metadata.residenceName}`);
                console.log(`      Student ID: ${entry.metadata.studentId || 'N/A'}`);
                console.log(`      Payment ID: ${entry.metadata.paymentId || 'N/A'}`);
                console.log(`      Transaction Type: ${entry.metadata.transactionType || 'N/A'}`);
                console.log('');
            });
        }
        
        console.log('\n🔍 Step 4: Payment type analysis...');
        
        // Analyze payment types
        const paymentTypes = await transactionEntriesCollection.aggregate([
            { $match: { source: 'payment' } },
            { $group: { 
                _id: '$metadata.transactionType', 
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalDebit' }
            }},
            { $sort: { count: -1 } }
        ]).toArray();
        
        console.log(`\n📊 Payment Types:`);
        paymentTypes.forEach((type, index) => {
            console.log(`   ${index + 1}. Type: ${type._id || 'Unknown'}`);
            console.log(`      Count: ${type.count}`);
            console.log(`      Total Amount: $${type.totalAmount}`);
        });
        
        // Summary
        console.log('\n📋 SUMMARY:');
        console.log('===========');
        console.log(`Total Payment Entries: ${paymentEntries.length}`);
        console.log(`Entries WITH Residence: ${entriesWithResidence.length} ✅`);
        console.log(`Entries WITHOUT Residence: ${entriesWithoutResidence.length} ❌`);
        console.log(`Complete Metadata: ${entriesWithCompleteMetadata.length} ✅`);
        console.log(`Incomplete Metadata: ${entriesWithIncompleteMetadata.length} ❌`);
        
        if (entriesWithoutResidence.length === 0 && entriesWithIncompleteMetadata.length === 0) {
            console.log('\n🎉 SUCCESS: All payment entries have complete residence information!');
        } else if (entriesWithoutResidence.length === 0) {
            console.log('\n⚠️  All entries have residence, but some metadata is incomplete');
            console.log('   Consider updating metadata for better reporting');
        } else {
            console.log('\n❌ ACTION REQUIRED: Some payment entries need residence information');
            console.log('   Consider running the residence update scripts');
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (entriesWithoutResidence.length > 0) {
            console.log('   1. Run residence update scripts to fix missing residence info');
        }
        if (entriesWithIncompleteMetadata.length > 0) {
            console.log('   2. Update metadata to include residence information');
        }
        if (entriesWithResidence.length > 0 && entriesWithCompleteMetadata.length > 0) {
            console.log('   3. ✅ System is ready for residence-based payment reporting');
            console.log('   4. ✅ All new payments will automatically include residence info');
        }
        
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

// Run the test
testStudentPaymentResidence()
    .then(() => {
        console.log('\n✅ Test completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
    });
