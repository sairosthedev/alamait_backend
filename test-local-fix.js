const axios = require('axios');

// Test configuration for LOCAL backend
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'macdonaldsairos01@gmail.com';
const TEST_PASSWORD = '12345678';

async function testLocalFix() {
    try {
        console.log('🧪 Testing Local Backend Fix');
        console.log('============================');
        console.log(`🔗 Testing against: ${BASE_URL}`);

        // Step 1: Login as finance user
        console.log('\n1. Logging in as finance user...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (!loginResponse.data.token) {
            console.error('❌ Login failed');
            console.log('Response:', loginResponse.data);
            return;
        }

        const token = loginResponse.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Login successful');

        // Step 2: Get a residence first
        console.log('\n2. Getting residence for test request...');
        const residencesResponse = await axios.get(`${BASE_URL}/residences`, { headers });
        let residenceId = null;
        
        if (residencesResponse.data && residencesResponse.data.length > 0) {
            residenceId = residencesResponse.data[0]._id;
            console.log(`✅ Using residence: ${residencesResponse.data[0].name} (${residenceId})`);
        } else {
            console.log('⚠️ No residences found, using default');
            residenceId = '507f1f77bcf86cd799439011'; // Default ObjectId
        }

        // Step 3: Create a test request
        console.log('\n3. Creating test request...');
        const testRequestData = {
            title: 'Test Local Fix Request',
            description: 'Testing if local backend has the finance approval status fix',
            type: 'maintenance',
            priority: 'medium',
            category: 'Test',
            estimatedAmount: 50,
            department: 'Finance', // Required field
            requestedBy: 'Finance Team', // Required field  
            deliveryLocation: 'Office', // Required field
            residence: residenceId, // Required field
            items: [{
                description: 'Test item without quotations',
                quantity: 1,
                unitCost: 50,
                totalCost: 50,
                quotations: [] // No quotations - this should still work with our fix
            }]
        };

        const createResponse = await axios.post(`${BASE_URL}/requests`, testRequestData, { headers });
        
        if (!createResponse.data || !createResponse.data._id) {
            console.error('❌ Failed to create test request');
            console.log('Response:', createResponse.data);
            return;
        }

        const testRequestId = createResponse.data._id;
        console.log(`✅ Created test request: ${testRequestId}`);

        // Step 4: Test finance approval with our fix
        console.log('\n4. Testing finance approval (this should set status to pending-ceo-approval)...');
        
        const approvalData = {
            approved: true,
            reason: 'Testing local backend fix',
            createDoubleEntryTransactions: true
        };

        const approvalResponse = await axios.patch(`${BASE_URL}/requests/${testRequestId}/finance-approval`, approvalData, { headers });
        
        console.log('✅ Finance approval request successful');
        console.log('📊 Response status:', approvalResponse.status);
        
        // Check the updated request status
        if (approvalResponse.data) {
            console.log('\n📋 Response Data:');
            
            // Check if the response has the request object
            let updatedRequest = null;
            if (approvalResponse.data.request) {
                updatedRequest = approvalResponse.data.request;
            } else if (approvalResponse.data._id) {
                updatedRequest = approvalResponse.data;
            }
            
            if (updatedRequest) {
                console.log(`   Status: ${updatedRequest.status}`);
                console.log(`   Finance Status: ${updatedRequest.financeStatus}`);
                
                if (updatedRequest.status === 'pending-ceo-approval') {
                    console.log('\n🎉 SUCCESS: Local backend fix is working!');
                    console.log('✅ Status correctly changed to pending-ceo-approval');
                    console.log('✅ This means requests without quotations will now properly progress to CEO approval');
                } else {
                    console.log('\n❌ ISSUE: Local backend fix is NOT working');
                    console.log(`   Expected: pending-ceo-approval`);
                    console.log(`   Actual: ${updatedRequest.status}`);
                }
            } else {
                console.log('\n⚠️ Could not find updated request in response');
                console.log('Full response:', JSON.stringify(approvalResponse.data, null, 2));
            }
        }

        // Step 5: Clean up
        console.log('\n5. Cleaning up test request...');
        try {
            await axios.delete(`${BASE_URL}/requests/${testRequestId}`, { headers });
            console.log('✅ Test request cleaned up');
        } catch (cleanupError) {
            console.log('⚠️ Could not clean up test request (not critical)');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.response) {
            console.log('Error response:', error.response.data);
            console.log('Status code:', error.response.status);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Local backend server is not running');
            console.log('   - Start the backend with: npm start');
            console.log('   - Make sure it\'s running on port 5000');
        }
    }
}

// Run the test
if (require.main === module) {
    testLocalFix();
}

module.exports = { testLocalFix }; 