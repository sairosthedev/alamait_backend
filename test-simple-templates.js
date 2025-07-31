const axios = require('axios');

// Simple test for the templates endpoint
async function testSimpleTemplates() {
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Simple Templates Endpoint\n');
        
        console.log('Testing GET /api/monthly-requests/templates...');
        const response = await axios.get(
            `${baseUrl}/templates`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                },
                timeout: 10000
            }
        );
        
        console.log('✅ Success! Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Instructions
console.log('📋 Simple Templates Test:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Run this script to test the templates endpoint');
console.log('3. This will help identify if the 500 error is resolved\n');

// Uncomment to run the test
// testSimpleTemplates(); 