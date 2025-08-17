// Test Mixed Request Scenarios
// This script tests if the system properly handles:
// 1. Requests with vendors but no quotations
// 2. Requests without vendors or quotations
// 3. Mixed requests (some items with vendors, some without)

const { MongoClient, ObjectId } = require('mongodb');

async function testMixedRequestScenarios() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const requestsCollection = db.collection('requests');
        const transactionEntriesCollection = db.collection('transactionentries');

        console.log('\n🧪 Testing Mixed Request Scenarios...\n');

        // Test Case 1: Request with vendor but no quotation
        console.log('📋 Test Case 1: Request with vendor but no quotation');
        console.log('==================================================');
        
        const vendorOnlyRequest = {
            _id: new ObjectId(),
            title: "WiFi Extension Service",
            description: "Please help",
            type: "operational",
            department: "Operations",
            requestedBy: "Cindy",
            proposedVendor: "LIQUID", // ✅ Has vendor
            items: [
                {
                    _id: new ObjectId(),
                    description: "WiFi Extension",
                    quantity: 1,
                    unitCost: 200,
                    totalCost: 200,
                    purpose: "Please help us with this",
                    provider: "LIQUID", // ✅ Item also has provider
                    quotations: [] // ✅ No quotations
                }
            ],
            totalEstimatedCost: 200,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Belvedere",
            priority: "high",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('✅ Created vendor-only request:');
        console.log(`   Title: ${vendorOnlyRequest.title}`);
        console.log(`   Vendor: ${vendorOnlyRequest.proposedVendor}`);
        console.log(`   Item Provider: ${vendorOnlyRequest.items[0].provider}`);
        console.log(`   Quotations: ${vendorOnlyRequest.items[0].quotations.length}`);
        console.log(`   Amount: $${vendorOnlyRequest.totalEstimatedCost}`);

        // Test Case 2: Request without vendor or quotation
        console.log('\n📋 Test Case 2: Request without vendor or quotation');
        console.log('====================================================');
        
        const noVendorRequest = {
            _id: new ObjectId(),
            title: "Office Supplies Purchase",
            description: "General office supplies",
            type: "operational",
            department: "Administration",
            requestedBy: "Admin",
            proposedVendor: null, // ✅ No vendor
            items: [
                {
                    _id: new ObjectId(),
                    description: "Cleaning Supplies",
                    quantity: 5,
                    unitCost: 50,
                    totalCost: 250,
                    purpose: "General cleaning supplies",
                    provider: null, // ✅ No provider
                    quotations: [] // ✅ No quotations
                }
            ],
            totalEstimatedCost: 250,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Main Office",
            priority: "medium",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('✅ Created no-vendor request:');
        console.log(`   Title: ${noVendorRequest.title}`);
        console.log(`   Vendor: ${noVendorRequest.proposedVendor || 'None'}`);
        console.log(`   Item Provider: ${noVendorRequest.items[0].provider || 'None'}`);
        console.log(`   Quotations: ${noVendorRequest.items[0].quotations.length}`);
        console.log(`   Amount: $${noVendorRequest.totalEstimatedCost}`);

        // Test Case 3: Mixed request (some items with vendors, some without)
        console.log('\n📋 Test Case 3: Mixed request (some items with vendors, some without)');
        console.log('=====================================================================');
        
        const mixedRequest = {
            _id: new ObjectId(),
            title: "Mixed Services & Supplies",
            description: "Combination of vendor services and general supplies",
            type: "operational",
            department: "Operations",
            requestedBy: "Manager",
            proposedVendor: null, // Mixed - no single vendor
            items: [
                {
                    _id: new ObjectId(),
                    description: "Plumbing Repair",
                    quantity: 1,
                    unitCost: 300,
                    totalCost: 300,
                    purpose: "Fix leaking pipe",
                    provider: "ABC Plumbing", // ✅ Has provider
                    quotations: [] // ✅ No quotations
                },
                {
                    _id: new ObjectId(),
                    description: "Office Stationery",
                    quantity: 10,
                    unitCost: 25,
                    totalCost: 250,
                    purpose: "General office supplies",
                    provider: null, // ✅ No provider
                    quotations: [] // ✅ No quotations
                },
                {
                    _id: new ObjectId(),
                    description: "Electrical Work",
                    quantity: 1,
                    unitCost: 400,
                    totalCost: 400,
                    purpose: "Install new light fixtures",
                    provider: "XYZ Electrical", // ✅ Has provider
                    quotations: [] // ✅ No quotations
                }
            ],
            totalEstimatedCost: 950,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "Main Building",
            priority: "high",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('✅ Created mixed request:');
        console.log(`   Title: ${mixedRequest.title}`);
        console.log(`   Total Items: ${mixedRequest.items.length}`);
        mixedRequest.items.forEach((item, index) => {
            console.log(`   Item ${index + 1}: ${item.description}`);
            console.log(`     Provider: ${item.provider || 'None'}`);
            console.log(`     Amount: $${item.totalCost}`);
            console.log(`     Quotations: ${item.quotations.length}`);
        });
        console.log(`   Total Amount: $${mixedRequest.totalEstimatedCost}`);

        // Test Case 4: Request with quotations (for comparison)
        console.log('\n📋 Test Case 4: Request with quotations (for comparison)');
        console.log('=========================================================');
        
        const quotationRequest = {
            _id: new ObjectId(),
            title: "Security System Installation",
            description: "Install security cameras",
            type: "operational",
            department: "Security",
            requestedBy: "Security Manager",
            proposedVendor: null,
            items: [
                {
                    _id: new ObjectId(),
                    description: "Security Camera Installation",
                    quantity: 1,
                    unitCost: 800,
                    totalCost: 800,
                    purpose: "Install 4 security cameras",
                    provider: "SecureTech",
                    quotations: [
                        {
                            _id: new ObjectId(),
                            provider: "SecureTech",
                            amount: 800,
                            description: "Complete installation with 4 cameras",
                            isSelected: true,
                            isApproved: false,
                            uploadedBy: new ObjectId("67c023adae5e27657502e887"),
                            uploadedAt: new Date()
                        }
                    ]
                }
            ],
            totalEstimatedCost: 800,
            status: "pending-finance-approval",
            financeStatus: "pending",
            residence: new ObjectId("67d723cf20f89c4ae69804f3"),
            deliveryLocation: "All Buildings",
            priority: "high",
            submittedBy: new ObjectId("67c023adae5e27657502e887"),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('✅ Created quotation request:');
        console.log(`   Title: ${quotationRequest.title}`);
        console.log(`   Item Provider: ${quotationRequest.items[0].provider}`);
        console.log(`   Quotations: ${quotationRequest.items[0].quotations.length}`);
        console.log(`   Selected Quotation: ${quotationRequest.items[0].quotations[0].isSelected}`);
        console.log(`   Amount: $${quotationRequest.totalEstimatedCost}`);

        // Analyze existing requests in database
        console.log('\n📊 Analyzing Existing Requests in Database');
        console.log('==========================================');

        const existingRequests = await requestsCollection.find({
            status: { $in: ['pending-finance-approval', 'pending-ceo-approval', 'approved'] }
        }).toArray();

        console.log(`Found ${existingRequests.length} existing requests to analyze`);

        let vendorOnlyCount = 0;
        let noVendorCount = 0;
        let mixedCount = 0;
        let quotationCount = 0;

        existingRequests.forEach(request => {
            if (!request.items || request.items.length === 0) {
                return; // Skip requests without items
            }

            const itemsWithVendors = request.items.filter(item => 
                item.provider || (item.quotations && item.quotations.length > 0)
            ).length;
            const itemsWithoutVendors = request.items.filter(item => 
                !item.provider && (!item.quotations || item.quotations.length === 0)
            ).length;

            if (itemsWithVendors > 0 && itemsWithoutVendors === 0) {
                vendorOnlyCount++;
            } else if (itemsWithVendors === 0 && itemsWithoutVendors > 0) {
                noVendorCount++;
            } else if (itemsWithVendors > 0 && itemsWithoutVendors > 0) {
                mixedCount++;
            }

            // Count requests with quotations
            const hasQuotations = request.items.some(item => 
                item.quotations && item.quotations.length > 0
            );
            if (hasQuotations) {
                quotationCount++;
            }
        });

        console.log('\n📈 Request Distribution:');
        console.log(`   Vendor-only requests: ${vendorOnlyCount}`);
        console.log(`   No-vendor requests: ${noVendorCount}`);
        console.log(`   Mixed requests: ${mixedCount}`);
        console.log(`   Requests with quotations: ${quotationCount}`);

        // Check double-entry accounting entries
        console.log('\n💰 Checking Double-Entry Accounting Entries');
        console.log('==========================================');

        const transactionEntries = await transactionEntriesCollection.find({
            sourceModel: 'Request'
        }).toArray();

        console.log(`Found ${transactionEntries.length} transaction entries for requests`);

        let vendorEntries = 0;
        let generalEntries = 0;
        let cashEntries = 0;

        transactionEntries.forEach(entry => {
            entry.entries.forEach(accountEntry => {
                if (accountEntry.accountName.includes('Accounts Payable:') && 
                    !accountEntry.accountName.includes('General')) {
                    vendorEntries++;
                } else if (accountEntry.accountName.includes('Accounts Payable: General')) {
                    generalEntries++;
                } else if (accountEntry.accountName === 'Cash') {
                    cashEntries++;
                }
            });
        });

        console.log('\n📊 Transaction Entry Distribution:');
        console.log(`   Vendor payable entries: ${vendorEntries}`);
        console.log(`   General payable entries: ${generalEntries}`);
        console.log(`   Cash entries: ${cashEntries}`);

        // Summary and Recommendations
        console.log('\n🎯 Summary & Recommendations');
        console.log('=============================');
        console.log('✅ The system SHOULD handle all these scenarios:');
        console.log('   1. Vendor-only requests → Debit: Expense, Credit: Vendor Payable');
        console.log('   2. No-vendor requests → Debit: Expense, Credit: Cash/General Payable');
        console.log('   3. Mixed requests → Combination of both approaches');
        console.log('   4. Quotation requests → Debit: Expense, Credit: Vendor Payable');

        console.log('\n🔍 To verify if it\'s working:');
        console.log('   1. Create test requests with each scenario');
        console.log('   2. Approve them through finance');
        console.log('   3. Check that proper double-entry transactions are created');
        console.log('   4. Verify account balances are correct');

        console.log('\n💡 Expected Behavior:');
        console.log('   - Items with providers → Create vendor payable accounts');
        console.log('   - Items without providers → Use cash or general payable');
        console.log('   - Mixed items → Handle each item according to its type');

    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testMixedRequestScenarios().catch(console.error);
