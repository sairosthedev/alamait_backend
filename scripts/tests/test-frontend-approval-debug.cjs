const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
require('./src/models/Residence');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testFrontendApprovalDebug() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Finding a pending monthly request...');
        const pendingRequest = await MonthlyRequest.findOne({ status: 'pending' }).populate('residence', 'name');
        
        if (!pendingRequest) {
            console.log('❌ No pending requests found');
            return;
        }

        console.log(`📋 Found pending request:`);
        console.log(`   ID: ${pendingRequest._id}`);
        console.log(`   Title: ${pendingRequest.title}`);
        console.log(`   Status: ${pendingRequest.status}`);
        console.log(`   Residence: ${pendingRequest.residence ? pendingRequest.residence.name : 'N/A'}`);
        console.log(`   Items: ${pendingRequest.items ? pendingRequest.items.length : 0}`);

        console.log('\n🔄 Simulating EXACT frontend API call...');
        
        // Simulate the exact frontend API call
        const axios = require('axios');
        
        const apiCall = {
            method: 'PATCH',
            url: `http://localhost:5000/api/monthly-requests/${pendingRequest._id}/approve`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // This might be the issue
            },
            data: {
                approved: true,
                status: 'completed',
                notes: 'Approved by Finance - Status set to completed'
            }
        };

        console.log('📤 API Call Details:');
        console.log(`   Method: ${apiCall.method}`);
        console.log(`   URL: ${apiCall.url}`);
        console.log(`   Headers:`, apiCall.headers);
        console.log(`   Data:`, apiCall.data);

        try {
            const response = await axios(apiCall);
            console.log('\n✅ API Call Successful!');
            console.log(`📤 Response Status: ${response.status}`);
            console.log(`📤 Response Data:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('\n❌ API Call Failed!');
            console.log(`📤 Error Status: ${error.response ? error.response.status : 'No response'}`);
            console.log(`📤 Error Message: ${error.message}`);
            if (error.response) {
                console.log(`📤 Error Data:`, JSON.stringify(error.response.data, null, 2));
            }
        }

        // Check if the request was actually updated
        console.log('\n🔍 Checking if request was updated...');
        const updatedRequest = await MonthlyRequest.findById(pendingRequest._id).populate('residence', 'name');
        console.log(`📋 Updated request status: ${updatedRequest.status}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
testFrontendApprovalDebug(); 