const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testFinancialReportsEndpoint() {
    try {
        console.log('Testing Financial Reports Endpoint...\n');
        
        // Test the income statement endpoint
        console.log('1. Testing Income Statement Endpoint:');
        console.log('GET /api/financial-reports/income-statement?period=2024&basis=cash');
        
        const response = await axios.get(`${BASE_URL}/api/financial-reports/income-statement`, {
            params: {
                period: '2024',
                basis: 'cash'
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Success! Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Error occurred:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Run the test
testFinancialReportsEndpoint(); 