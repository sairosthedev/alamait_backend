const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testTemplatesEndpoint() {
    try {
        console.log('Testing GET /api/monthly-requests/templates...');
        
        const response = await axios.get(`${BASE_URL}/api/monthly-requests/templates`, {
            headers: {
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Error:');
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data);
        console.log('Error:', error.message);
    }
}

testTemplatesEndpoint(); 