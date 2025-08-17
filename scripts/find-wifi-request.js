// Find WiFi Extension Request
// This script searches for the WiFi request across different collections

const { MongoClient, ObjectId } = require('mongodb');

async function findWifiRequest() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📋 Available collections:');
        collections.forEach(col => console.log(`   - ${col.name}`));

        // Search in different possible collections
        const searchCollections = ['maintenances', 'requests', 'maintenance'];
        
        for (const collectionName of searchCollections) {
            try {
                const collection = db.collection(collectionName);
                console.log(`\n🔍 Searching in collection: ${collectionName}`);
                
                // Search by title
                const byTitle = await collection.findOne({
                    title: { $regex: /wifi/i }
                });
                
                if (byTitle) {
                    console.log(`✅ Found by title in ${collectionName}:`, {
                        _id: byTitle._id,
                        title: byTitle.title,
                        status: byTitle.status
                    });
                }
                
                // Search by ID
                const byId = await collection.findOne({
                    _id: new ObjectId("6893cc82ff504e2cce3d7184")
                });
                
                if (byId) {
                    console.log(`✅ Found by ID in ${collectionName}:`, {
                        _id: byId._id,
                        title: byId.title,
                        status: byId.status
                    });
                }
                
                // Search by description
                const byDescription = await collection.findOne({
                    description: { $regex: /wifi/i }
                });
                
                if (byDescription) {
                    console.log(`✅ Found by description in ${collectionName}:`, {
                        _id: byDescription._id,
                        title: byDescription.title,
                        description: byDescription.description
                    });
                }
                
            } catch (error) {
                console.log(`❌ Error searching in ${collectionName}:`, error.message);
            }
        }

        // Also search for any document with the specific ID
        console.log('\n🔍 Searching for specific ID across all collections...');
        for (const collection of collections) {
            try {
                const doc = await db.collection(collection.name).findOne({
                    _id: new ObjectId("6893cc82ff504e2cce3d7184")
                });
                
                if (doc) {
                    console.log(`✅ Found in ${collection.name}:`, {
                        _id: doc._id,
                        title: doc.title || doc.issue,
                        status: doc.status
                    });
                }
            } catch (error) {
                // Ignore errors for collections that don't support ObjectId queries
            }
        }

    } catch (error) {
        console.error('❌ Error searching for WiFi request:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
findWifiRequest().catch(console.error);
