const { MongoClient } = require('mongodb');
require('dotenv').config();

async function getWaterRequestDetails() {
    console.log('🔍 Getting Water Request Details');
    console.log('================================');

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

        console.log('\n🔍 Finding water request in maintenance collection...');
        const waterRequest = await maintenanceCollection.findOne({
            title: 'water'
        });

        if (!waterRequest) {
            console.log('❌ Water request not found');
            await client.close();
            return;
        }

        console.log('✅ Found water request:');
        console.log(JSON.stringify(waterRequest, null, 2));

        await client.close();
        console.log('\n✅ Details retrieved');

    } catch (error) {
        console.error('❌ Failed to get details:', error);
    }
}

getWaterRequestDetails();
