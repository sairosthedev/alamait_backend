const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testLogin() {
  try {
    console.log('Testing login endpoint...');
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@alamait.com',
      password: 'Admin@123'
    });
    
    console.log('Login successful:', response.status);
    console.log('Token received:', response.data.token ? 'Yes' : 'No');
    
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testLogin(); 