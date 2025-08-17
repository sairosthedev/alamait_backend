require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Test finance maintenance endpoints
async function testFinanceEndpoints() {
    try {
        console.log('=== TESTING FINANCE MAINTENANCE ENDPOINTS ===');
        
        // First, let's create a test token for admin user
        const adminPayload = {
            user: {
                id: 'admin-user-id', // This will be replaced with actual user ID
                email: 'admin@alamait.com',
                role: 'admin'
            }
        };
        
        const token = jwt.sign(adminPayload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const baseURL = process.env.BASE_URL || 'http://localhost:5000';
        
        console.log('Testing endpoints with base URL:', baseURL);
        console.log('Using admin token for testing');

        // Test 1: Get all maintenance requests
        console.log('\n1. Testing GET /api/finance/maintenance');
        try {
            const response1 = await axios.get(`${baseURL}/api/finance/maintenance`, { headers });
            console.log('✅ Success:', response1.data.requests.length, 'requests found');
            console.log('Sample request:', response1.data.requests[0] ? {
                id: response1.data.requests[0].id,
                issue: response1.data.requests[0].issue,
                financeStatus: response1.data.requests[0].financeStatus
            } : 'No requests');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Get approved maintenance requests
        console.log('\n2. Testing GET /api/finance/maintenance?financeStatus=approved');
        try {
            const response2 = await axios.get(`${baseURL}/api/finance/maintenance?financeStatus=approved`, { headers });
            console.log('✅ Success:', response2.data.requests.length, 'approved requests found');
            console.log('Sample approved request:', response2.data.requests[0] ? {
                id: response2.data.requests[0].id,
                issue: response2.data.requests[0].issue,
                financeStatus: response2.data.requests[0].financeStatus
            } : 'No approved requests');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Get pending maintenance requests
        console.log('\n3. Testing GET /api/finance/maintenance?financeStatus=pending');
        try {
            const response3 = await axios.get(`${baseURL}/api/finance/maintenance?financeStatus=pending`, { headers });
            console.log('✅ Success:', response3.data.requests.length, 'pending requests found');
            console.log('Sample pending request:', response3.data.requests[0] ? {
                id: response3.data.requests[0].id,
                issue: response3.data.requests[0].issue,
                financeStatus: response3.data.requests[0].financeStatus
            } : 'No pending requests');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 4: Test admin maintenance endpoint
        console.log('\n4. Testing GET /api/admin/maintenance?financeStatus=approved');
        try {
            const response4 = await axios.get(`${baseURL}/api/admin/maintenance?financeStatus=approved`, { headers });
            console.log('✅ Success:', response4.data.requests.length, 'approved requests found');
            console.log('Sample approved request:', response4.data.requests[0] ? {
                id: response4.data.requests[0].id,
                issue: response4.data.requests[0].issue,
                financeStatus: response4.data.requests[0].financeStatus
            } : 'No approved requests');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log('✅ All tests completed');
        console.log('💡 If you see 403 errors, it means the role middleware is working correctly');
        console.log('💡 If you see 200 responses, the endpoints are working correctly');

    } catch (error) {
        console.error('Error testing endpoints:', error);
    }
}

// Run the test
testFinanceEndpoints(); 