const axios = require('axios');

/**
 * Test script for the Payment Allocation API
 */

const BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on different port
const STUDENT_ID = '68adf1dc088169424e25c8ab'; // Cindy's student ID

async function testPaymentAllocationAPI() {
  try {
    console.log('🧪 Testing Payment Allocation API...\n');
    
    // Test 1: Test payment allocation with $380 payment
    console.log('1️⃣ Testing POST /api/finance/students/{studentId}/test-allocation');
    console.log(`   URL: ${BASE_URL}/api/finance/students/${STUDENT_ID}/test-allocation`);
    console.log('   Payment: $380 (Rent: $180, Admin: $20, Deposit: $180)');
    
    const paymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ]
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/finance/students/${STUDENT_ID}/test-allocation`,
      paymentData
    );
    
    if (response.status === 200) {
      console.log('✅ SUCCESS: Payment allocation test completed!');
      console.log('📊 Allocation Results:');
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
testPaymentAllocationAPI();
