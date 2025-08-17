// Check WiFi Extension Request
// This script checks the current state of the WiFi request

const { MongoClient, ObjectId } = require('mongodb');

async function checkWifiRequest() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const requestsCollection = db.collection('requests');

        console.log('\n📋 Checking WiFi Extension Request...');

        // Find the specific WiFi request
        const wifiRequest = await requestsCollection.findOne({
            _id: new ObjectId("6893cc82ff504e2cce3d7184")
        });

        if (!wifiRequest) {
            console.log('❌ WiFi request not found in requests collection');
            
            // Try to find any WiFi-related requests
            const wifiRequests = await requestsCollection.find({
                $or: [
                    { title: { $regex: /wifi/i } },
                    { description: { $regex: /wifi/i } }
                ]
            }).toArray();
            
            if (wifiRequests.length > 0) {
                console.log(`\n📋 Found ${wifiRequests.length} WiFi-related requests:`);
                wifiRequests.forEach((req, index) => {
                    console.log(`   ${index + 1}. ID: ${req._id}, Title: ${req.title}, Status: ${req.status}`);
                });
            }
            
            return;
        }

        console.log('✅ Found WiFi request:');
        console.log(`   ID: ${wifiRequest._id}`);
        console.log(`   Title: ${wifiRequest.title}`);
        console.log(`   Description: ${wifiRequest.description}`);
        console.log(`   Type: ${wifiRequest.type}`);
        console.log(`   Status: ${wifiRequest.status}`);
        console.log(`   Finance Status: ${wifiRequest.financeStatus}`);
        console.log(`   Amount: $${wifiRequest.amount}`);
        console.log(`   Items: ${wifiRequest.items?.length || 0}`);
        
        if (wifiRequest.items && wifiRequest.items.length > 0) {
            console.log(`   Item Details:`);
            wifiRequest.items.forEach((item, index) => {
                console.log(`     ${index + 1}. ${item.description} - $${item.totalCost}`);
            });
        }
        
        console.log(`   Quotations: ${wifiRequest.quotations?.length || 0}`);
        console.log(`   Admin Approved: ${wifiRequest.approval?.admin?.approved || false}`);
        console.log(`   Finance Approved: ${wifiRequest.approval?.finance?.approved || false}`);
        console.log(`   CEO Approved: ${wifiRequest.approval?.ceo?.approved || false}`);

    } catch (error) {
        console.error('❌ Error checking WiFi request:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
checkWifiRequest().catch(console.error);
