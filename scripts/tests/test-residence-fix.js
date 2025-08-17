const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = '67c023adae5e27657502e887'; // Use the same user ID from your test
const TEST_RESIDENCE_ID = '67d723cf20f89c4ae69804f3'; // Use the same residence ID from your test

// Test data
const testAllocation = {
    userId: TEST_USER_ID,
    amount: 50, // Smaller amount for testing
    description: 'Test allocation with residence',
    residence: TEST_RESIDENCE_ID,
    sourceAccount: '1001', // Bank account
    targetAccount: '1011'  // Admin Petty Cash
};

async function testResidenceHandling() {
    try {
        console.log('🧪 Testing Residence Field Handling in Petty Cash Allocation');
        console.log('=' .repeat(60));
        
        console.log('\n📤 Request Payload:');
        console.log(JSON.stringify(testAllocation, null, 2));
        
        console.log('\n📡 Making API call to /finance/allocate-petty-cash...');
        
        const response = await axios.post(`${BASE_URL}/api/finance/allocate-petty-cash`, testAllocation, {
            headers: {
                'Content-Type': 'application/json',
                // Note: You'll need to add proper authentication headers here
                // 'Authorization': 'Bearer YOUR_TOKEN'
            }
        });
        
        console.log('\n✅ Response received:');
        console.log('Status:', response.status);
        console.log('Response data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Check if residence is included in response
        const responseData = response.data;
        if (responseData.success && responseData.allocation) {
            const allocation = responseData.allocation;
            
            console.log('\n🔍 Residence Field Analysis:');
            console.log('Request included residence:', !!testAllocation.residence);
            console.log('Response includes residence:', !!allocation.residence);
            console.log('Request residence ID:', testAllocation.residence);
            console.log('Response residence ID:', allocation.residence);
            
            if (allocation.residence) {
                console.log('✅ SUCCESS: Residence field is now being returned in the response!');
                
                if (allocation.residence === testAllocation.residence) {
                    console.log('✅ EXCELLENT: Residence ID matches between request and response!');
                } else {
                    console.log('⚠️  WARNING: Residence ID mismatch - request vs response');
                }
            } else {
                console.log('❌ FAILURE: Residence field is still missing from response');
            }
        } else {
            console.log('❌ ERROR: Invalid response format');
        }
        
    } catch (error) {
        console.error('\n❌ Error during test:');
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
        
        console.log('\n💡 Troubleshooting Tips:');
        console.log('1. Make sure your backend server is running on port 3000');
        console.log('2. Check if you need to add authentication headers');
        console.log('3. Verify the user ID and residence ID exist in your database');
        console.log('4. Check backend console logs for any errors');
    }
}

// Run the test
console.log('🚀 Starting Residence Field Test...\n');
testResidenceHandling();
