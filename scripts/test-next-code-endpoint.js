const axios = require('axios');

async function testNextCodeEndpoint() {
  try {
    console.log('🧪 Testing next-code endpoint...\n');
    
    // Test the next-code endpoint
    const response = await axios.get('http://localhost:5000/api/finance/accounts/next-code', {
      params: {
        type: 'Asset',
        category: 'Current Assets'
      }
    });
    
    console.log('✅ Next-code endpoint response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing next-code endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testNextCodeEndpoint();
