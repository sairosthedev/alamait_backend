const axios = require('axios');

async function testAdminApplications() {
  try {
    console.log('Testing admin applications endpoint...');
    
    // Test without authentication first
    const response = await axios.get('http://localhost:5000/api/admin/applications');
    console.log('✅ Success without auth:', response.data);
  } catch (error) {
    console.log('❌ Error without auth:', error.response?.data || error.message);
    
    // If it requires auth, test with a token
    try {
      // You'll need to get a valid admin token from localStorage in the browser
      const token = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual token
      
      const authResponse = await axios.get('http://localhost:5000/api/admin/applications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Success with auth:', authResponse.data);
    } catch (authError) {
      console.log('❌ Error with auth:', authError.response?.data || authError.message);
    }
  }
}

testAdminApplications(); 