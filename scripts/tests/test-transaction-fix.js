const axios = require('axios');

// Test the fixed transaction endpoints
async function testTransactionFix() {
    const baseURL = 'https://alamait-backend.onrender.com/api';
    const token = 'YOUR_JWT_TOKEN'; // Replace with actual token
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('🧪 Testing Fixed Transaction Endpoints...\n');

        // Test 1: Get transaction entries
        console.log('1. Testing get transaction entries...');
        const entriesResponse = await axios.get(`${baseURL}/transactions/entries?page=1&limit=10`, { headers });
        console.log('✅ Entries response structure:', {
            success: entriesResponse.data.success,
            dataLength: entriesResponse.data.data?.length || 0,
            pagination: entriesResponse.data.pagination
        });

        if (entriesResponse.data.data && entriesResponse.data.data.length > 0) {
            console.log('✅ Sample transaction:', entriesResponse.data.data[0]);
        }

        // Test 2: Get transaction summary
        console.log('\n2. Testing get transaction summary...');
        const summaryResponse = await axios.get(`${baseURL}/transactions/summary`, { headers });
        console.log('✅ Summary response:', summaryResponse.data);

        // Test 3: Test with filters
        console.log('\n3. Testing with filters...');
        const filteredResponse = await axios.get(`${baseURL}/transactions/entries?page=1&limit=5&type=debit`, { headers });
        console.log('✅ Filtered response structure:', {
            success: filteredResponse.data.success,
            dataLength: filteredResponse.data.data?.length || 0,
            pagination: filteredResponse.data.pagination
        });

        console.log('\n🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testTransactionFix(); 