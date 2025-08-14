const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixWaterRequest() {
    console.log('🔧 Fixing Water Request Status');
    console.log('==============================');
    
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
        
        // Find the specific water request
        console.log('\n🔍 Finding the water request...');
        const waterRequest = await requestsCollection.findOne({
            _id: '689c637bb3119d308cdb5172'
        });
        
        if (!waterRequest) {
            console.log('❌ Water request not found');
            await client.close();
            return;
        }
        
        console.log('✅ Found water request:', {
            id: waterRequest._id,
            title: waterRequest.title,
            status: waterRequest.status,
            financeStatus: waterRequest.financeStatus,
            convertedToExpense: waterRequest.convertedToExpense,
            totalEstimatedCost: waterRequest.totalEstimatedCost
        });
        
        // Fix the request status
        console.log('\n🔧 Fixing request status...');
        const updateResult = await requestsCollection.updateOne(
            { _id: waterRequest._id },
            {
                $set: {
                    'status': 'approved',
                    'convertedToExpense': true,
                    'updatedAt': new Date()
                }
            }
        );
        
        if (updateResult.modifiedCount > 0) {
            console.log('✅ Request status fixed successfully');
            
            // Fetch the updated request
            const updatedRequest = await requestsCollection.findOne({ _id: waterRequest._id });
            console.log('\n📊 Updated request status:');
            console.log('  - status:', updatedRequest.status);
            console.log('  - financeStatus:', updatedRequest.financeStatus);
            console.log('  - convertedToExpense:', updatedRequest.convertedToExpense);
            console.log('  - updatedAt:', updatedRequest.updatedAt);
            
            // Verify the fix
            const isFixed = 
                updatedRequest.status === 'approved' &&
                updatedRequest.financeStatus === 'approved' &&
                updatedRequest.convertedToExpense === true;
            
            if (isFixed) {
                console.log('\n🎉 SUCCESS: Water request status fixed!');
            } else {
                console.log('\n❌ FAILURE: Some fields not fixed correctly');
            }
            
        } else {
            console.log('❌ Failed to fix request status');
        }
        
        await client.close();
        console.log('\n✅ Fix completed');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

fixWaterRequest();

