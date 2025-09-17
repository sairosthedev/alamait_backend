require('dotenv').config();
const axios = require('axios');

// Test listing transaction entries
async function testListTransactionEntries() {
  try {
    console.log('🧪 Testing GET transaction entries endpoint...');
    
    const response = await axios.get('http://localhost:5000/api/finance/transactions/entries', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', response.data);
    
  } catch (error) {
    console.error('❌ Error testing GET endpoint:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    
    if (error.response?.status === 401) {
      console.log('🔐 Authentication required - this is expected');
    }
  }
}

// Run the test
testListTransactionEntries();














