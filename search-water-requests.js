const { MongoClient } = require('mongodb');
require('dotenv').config();

async function searchWaterRequests() {
    console.log('🔍 Searching for Water Requests in Maintenance Collection');
    console.log('========================================================');

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
        const maintenanceCollection = db.collection('maintenance');

        console.log('\n🔍 Searching for water-related requests...');
        const waterRequests = await maintenanceCollection.find({
            $or: [
                { title: { $regex: /water/i } },
                { description: { $regex: /water/i } }
            ]
        }).toArray();

        console.log(`\n💧 Found ${waterRequests.length} water-related requests:`);
        
        if (waterRequests.length > 0) {
            waterRequests.forEach((req, index) => {
                console.log(`\n  ${index + 1}. ID: ${req._id}`);
                console.log(`     Title: ${req.title}`);
                console.log(`     Description: ${req.description}`);
                console.log(`     Status: ${req.status}`);
                console.log(`     Finance Status: ${req.financeStatus}`);
                console.log(`     Converted To Expense: ${req.convertedToExpense}`);
                console.log(`     Type: ${req.type}`);
                console.log(`     Created At: ${req.createdAt}`);
                console.log(`     Updated At: ${req.updatedAt}`);
                
                // Check approval structure
                if (req.approval) {
                    console.log(`     Admin Approved: ${req.approval.admin?.approved || false}`);
                    console.log(`     Finance Approved: ${req.approval.finance?.approved || false}`);
                    console.log(`     CEO Approved: ${req.approval.ceo?.approved || false}`);
                }
            });
        } else {
            console.log('❌ No water-related requests found');
        }

        // Also search in other collections that might contain requests
        console.log('\n🔍 Checking other collections for water requests...');
        
        const collections = ['requests', 'monthlyrequests', 'applications'];
        for (const collectionName of collections) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    const waterInCollection = await collection.find({
                        $or: [
                            { title: { $regex: /water/i } },
                            { description: { $regex: /water/i } }
                        ]
                    }).toArray();
                    
                    if (waterInCollection.length > 0) {
                        console.log(`\n💧 Found ${waterInCollection.length} water requests in '${collectionName}' collection:`);
                        waterInCollection.forEach((req, index) => {
                            console.log(`  ${index + 1}. ID: ${req._id}`);
                            console.log(`     Title: ${req.title}`);
                            console.log(`     Status: ${req.status}`);
                            console.log(`     Collection: ${collectionName}`);
                        });
                    }
                }
            } catch (error) {
                console.log(`⚠️  Could not check '${collectionName}' collection: ${error.message}`);
            }
        }

        await client.close();
        console.log('\n✅ Search completed');

    } catch (error) {
        console.error('❌ Search failed:', error);
    }
}

searchWaterRequests();
