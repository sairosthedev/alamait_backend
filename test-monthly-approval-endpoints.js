const axios = require('axios');

// Test the monthly approval endpoints
async function testMonthlyApprovalEndpoints() {
    const baseURL = 'http://localhost:3000/api';
    const token = 'YOUR_JWT_TOKEN'; // Replace with actual token
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('🧪 Testing Monthly Approval Endpoints...\n');

        // Test 1: Submit template for month
        console.log('1. Testing submit template for month...');
        const submitResponse = await axios.post(`${baseURL}/monthly-requests/TEMPLATE_ID/submit-month`, {
            month: 1,
            year: 2025,
            submittedBy: 'USER_ID',
            submittedByEmail: 'admin@example.com',
            items: [
                {
                    description: 'Test Item',
                    quantity: 1,
                    unitPrice: 100,
                    amount: 100
                }
            ],
            totalEstimatedCost: 100
        }, { headers });

        console.log('✅ Submit response:', submitResponse.data);

        // Test 2: Approve template for month
        console.log('\n2. Testing approve template for month...');
        const approveResponse = await axios.post(`${baseURL}/monthly-requests/TEMPLATE_ID/approve-month`, {
            month: 1,
            year: 2025,
            status: 'approved',
            notes: 'Test approval'
        }, { headers });

        console.log('✅ Approve response:', approveResponse.data);

        // Test 3: Get monthly approval status
        console.log('\n3. Testing get monthly approval status...');
        const statusResponse = await axios.get(`${baseURL}/monthly-requests/TEMPLATE_ID/approval-status/1/2025`, { headers });

        console.log('✅ Status response:', statusResponse.data);

        console.log('\n🎉 All tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testMonthlyApprovalEndpoints(); 