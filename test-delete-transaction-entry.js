require('dotenv').config();
const axios = require('axios');

// Test the DELETE endpoint for transaction entries
async function testDeleteTransactionEntry() {
  try {
    console.log('🧪 Testing DELETE transaction entry endpoint...');
    
    // First, let's get a list of transaction entries to find one to delete
    const listResponse = await axios.get('http://localhost:5000/api/finance/transactions/entries', {
      headers: {
        'Authorization': `Bearer ${process.env.TEST_TOKEN || 'your-test-token-here'}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Found transaction entries:', listResponse.data.data?.length || 0);
    
    if (listResponse.data.data && listResponse.data.data.length > 0) {
      const firstEntry = listResponse.data.data[0];
      console.log('🗑️ Attempting to delete entry:', firstEntry._id);
      
      // Try to delete the first entry
      const deleteResponse = await axios.delete(`http://localhost:5000/api/finance/transactions/entries/${firstEntry._id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_TOKEN || 'your-test-token-here'}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Delete response:', deleteResponse.data);
    } else {
      console.log('⚠️ No transaction entries found to test deletion');
    }
    
  } catch (error) {
    console.error('❌ Error testing DELETE endpoint:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

// Run the test
testDeleteTransactionEntry();





