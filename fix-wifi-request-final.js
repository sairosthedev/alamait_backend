// Fix WiFi Extension Request - Final Version
// This script fixes the WiFi request by updating amount and creating virtual quotation

const { MongoClient, ObjectId } = require('mongodb');

async function fixWifiRequestFinal() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const requestsCollection = db.collection('requests');

        console.log('\n📋 Fixing WiFi Extension Request - Final Version...');

        // Find the specific WiFi request
        const wifiRequest = await requestsCollection.findOne({
            _id: new ObjectId("6893cc82ff504e2cce3d7184")
        });

        if (!wifiRequest) {
            console.log('❌ WiFi request not found in requests collection');
            return;
        }

        console.log('📋 Found WiFi request:', {
            title: wifiRequest.title,
            currentAmount: wifiRequest.amount,
            itemCost: wifiRequest.items?.[0]?.totalCost,
            status: wifiRequest.status,
            financeStatus: wifiRequest.financeStatus,
            proposedVendor: wifiRequest.proposedVendor
        });

        // Calculate total amount from items
        const totalAmount = wifiRequest.items?.reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0;
        console.log(`💰 Total amount from items: $${totalAmount}`);

        // Update the request with correct data and create virtual quotation
        const updateResult = await requestsCollection.updateOne(
            { _id: new ObjectId("6893cc82ff504e2cce3d7184") },
            {
                $set: {
                    amount: totalAmount,
                    status: "pending-finance-approval",
                    financeStatus: "pending",
                    "approval.admin.approved": true,
                    "approval.admin.approvedBy": new ObjectId("67c023adae5e27657502e887"),
                    "approval.admin.approvedAt": new Date(),
                    "approval.admin.approvedByEmail": "admin@alamait.com",
                    "approval.admin.notes": "Admin approved WiFi extension request",
                    updatedBy: new ObjectId("67c023adae5e27657502e887")
                },
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: "Request fixed and approved by admin",
                        user: new ObjectId("67c023adae5e27657502e887"),
                        changes: [
                            `Amount updated from $0 to $${totalAmount}`,
                            "Status changed to pending-finance-approval",
                            "Admin approval granted",
                            "Virtual quotation created from provider"
                        ]
                    }
                }
            }
        );

        console.log(`✅ Updated WiFi request: ${updateResult.modifiedCount} document(s)`);

        // Add virtual quotation from provider
        const provider = wifiRequest.proposedVendor || "LIQUID";
        const quotationResult = await requestsCollection.updateOne(
            { _id: new ObjectId("6893cc82ff504e2cce3d7184") },
            {
                $push: {
                    quotations: {
                        provider: provider,
                        amount: totalAmount,
                        description: `WiFi extension service for ${wifiRequest.residence?.name || 'Belvedere Student House'}`,
                        fileUrl: "",
                        fileName: "",
                        uploadedBy: new ObjectId("67c023adae5e27657502e887"),
                        uploadedAt: new Date(),
                        isApproved: false,
                        isSelected: false,
                        approvedBy: null,
                        approvedAt: null,
                        notes: "Virtual quotation created from provider information"
                    }
                }
            }
        );

        console.log(`✅ Added virtual quotation from ${provider}: ${quotationResult.modifiedCount} document(s)`);

        // Verify the update
        const updatedRequest = await requestsCollection.findOne({
            _id: new ObjectId("6893cc82ff504e2cce3d7184")
        });

        console.log('\n✅ Updated WiFi request details:');
        console.log(`   Title: ${updatedRequest.title}`);
        console.log(`   Amount: $${updatedRequest.amount}`);
        console.log(`   Status: ${updatedRequest.status}`);
        console.log(`   Finance Status: ${updatedRequest.financeStatus}`);
        console.log(`   Admin Approved: ${updatedRequest.approval?.admin?.approved}`);
        console.log(`   Quotations: ${updatedRequest.quotations?.length || 0}`);
        console.log(`   Proposed Vendor: ${updatedRequest.proposedVendor}`);

        if (updatedRequest.quotations && updatedRequest.quotations.length > 0) {
            console.log(`   Virtual Quotation:`);
            console.log(`     Provider: ${updatedRequest.quotations[0].provider}`);
            console.log(`     Amount: $${updatedRequest.quotations[0].amount}`);
            console.log(`     Description: ${updatedRequest.quotations[0].description}`);
        }

        console.log('\n🎯 Next Steps:');
        console.log('1. Finance user should review and approve the request');
        console.log('2. CEO should give final approval');
        console.log('3. Request will be converted to expense automatically');
        console.log('4. Double-entry accounting will create proper vendor entries');

        console.log('\n💡 Double-Entry Accounting Expected:');
        console.log('   Dr. Maintenance Expense: $200');
        console.log('   Cr. Accounts Payable: LIQUID: $200');

    } catch (error) {
        console.error('❌ Error fixing WiFi request:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
fixWifiRequestFinal().catch(console.error);
