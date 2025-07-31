const mongoose = require('mongoose');

// Connect to MongoDB
async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
        console.log('Database:', mongoose.connection.name);
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

async function checkDatabaseContents() {
    try {
        console.log('🔍 Checking database contents...');
        
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📋 Available collections:');
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });
        
        // Check maintenance collection
        const maintenanceCollection = mongoose.connection.db.collection('maintenance');
        const maintenanceCount = await maintenanceCollection.countDocuments();
        console.log(`\n📊 Maintenance collection has ${maintenanceCount} documents`);
        
        if (maintenanceCount > 0) {
            // Find the specific gazebo request
            const gazeboRequest = await maintenanceCollection.findOne({
                _id: new mongoose.Types.ObjectId("688a4e45c0f30f13fe683751")
            });
            
            if (gazeboRequest) {
                console.log('\n✅ Found gazebo request in maintenance collection!');
                console.log(`  - Title: ${gazeboRequest.title}`);
                console.log(`  - ID: ${gazeboRequest._id}`);
                console.log(`  - Finance Status: ${gazeboRequest.financeStatus}`);
                console.log(`  - Finance Approved: ${gazeboRequest.approval?.finance?.approved}`);
                console.log(`  - Status: ${gazeboRequest.status}`);
                
                if (gazeboRequest.items && gazeboRequest.items.length > 0) {
                    console.log('\n🔍 Item-level quotations:');
                    gazeboRequest.items.forEach((item, itemIndex) => {
                        if (item.quotations && item.quotations.length > 0) {
                            console.log(`  - Item ${itemIndex + 1}: ${item.description}`);
                            item.quotations.forEach((quotation, qIndex) => {
                                console.log(`    * Quotation ${qIndex + 1}: ${quotation.provider} - $${quotation.amount} (approved: ${quotation.isApproved})`);
                            });
                        }
                    });
                }
            } else {
                console.log('\n❌ Gazebo request not found in maintenance collection');
                
                // Show a few sample documents
                const sampleDocs = await maintenanceCollection.find({}).limit(3).toArray();
                console.log('\n📋 Sample documents in maintenance collection:');
                sampleDocs.forEach((doc, index) => {
                    console.log(`  ${index + 1}. ${doc.title || doc._id} (ID: ${doc._id})`);
                });
            }
        }
        
        // Also check if there's a requests collection
        const requestsCollection = mongoose.connection.db.collection('requests');
        const requestsCount = await requestsCollection.countDocuments();
        console.log(`\n📊 Requests collection has ${requestsCount} documents`);
        
        if (requestsCount > 0) {
            const gazeboInRequests = await requestsCollection.findOne({
                _id: new mongoose.Types.ObjectId("688a4e45c0f30f13fe683751")
            });
            
            if (gazeboInRequests) {
                console.log('\n✅ Found gazebo request in requests collection!');
                console.log(`  - Title: ${gazeboInRequests.title}`);
                console.log(`  - ID: ${gazeboInRequests._id}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking database contents:', error);
    }
}

async function main() {
    await connectToDatabase();
    await checkDatabaseContents();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 