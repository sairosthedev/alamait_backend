const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'https://alamait-backend.onrender.com/api';
const TEST_EMAIL = 'finance@alamait.com';
const TEST_PASSWORD = 'password123';

async function testBackendFix() {
    try {
        console.log('🧪 Testing Backend Fix Status');
        console.log('==============================');

        // Step 1: Login as finance user
        console.log('1. Logging in as finance user...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (!loginResponse.data.token) {
            console.error('❌ Login failed');
            return;
        }

        const token = loginResponse.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Login successful');

        // Step 2: Check if our modified controller function has the fix
        console.log('\n2. Testing finance approval endpoint...');
        
        // Create a test request first
        const testRequestData = {
            title: 'Test Backend Fix Request',
            description: 'Testing if backend has the finance approval status fix',
            type: 'maintenance',
            priority: 'medium',
            category: 'Test',
            estimatedAmount: 100,
            items: [{
                description: 'Test item',
                quantity: 1,
                unitCost: 100,
                totalCost: 100,
                quotations: [] // No quotations
            }]
        };

        const createResponse = await axios.post(`${BASE_URL}/requests`, testRequestData, { headers });
        
        if (!createResponse.data || !createResponse.data._id) {
            console.error('❌ Failed to create test request');
            return;
        }

        const testRequestId = createResponse.data._id;
        console.log(`✅ Created test request: ${testRequestId}`);

        // Step 3: Try to approve the request using finance approval endpoint
        console.log('\n3. Testing finance approval with our fix...');
        
        const approvalData = {
            approved: true,
            reason: 'Testing backend fix',
            createDoubleEntryTransactions: true
        };

        try {
            const approvalResponse = await axios.patch(`${BASE_URL}/requests/${testRequestId}/finance-approval`, approvalData, { headers });
            
            console.log('✅ Finance approval request successful');
            console.log('📊 Response status:', approvalResponse.status);
            
            // Check if the response includes our fixed status
            if (approvalResponse.data && approvalResponse.data.request) {
                const updatedRequest = approvalResponse.data.request;
                console.log('\n📋 Updated Request Status:');
                console.log(`   Status: ${updatedRequest.status}`);
                console.log(`   Finance Status: ${updatedRequest.financeStatus}`);
                
                if (updatedRequest.status === 'pending-ceo-approval') {
                    console.log('\n🎉 SUCCESS: Backend fix is working!');
                    console.log('✅ Status correctly changed to pending-ceo-approval');
                } else {
                    console.log('\n❌ ISSUE: Backend fix is NOT working');
                    console.log(`   Expected: pending-ceo-approval`);
                    console.log(`   Actual: ${updatedRequest.status}`);
                    console.log('\n💡 This means the backend server has NOT been restarted with the fix');
                }
            } else {
                console.log('\n⚠️ Could not verify status from response');
                console.log('Response structure:', JSON.stringify(approvalResponse.data, null, 2));
            }

        } catch (approvalError) {
            console.error('❌ Finance approval failed:', approvalError.response?.data || approvalError.message);
            
            // Check if it's an authentication error
            if (approvalError.response?.status === 401) {
                console.log('💡 Authentication issue - token might be expired');
            } else if (approvalError.response?.status === 403) {
                console.log('💡 Permission issue - finance user might not have correct role');
            } else {
                console.log('💡 Other error - backend might be down or endpoint changed');
            }
        }

        // Step 4: Clean up - delete the test request
        console.log('\n4. Cleaning up test request...');
        try {
            await axios.delete(`${BASE_URL}/requests/${testRequestId}`, { headers });
            console.log('✅ Test request cleaned up');
        } catch (cleanupError) {
            console.log('⚠️ Could not clean up test request (not critical)');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Backend server is not running or not accessible');
            console.log('   - Check if the server is running');
            console.log('   - Check the BASE_URL configuration');
        }
    }
}

// Additional function to check server status
async function checkServerStatus() {
    try {
        console.log('\n🔍 Checking server status...');
        const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
        console.log('✅ Server is running');
        console.log('📊 Health check response:', response.data);
    } catch (error) {
        console.log('❌ Server health check failed');
        
        // Try basic ping
        try {
            const pingResponse = await axios.get(BASE_URL.replace('/api', ''));
            console.log('✅ Server responded to basic ping');
        } catch (pingError) {
            console.log('❌ Server is not responding');
            console.log('💡 The backend server may be down or need to be restarted');
        }
    }
}

// Run the test
if (require.main === module) {
    console.log(`🔗 Testing against: ${BASE_URL}`);
    
    checkServerStatus()
        .then(() => testBackendFix())
        .catch(error => {
            console.error('❌ Test suite failed:', error.message);
        });
}

module.exports = { testBackendFix, checkServerStatus }; 