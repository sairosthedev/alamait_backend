const axios = require('axios');

/**
 * Test script for the new Smart FIFO Payment Endpoint
 * POST /api/admin/payments/smart-fifo
 */

async function testSmartFifoEndpoint() {
  try {
    console.log('🚀 Testing Smart FIFO Payment Endpoint...\n');
    
    // Test payment data (similar to what frontend would send)
    const testPaymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      student: '68adf1dc088169424e25c8ab', // Cindy's student ID
      residence: '67d723cf20f89c4ae69804f3', // Residence ID
      method: 'Cash',
      date: '2025-06-13T00:00:00.000Z'
    };
    
    console.log('💰 Test Payment Data:');
    console.log(JSON.stringify(testPaymentData, null, 2));
    
    // Test the new Smart FIFO endpoint
    console.log('\n🎯 Testing POST /api/admin/payments/smart-fifo...');
    
    const response = await axios.post('http://localhost:5000/api/admin/payments/smart-fifo', testPaymentData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE' // Replace with actual token
      }
    });
    
    console.log('\n✅ Smart FIFO Payment Created Successfully!');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.payment.allocation === 'Completed') {
      console.log('\n🎯 Smart FIFO Allocation Completed!');
      console.log(`   Payment ID: ${response.data.payment.paymentId}`);
      console.log(`   Total Amount: $${response.data.payment.totalAmount}`);
      console.log(`   Status: ${response.data.payment.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('📊 Error Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error(`   Status: ${error.response.status}`);
    }
  }
}

// Run the test
testSmartFifoEndpoint();
