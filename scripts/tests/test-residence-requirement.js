const { MongoClient } = require('mongodb');

async function testResidenceRequirement() {
    console.log('🧪 Testing Residence Requirement for Transactions');
    console.log('================================================');
    
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
        
        // Check transactions collection
        const transactionsCollection = db.collection('transactions');
        const totalTransactions = await transactionsCollection.countDocuments();
        console.log(`\n💳 Total transactions: ${totalTransactions}`);
        
        // Check transaction entries collection
        const transactionEntriesCollection = db.collection('transactionentries');
        const totalEntries = await transactionEntriesCollection.countDocuments();
        console.log(`📝 Total transaction entries: ${totalEntries}`);
        
        // Check for transactions without residence
        const transactionsWithoutResidence = await transactionsCollection.find({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        }).toArray();
        
        console.log(`\n⚠️  Transactions WITHOUT residence: ${transactionsWithoutResidence.length}`);
        if (transactionsWithoutResidence.length > 0) {
            console.log('   These transactions need to be updated:');
            transactionsWithoutResidence.forEach((txn, index) => {
                console.log(`   ${index + 1}. ID: ${txn._id}`);
                console.log(`      Transaction ID: ${txn.transactionId}`);
                console.log(`      Description: ${txn.description}`);
                console.log(`      Reference: ${txn.reference}`);
                console.log(`      Residence: ${txn.residence || 'MISSING'}`);
                console.log('');
            });
        }
        
        // Check for transaction entries without residence
        const entriesWithoutResidence = await transactionEntriesCollection.find({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { residence: "" }
            ]
        }).toArray();
        
        console.log(`⚠️  Transaction Entries WITHOUT residence: ${entriesWithoutResidence.length}`);
        if (entriesWithoutResidence.length > 0) {
            console.log('   These entries need to be updated:');
            entriesWithoutResidence.slice(0, 5).forEach((entry, index) => {
                console.log(`   ${index + 1}. ID: ${entry._id}`);
                console.log(`      Transaction: ${entry.transaction}`);
                console.log(`      Account: ${entry.account}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Residence: ${entry.residence || 'MISSING'}`);
                console.log('');
            });
            
            if (entriesWithoutResidence.length > 5) {
                console.log(`   ... and ${entriesWithoutResidence.length - 5} more entries need residence information`);
            }
        }
        
        // Check for transactions WITH residence
        const transactionsWithResidence = await transactionsCollection.find({
            residence: { $exists: true, $ne: null, $ne: "" }
        }).toArray();
        
        console.log(`✅ Transactions WITH residence: ${transactionsWithResidence.length}`);
        if (transactionsWithResidence.length > 0) {
            console.log('   Sample transactions with residence:');
            transactionsWithResidence.slice(0, 3).forEach((txn, index) => {
                console.log(`   ${index + 1}. ID: ${txn._id}`);
                console.log(`      Transaction ID: ${txn.transactionId}`);
                console.log(`      Description: ${txn.description}`);
                console.log(`      Residence: ${txn.residence}`);
                console.log(`      Residence Name: ${txn.residenceName || 'N/A'}`);
                console.log('');
            });
        }
        
        // Check for transaction entries WITH residence
        const entriesWithResidence = await transactionEntriesCollection.find({
            residence: { $exists: true, $ne: null, $ne: "" }
        }).toArray();
        
        console.log(`✅ Transaction Entries WITH residence: ${entriesWithResidence.length}`);
        if (entriesWithResidence.length > 0) {
            console.log('   Sample entries with residence:');
            entriesWithResidence.slice(0, 3).forEach((entry, index) => {
                console.log(`   ${index + 1}. ID: ${entry._id}`);
                console.log(`      Transaction: ${entry.transaction}`);
                console.log(`      Account: ${entry.account}`);
                console.log(`      Description: ${entry.description}`);
                console.log(`      Residence: ${entry.residence}`);
                console.log(`      Metadata Residence: ${entry.metadata?.residenceId || 'N/A'}`);
                console.log('');
            });
        }
        
        // Check residence distribution
        console.log('\n📊 Residence Distribution in Transactions:');
        const residenceDistribution = await transactionsCollection.aggregate([
            { $match: { residence: { $exists: true, $ne: null, $ne: "" } } },
            { $group: { 
                _id: '$residence', 
                count: { $sum: 1 },
                residenceName: { $first: '$residenceName' }
            }},
            { $sort: { count: -1 } }
        ]).toArray();
        
        residenceDistribution.forEach((res, index) => {
            console.log(`   ${index + 1}. Residence ID: ${res._id}`);
            console.log(`      Name: ${res.residenceName || 'Unknown'}`);
            console.log(`      Transaction Count: ${res.count}`);
            console.log('');
        });
        
        // Summary
        console.log('\n📋 SUMMARY:');
        console.log('===========');
        console.log(`Total Transactions: ${totalTransactions}`);
        console.log(`Transactions WITH Residence: ${transactionsWithResidence.length} ✅`);
        console.log(`Transactions WITHOUT Residence: ${transactionsWithoutResidence.length} ❌`);
        console.log(`Total Transaction Entries: ${totalEntries}`);
        console.log(`Entries WITH Residence: ${entriesWithResidence.length} ✅`);
        console.log(`Entries WITHOUT Residence: ${entriesWithoutResidence.length} ❌`);
        
        if (transactionsWithoutResidence.length === 0 && entriesWithoutResidence.length === 0) {
            console.log('\n🎉 SUCCESS: All transactions and entries have residence information!');
        } else {
            console.log('\n⚠️  ACTION REQUIRED: Some transactions/entries need residence information');
            console.log('   Consider running a migration script to update existing records');
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
testResidenceRequirement()
    .then(() => {
        console.log('\n✅ Test completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
    });

