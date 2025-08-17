const axios = require('axios');

// Test the transaction endpoints to debug the issue
async function testTransactionEndpoints() {
    const baseURL = 'https://alamait-backend.onrender.com/api';
    const token = 'YOUR_JWT_TOKEN'; // Replace with actual token
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('🧪 Testing Transaction Endpoints...\n');

        // Test 1: Get transaction entries
        console.log('1. Testing get transaction entries...');
        const entriesResponse = await axios.get(`${baseURL}/transactions/entries?page=1&limit=10`, { headers });
        console.log('✅ Entries response:', JSON.stringify(entriesResponse.data, null, 2));

        // Test 2: Get transaction summary
        console.log('\n2. Testing get transaction summary...');
        const summaryResponse = await axios.get(`${baseURL}/transactions/summary`, { headers });
        console.log('✅ Summary response:', JSON.stringify(summaryResponse.data, null, 2));

        // Test 3: Check if there are any transaction entries in the database
        console.log('\n3. Testing raw database query...');
        const rawResponse = await axios.get(`${baseURL}/transactions/entries?page=1&limit=1`, { headers });
        console.log('✅ Raw response structure:', {
            success: rawResponse.data.success,
            dataLength: rawResponse.data.data?.length || 0,
            pagination: rawResponse.data.pagination
        });

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testTransactionEndpoints(); 