const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testFinanceApproval() {
    console.log('🧪 Testing Complete Finance Approval Flow');
    console.log('==========================================');
    
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
        const requestsCollection = db.collection('requests');
        
        // Find a request that needs finance approval
        console.log('\n🔍 Finding a request for finance approval...');
        const pendingRequest = await requestsCollection.findOne({
            'financeStatus': 'pending',
            'status': 'pending'
        });
        
        if (!pendingRequest) {
            console.log('❌ No pending requests found for finance approval');
            await client.close();
            return;
        }
        
        console.log('✅ Found pending request:', {
            id: pendingRequest._id,
            title: pendingRequest.title,
            status: pendingRequest.status,
            financeStatus: pendingRequest.financeStatus,
            convertedToExpense: pendingRequest.convertedToExpense
        });
        
        // Simulate finance approval payload
        const approvalPayload = {
            reason: "yes",
            approvedBy: "Finance User",
            approvedByEmail: "finance@alamait.com",
            createDoubleEntryTransactions: true,
            vendorDetails: []
        };
        
        console.log('\n📤 Simulating finance approval with payload:', approvalPayload);
        
        // Update the request to simulate approval
        const updateResult = await requestsCollection.updateOne(
            { _id: pendingRequest._id },
            {
                $set: {
                    'financeStatus': 'approved',
                    'status': 'approved',
                    'convertedToExpense': true,
                    'approval.finance': {
                        approved: true,
                        rejected: false,
                        waitlisted: false,
                        approvedBy: '67c023adae5e27657502e887', // Use a valid user ID
                        approvedByEmail: 'finance@alamait.com',
                        approvedAt: new Date(),
                        notes: 'Test approval'
                    },
                    'requestHistory': [
                        ...(pendingRequest.requestHistory || []),
                        {
                            date: new Date(),
                            action: 'Finance approved',
                            user: '67c023adae5e27657502e887',
                            changes: ['Finance approved the request']
                        }
                    ]
                }
            }
        );
        
        if (updateResult.modifiedCount > 0) {
            console.log('✅ Request updated successfully');
            
            // Fetch the updated request
            const updatedRequest = await requestsCollection.findOne({ _id: pendingRequest._id });
            console.log('\n📊 Updated request status:');
            console.log('  - status:', updatedRequest.status);
            console.log('  - financeStatus:', updatedRequest.financeStatus);
            console.log('  - convertedToExpense:', updatedRequest.convertedToExpense);
            console.log('  - approval.finance.approved:', updatedRequest.approval?.finance?.approved);
            
            // Verify all required fields are set correctly
            const isCorrectlyApproved = 
                updatedRequest.status === 'approved' &&
                updatedRequest.financeStatus === 'approved' &&
                updatedRequest.convertedToExpense === true &&
                updatedRequest.approval?.finance?.approved === true;
            
            if (isCorrectlyApproved) {
                console.log('\n🎉 SUCCESS: All fields updated correctly!');
            } else {
                console.log('\n❌ FAILURE: Some fields not updated correctly');
            }
            
        } else {
            console.log('❌ Failed to update request');
        }
        
        await client.close();
        console.log('\n✅ Test completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFinanceApproval();

