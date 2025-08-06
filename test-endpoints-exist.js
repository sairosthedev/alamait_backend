const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testEndpointsExist() {
    console.log('🔍 Testing if Financial Endpoints Exist...\n');
    
    const endpoints = [
        {
            name: 'Income Statement Report',
            url: '/api/finance/income-statements/report/generate',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Balance Sheet Report',
            url: '/api/finance/balance-sheets/report/generate',
            params: { asOf: '2024-12-31', basis: 'cash' }
        },
        {
            name: 'Cash Flow Report',
            url: '/api/finance/cash-flow/report/generate',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Trial Balance Report',
            url: '/api/finance/trial-balance/report/generate',
            params: { asOf: '2024-12-31', basis: 'cash' }
        },
        {
            name: 'Cash Flow Summary',
            url: '/api/finance/cash-flow/summary',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Trial Balance Summary',
            url: '/api/finance/trial-balance/summary',
            params: { asOf: '2024-12-31', basis: 'cash' }
        },
        {
            name: 'Existing Expenses',
            url: '/api/finance/expenses',
            params: {}
        }
    ];

    for (const endpoint of endpoints) {
        console.log(`📊 Testing: ${endpoint.name}`);
        console.log(`   URL: GET ${endpoint.url}`);
        
        try {
            const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
                params: endpoint.params,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   ✅ Response: ${JSON.stringify(response.data, null, 2).substring(0, 100)}...`);
            
        } catch (error) {
            if (error.response) {
                console.log(`   📍 Status: ${error.response.status}`);
                console.log(`   📍 Response: ${JSON.stringify(error.response.data, null, 2)}`);
                
                if (error.response.status === 401) {
                    console.log(`   ✅ ENDPOINT EXISTS - Authentication required`);
                } else if (error.response.status === 404) {
                    console.log(`   ❌ ENDPOINT NOT FOUND - 404 Error`);
                } else {
                    console.log(`   ⚠️  ENDPOINT EXISTS - Other error: ${error.response.status}`);
                }
            } else {
                console.log(`   ❌ Network Error: ${error.message}`);
            }
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('🎯 Summary:');
    console.log('=====================================');
    console.log('✅ If you see "Authentication required" - ENDPOINT EXISTS');
    console.log('❌ If you see "Not Found" - ENDPOINT DOES NOT EXIST');
    console.log('🔐 All working endpoints require authentication');
    console.log('');
    console.log('📝 To test with authentication, you need to:');
    console.log('   1. Login to get a JWT token');
    console.log('   2. Include Authorization header: Bearer <token>');
}

// Run the test
testEndpointsExist(); 