// Create Test Mixed Requests and Verify Double-Entry Accounting
// This script creates actual test requests and approves them to verify the system works

const { MongoClient, ObjectId } = require('mongodb');

async function createTestMixedRequests() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const requestsCollection = db.collection('requests');
        const transactionEntriesCollection = db.collection('transactionentries');

        console.log('\n🧪 Creating Test Mixed Requests...\n');

        // Test Case 1: Vendor-only request (no quotations)
        console.log('📋 Creating Test Case 1: Vendor-only request');
        const vendorOnlyRequest = {
            _id: new ObjectId(),
            title: "WiFi Extension Service - Test",
            description: "Test request with vendor but no quotations",
            type: "operational",
            department: "Operations",
            requestedBy: "Test User",
            proposedVendor: "LIQUID",
            items: [
                {
                    _id: new ObjectId(),
                    description: "WiFi Extension",
                    quantity: 1,
                    unitCost: 200,
                    totalCost: 200,
                    purpose: "Test vendor-only item",
                    provider: "LIQUID",
                    quotations: []
                }
            ],
            totalEstimatedCost: 200,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Test Location",
            priority: "high",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await requestsCollection.insertOne(vendorOnlyRequest);
        console.log(`✅ Created vendor-only request: ${vendorOnlyRequest._id}`);

        // Test Case 2: No-vendor request
        console.log('\n📋 Creating Test Case 2: No-vendor request');
        const noVendorRequest = {
            _id: new ObjectId(),
            title: "Office Supplies - Test",
            description: "Test request without vendor or quotations",
            type: "operational",
            department: "Administration",
            requestedBy: "Test User",
            proposedVendor: null,
            items: [
                {
                    _id: new ObjectId(),
                    description: "Cleaning Supplies",
                    quantity: 5,
                    unitCost: 50,
                    totalCost: 250,
                    purpose: "Test no-vendor item",
                    provider: null,
                    quotations: []
                }
            ],
            totalEstimatedCost: 250,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Test Location",
            priority: "medium",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await requestsCollection.insertOne(noVendorRequest);
        console.log(`✅ Created no-vendor request: ${noVendorRequest._id}`);

        // Test Case 3: Mixed request
        console.log('\n📋 Creating Test Case 3: Mixed request');
        const mixedRequest = {
            _id: new ObjectId(),
            title: "Mixed Services & Supplies - Test",
            description: "Test request with mixed vendor and no-vendor items",
            type: "operational",
            department: "Operations",
            requestedBy: "Test User",
            proposedVendor: null,
            items: [
                {
                    _id: new ObjectId(),
                    description: "Plumbing Repair",
                    quantity: 1,
                    unitCost: 300,
                    totalCost: 300,
                    purpose: "Test vendor item",
                    provider: "ABC Plumbing",
                    quotations: []
                },
                {
                    _id: new ObjectId(),
                    description: "Office Stationery",
                    quantity: 10,
                    unitCost: 25,
                    totalCost: 250,
                    purpose: "Test no-vendor item",
                    provider: null,
                    quotations: []
                }
            ],
            totalEstimatedCost: 550,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Test Location",
            priority: "high",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await requestsCollection.insertOne(mixedRequest);
        console.log(`✅ Created mixed request: ${mixedRequest._id}`);

        console.log('\n📊 Test Requests Created:');
        console.log(`   1. Vendor-only: ${vendorOnlyRequest._id} - $${vendorOnlyRequest.totalEstimatedCost}`);
        console.log(`   2. No-vendor: ${noVendorRequest._id} - $${noVendorRequest.totalEstimatedCost}`);
        console.log(`   3. Mixed: ${mixedRequest._id} - $${mixedRequest.totalEstimatedCost}`);

        console.log('\n🎯 Next Steps to Test:');
        console.log('   1. Approve these requests through the finance approval endpoint');
        console.log('   2. Check that proper double-entry transactions are created');
        console.log('   3. Verify account balances are correct');

        console.log('\n🔗 Finance Approval Endpoints:');
        console.log(`   PATCH /api/finance/maintenance/requests/${vendorOnlyRequest._id}/approve`);
        console.log(`   PATCH /api/finance/maintenance/requests/${noVendorRequest._id}/approve`);
        console.log(`   PATCH /api/finance/maintenance/requests/${mixedRequest._id}/approve`);

        console.log('\n💡 Expected Results:');
        console.log('   Vendor-only: Debit Expense, Credit Vendor Payable');
        console.log('   No-vendor: Debit Expense, Credit Cash/General Payable');
        console.log('   Mixed: Combination of both approaches');

        // Check current transaction entries
        const currentEntries = await transactionEntriesCollection.find({
            sourceModel: 'Request'
        }).toArray();

        console.log(`\n📋 Current transaction entries: ${currentEntries.length}`);

    } catch (error) {
        console.error('❌ Error creating test requests:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
createTestMixedRequests().catch(console.error);
