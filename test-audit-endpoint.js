const axios = require('axios');

async function testAuditEndpoint() {
  try {
    console.log('🧪 Testing audit logs endpoint...');
    
    // Test the endpoint
    const response = await axios.get('http://localhost:5000/api/finance/audit-log', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Endpoint response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing endpoint:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testAuditEndpoint(); 