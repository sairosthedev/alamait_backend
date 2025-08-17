const mongoose = require('mongoose');
const MonthlyRequest = require('../src/models/MonthlyRequest');
require('../src/models/Residence');
const axios = require('axios');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testWithRealAuth() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Login to get a valid token
        console.log('\n🔐 Logging in to get authentication token...');
        
        const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'finance@alamait.com',
            password: '12345678'
        });

        if (!loginResponse.data.token) {
            console.log('❌ Login failed - no token received');
            console.log('Response:', loginResponse.data);
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful! Token received');

        // Step 2: Find a pending request
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
        console.log(`   isTemplate: ${pendingRequest.isTemplate}`);

        // Step 3: Test approval with real token
        console.log('\n🔄 Testing approval with real authentication token...');
        
        // Check if this is a template request
        if (pendingRequest.isTemplate) {
            console.log('📋 This is a template request - using template approval endpoint');
            
            const approvalResponse = await axios.post(
                `http://localhost:5000/api/monthly-requests/${pendingRequest._id}/approve-month`,
                {
                    month: 8, // August
                    year: 2025,
                    approved: true,
                    status: 'completed',
                    notes: 'Template approved by Finance for August 2025'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            console.log('\n✅ Template approval successful!');
            console.log(`📤 Response Status: ${approvalResponse.status}`);
            console.log(`📤 Response Data:`, JSON.stringify(approvalResponse.data, null, 2));
        } else {
            console.log('📋 This is a regular request - using regular approval endpoint');
            
            const approvalResponse = await axios.patch(
                `http://localhost:5000/api/monthly-requests/${pendingRequest._id}/approve`,
                {
                    approved: true,
                    status: 'completed',
                    notes: 'Approved by Finance - Status set to completed'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            console.log('\n✅ Regular approval successful!');
            console.log(`📤 Response Status: ${approvalResponse.status}`);
            console.log(`📤 Response Data:`, JSON.stringify(approvalResponse.data, null, 2));
        }

        // Step 4: Verify the request was updated
        console.log('\n🔍 Verifying request was updated...');
        const updatedRequest = await MonthlyRequest.findById(pendingRequest._id).populate('residence', 'name');
        console.log(`📋 Updated request status: ${updatedRequest.status}`);

        if (updatedRequest.status === 'completed') {
            console.log('🎉 SUCCESS: Request was successfully approved and marked as completed!');
        } else {
            console.log('⚠️  WARNING: Request status was not updated to completed');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📤 Error Response:', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
testWithRealAuth(); 