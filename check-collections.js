const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkCollections() {
    console.log('🔍 Checking Database Collections');
    console.log('===============================');

    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI not found in environment variables');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        console.log(`📊 Database name: ${db.databaseName}`);

        const collections = await db.listCollections().toArray();
        console.log(`\n📚 Found ${collections.length} collections:`);

        for (const collection of collections) {
            const collectionName = collection.name;
            const docCount = await db.collection(collectionName).countDocuments();
            console.log(`  - ${collectionName}: ${docCount} documents`);
        }

        // Check if there are any collections with similar names to 'requests'
        const similarCollections = collections.filter(col => 
            col.name.toLowerCase().includes('request') || 
            col.name.toLowerCase().includes('maintenance') ||
            col.name.toLowerCase().includes('application')
        );

        if (similarCollections.length > 0) {
            console.log(`\n🔍 Collections that might contain requests:`);
            similarCollections.forEach(col => {
                console.log(`  - ${col.name}`);
            });
        }

        // Check the 'requests' collection specifically
        const requestsCollection = db.collection('requests');
        const sampleRequests = await requestsCollection.find({}).limit(3).toArray();
        
        if (sampleRequests.length > 0) {
            console.log(`\n📝 Sample requests from 'requests' collection:`);
            sampleRequests.forEach((req, index) => {
                console.log(`  ${index + 1}. ID: ${req._id}`);
                console.log(`     Title: ${req.title || 'No title'}`);
                console.log(`     Status: ${req.status || 'No status'}`);
                console.log(`     Type: ${req.type || 'No type'}`);
                console.log('');
            });
        } else {
            console.log(`\n❌ No documents found in 'requests' collection`);
        }

        await client.close();
        console.log('\n✅ Collection check completed');

    } catch (error) {
        console.error('❌ Collection check failed:', error);
    }
}

checkCollections();
