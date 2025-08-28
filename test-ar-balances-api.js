const axios = require('axios');

/**
 * Test script for the new Student AR Balances API
 */

const BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on different port
const STUDENT_ID = '68adf1dc088169424e25c8ab'; // Cindy's student ID

async function testARBalancesAPI() {
  try {
    console.log('🧪 Testing Student AR Balances API...\n');
    
    // Test 1: Get detailed outstanding balances
    console.log('1️⃣ Testing GET /api/finance/students/{studentId}/ar-balances');
    console.log(`   URL: ${BASE_URL}/api/finance/students/${STUDENT_ID}/ar-balances`);
    
    const response = await axios.get(`${BASE_URL}/api/finance/students/${STUDENT_ID}/ar-balances`);
    
    if (response.status === 200) {
      console.log('✅ SUCCESS: AR Balances endpoint is working!');
      console.log('📊 Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Unexpected status:', response.status);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error Response:');
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    } else if (error.request) {
      console.log('❌ Network Error: No response received');
      console.log('   Make sure your server is running on port 3000');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Run the test
testARBalancesAPI();
