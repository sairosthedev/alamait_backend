const axios = require('axios');
require('dotenv').config();

async function getAuthToken() {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'your_admin_email@example.com',
      password: 'your_admin_password'
    });

    if (response.data && response.data.token) {
      console.log('\nYour AUTH_TOKEN (copy this to .env file):\n');
      console.log(response.data.token);
      console.log('\n');
    } else {
      console.error('No token received in response');
    }
  } catch (error) {
    console.error('Error getting token:', error.response?.data || error.message);
  }
}

getAuthToken();