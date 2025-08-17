const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Testing login endpoint...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@alamait.com',
      password: 'Admin@123'
    });
    
    console.log('✅ Login successful!');
    console.log('Token:', response.data.token);
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testLogin(); 