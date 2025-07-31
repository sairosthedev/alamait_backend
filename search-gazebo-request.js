const mongoose = require('mongoose');

// Connect to MongoDB
async function connectToDatabase() {
    try {
        // Use the same connection string as the main application
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
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

async function searchGazeboRequest() {
    try {
        console.log('🔍 Searching for gazebo construction request...');
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log('\n📋 Searching in collections:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        let foundDocuments = [];
        
        for (const collection of collections) {
            console.log(`\n🔍 Searching in ${collection.name} collection...`);
            
            try {
                // Search by title
                const titleResults = await db.collection(collection.name).find({
                    $or: [
                        { title: { $regex: /gazebo/i } },
                        { description: { $regex: /gazebo/i } },
                        { issue: { $regex: /gazebo/i } }
                    ]
                }).toArray();
                
                if (titleResults.length > 0) {
                    console.log(`  ✅ Found ${titleResults.length} documents with "gazebo" in title/description`);
                    foundDocuments.push(...titleResults.map(doc => ({ ...doc, collection: collection.name })));
                }
                
                // Search by the specific ID
                try {
                    const idResult = await db.collection(collection.name).findOne({ 
                        _id: new mongoose.Types.ObjectId('688a4e45c0f30f13fe683751') 
                    });
                    
                    if (idResult) {
                        console.log(`  ✅ Found document with ID 688a4e45c0f30f13fe683751`);
                        foundDocuments.push({ ...idResult, collection: collection.name });
                    }
                } catch (err) {
                    // Skip if ObjectId conversion fails
                }
                
                // Search for any documents with financeStatus field
                const financeStatusResults = await db.collection(collection.name).find({
                    financeStatus: { $exists: true }
                }).toArray();
                
                if (financeStatusResults.length > 0) {
                    console.log(`  ✅ Found ${financeStatusResults.length} documents with financeStatus field`);
                    foundDocuments.push(...financeStatusResults.map(doc => ({ ...doc, collection: collection.name })));
                }
                
            } catch (err) {
                console.log(`  ❌ Error searching ${collection.name}:`, err.message);
            }
        }
        
        // Remove duplicates based on _id
        const uniqueDocuments = foundDocuments.filter((doc, index, self) => 
            index === self.findIndex(d => d._id.toString() === doc._id.toString())
        );
        
        console.log(`\n📊 Found ${uniqueDocuments.length} unique documents:`);
        
        uniqueDocuments.forEach((doc, index) => {
            console.log(`\n${index + 1}. Document from ${doc.collection}:`);
            console.log(`   - _id: ${doc._id}`);
            console.log(`   - title: ${doc.title || 'N/A'}`);
            console.log(`   - description: ${doc.description || 'N/A'}`);
            console.log(`   - issue: ${doc.issue || 'N/A'}`);
            console.log(`   - type: ${doc.type || 'N/A'}`);
            console.log(`   - status: ${doc.status || 'N/A'}`);
            console.log(`   - financeStatus: ${doc.financeStatus || 'N/A'}`);
            console.log(`   - approval.finance.approved: ${doc.approval?.finance?.approved || 'N/A'}`);
            
            if (doc.items && doc.items.length > 0) {
                console.log(`   - items: ${doc.items.length} items`);
                doc.items.forEach((item, itemIndex) => {
                    if (item.quotations && item.quotations.length > 0) {
                        console.log(`     * Item ${itemIndex + 1}: ${item.quotations.length} quotations`);
                        item.quotations.forEach((quotation, qIndex) => {
                            console.log(`       - Quotation ${qIndex + 1}: ${quotation.provider} - $${quotation.amount} (approved: ${quotation.isApproved})`);
                        });
                    }
                });
            }
        });
        
        // If we found the specific gazebo request, show the inconsistencies
        const gazeboRequest = uniqueDocuments.find(doc => 
            doc.title === 'gazebo construction' || 
            doc.description === 'gazebo construction request'
        );
        
        if (gazeboRequest) {
            console.log('\n🎯 Found the gazebo construction request!');
            console.log('\n⚠️  Inconsistencies:');
            
            if (gazeboRequest.financeStatus === 'approved' && !gazeboRequest.approval?.finance?.approved) {
                console.log('  ❌ financeStatus is "approved" but approval.finance.approved is false');
            }
            
            if (gazeboRequest.items && gazeboRequest.items.length > 0) {
                gazeboRequest.items.forEach((item, itemIndex) => {
                    if (item.quotations && item.quotations.length > 0) {
                        const approvedQuotations = item.quotations.filter(q => q.isApproved);
                        if (approvedQuotations.length === 0 && gazeboRequest.financeStatus === 'approved') {
                            console.log(`  ❌ Item ${itemIndex + 1} has no approved quotations despite finance approval`);
                        }
                    }
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error searching for gazebo request:', error);
    }
}

async function main() {
    await connectToDatabase();
    await searchGazeboRequest();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 