const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

async function testApiAccess() {
    console.log('=== Testing API Access ===\n');

    try {
        // Test 1: Get all requests without any filters
        console.log('1. Testing GET /api/requests (no filters)...');
        
        try {
            const response = await axios.get(
                `${BASE_URL}/requests`,
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ API Response Status:', response.status);
            console.log('✅ Total requests returned:', response.data.requests?.length || 0);
            console.log('✅ Pagination info:', response.data.pagination);
            
            if (response.data.requests && response.data.requests.length > 0) {
                console.log('\nFirst request details:');
                const firstRequest = response.data.requests[0];
                console.log(`   ID: ${firstRequest._id}`);
                console.log(`   Title: ${firstRequest.title}`);
                console.log(`   Type: ${firstRequest.type}`);
                console.log(`   Status: ${firstRequest.status}`);
                console.log(`   Submitted by: ${firstRequest.submittedBy?.firstName} ${firstRequest.submittedBy?.lastName}`);
                console.log(`   Role: ${firstRequest.submittedBy?.role}`);
            } else {
                console.log('❌ No requests returned');
            }
        } catch (error) {
            console.log('❌ API call failed:', error.response?.data || error.message);
        }

        // Test 2: Get requests with specific filters
        console.log('\n2. Testing GET /api/requests with filters...');
        
        try {
            const response = await axios.get(
                `${BASE_URL}/requests?type=maintenance&status=pending&limit=50`,
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ Filtered API Response Status:', response.status);
            console.log('✅ Filtered requests returned:', response.data.requests?.length || 0);
            console.log('✅ Filtered pagination info:', response.data.pagination);
        } catch (error) {
            console.log('❌ Filtered API call failed:', error.response?.data || error.message);
        }

        // Test 3: Check if there are any requests at all
        console.log('\n3. Testing GET /api/requests with no limit...');
        
        try {
            const response = await axios.get(
                `${BASE_URL}/requests?limit=1000`,
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ No limit API Response Status:', response.status);
            console.log('✅ All requests returned:', response.data.requests?.length || 0);
            console.log('✅ Total items in database:', response.data.pagination?.totalItems || 0);
        } catch (error) {
            console.log('❌ No limit API call failed:', error.response?.data || error.message);
        }

        // Test 4: Check authentication
        console.log('\n4. Testing without authentication...');
        
        try {
            const response = await axios.get(
                `${BASE_URL}/requests`,
                {
                    timeout: 30000
                }
            );
            
            console.log('❌ Should have failed - got response:', response.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Authentication required (expected)');
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testApiAccess(); 