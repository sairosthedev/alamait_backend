const mongoose = require('mongoose');
const Request = require('./src/models/Request');

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

async function testSpecificRequest() {
    try {
        console.log('🔍 Testing specific request: 688a4e45c0f30f13fe683751');
        console.log('Collection: maintenance');
        
        const requestId = '688a4e45c0f30f13fe683751';
        const request = await Request.findById(requestId);
        
        if (!request) {
            console.log('❌ Request not found in maintenance collection');
            
            // Let's check if it exists in any collection
            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();
            console.log('\n📋 Available collections:');
            collections.forEach(col => console.log(`  - ${col.name}`));
            
            // Try to find the document in any collection
            for (const collection of collections) {
                try {
                    const doc = await db.collection(collection.name).findOne({ _id: new mongoose.Types.ObjectId(requestId) });
                    if (doc) {
                        console.log(`\n✅ Found document in collection: ${collection.name}`);
                        console.log('Document:', JSON.stringify(doc, null, 2));
                        return;
                    }
                } catch (err) {
                    // Skip collections that don't have ObjectId _id fields
                }
            }
            
            console.log('\n❌ Document not found in any collection');
            return;
        }
        
        console.log('\n📋 Request Details:');
        console.log(`  - Title: ${request.title}`);
        console.log(`  - Status: ${request.status}`);
        console.log(`  - Type: ${request.type}`);
        
        console.log('\n🔍 Approval Status:');
        console.log(`  - Admin approved: ${request.approval?.admin?.approved}`);
        console.log(`  - Finance approved: ${request.approval?.finance?.approved}`);
        console.log(`  - CEO approved: ${request.approval?.ceo?.approved}`);
        
        console.log('\n🔍 Finance Status Issues:');
        console.log(`  - Has financeStatus field: ${request.financeStatus !== undefined}`);
        if (request.financeStatus !== undefined) {
            console.log(`  - financeStatus value: ${request.financeStatus}`);
        }
        console.log(`  - approval.finance.approved: ${request.approval?.finance?.approved}`);
        
        console.log('\n🔍 Quotations:');
        if (request.quotations && request.quotations.length > 0) {
            request.quotations.forEach((quotation, index) => {
                console.log(`  - Quotation ${index + 1}:`);
                console.log(`    * Provider: ${quotation.provider}`);
                console.log(`    * Amount: ${quotation.amount}`);
                console.log(`    * isApproved: ${quotation.isApproved}`);
                console.log(`    * approvedBy: ${quotation.approvedBy}`);
                console.log(`    * approvedAt: ${quotation.approvedAt}`);
            });
        } else {
            console.log('  - No request-level quotations');
        }
        
        console.log('\n🔍 Item-level Quotations:');
        if (request.items && request.items.length > 0) {
            request.items.forEach((item, itemIndex) => {
                console.log(`  - Item ${itemIndex + 1}: ${item.description}`);
                if (item.quotations && item.quotations.length > 0) {
                    item.quotations.forEach((quotation, quotationIndex) => {
                        console.log(`    * Quotation ${quotationIndex + 1}:`);
                        console.log(`      - Provider: ${quotation.provider}`);
                        console.log(`      - Amount: ${quotation.amount}`);
                        console.log(`      - isApproved: ${quotation.isApproved}`);
                        console.log(`      - approvedBy: ${quotation.approvedBy}`);
                        console.log(`      - approvedAt: ${quotation.approvedAt}`);
                    });
                } else {
                    console.log(`    * No quotations for this item`);
                }
            });
        } else {
            console.log('  - No items');
        }
        
        // Check for inconsistencies
        console.log('\n⚠️  Inconsistencies Found:');
        let hasInconsistencies = false;
        
        if (request.financeStatus === 'approved' && !request.approval?.finance?.approved) {
            console.log('  ❌ financeStatus is "approved" but approval.finance.approved is false');
            hasInconsistencies = true;
        }
        
        if (request.financeStatus === 'rejected' && request.approval?.finance?.approved) {
            console.log('  ❌ financeStatus is "rejected" but approval.finance.approved is true');
            hasInconsistencies = true;
        }
        
        if (request.approval?.finance?.approved && request.quotations && request.quotations.length > 0) {
            const approvedQuotations = request.quotations.filter(q => q.isApproved);
            if (approvedQuotations.length === 0) {
                console.log('  ❌ Finance approved but no quotations are approved');
                hasInconsistencies = true;
            }
        }
        
        if (!hasInconsistencies) {
            console.log('  ✅ No inconsistencies found');
        }
        
        // Offer to fix the issues
        if (hasInconsistencies) {
            console.log('\n🔧 Would you like to fix these issues? (y/n)');
            // In a real scenario, you would wait for user input
            // For now, let's just show what would be fixed
            console.log('\n🔧 Fixes that would be applied:');
            
            if (request.financeStatus === 'approved' && !request.approval?.finance?.approved) {
                console.log('  - Set approval.finance.approved to true');
                console.log('  - Set approval.finance.approvedAt to current date');
            }
            
            if (request.financeStatus !== undefined) {
                console.log('  - Remove financeStatus field (incorrect field for Request model)');
            }
            
            if (request.approval?.finance?.approved && request.quotations && request.quotations.length > 0) {
                const approvedQuotations = request.quotations.filter(q => q.isApproved);
                if (approvedQuotations.length === 0) {
                    console.log('  - Approve the first quotation');
                    console.log('  - Update request amount to match approved quotation');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing specific request:', error);
    }
}

async function main() {
    await connectToDatabase();
    await testSpecificRequest();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 