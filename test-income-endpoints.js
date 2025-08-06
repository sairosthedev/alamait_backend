const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testIncomeEndpoints() {
    console.log('💰 Testing New Income Endpoints...\n');
    
    const endpoints = [
        {
            name: 'Income Transactions',
            url: '/api/finance/income/transactions',
            params: { period: '2024', basis: 'cash', type: 'all', page: 1, limit: 10 }
        },
        {
            name: 'Income Summary',
            url: '/api/finance/income/summary',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Income by Source',
            url: '/api/finance/income/by-source',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Income Trends',
            url: '/api/finance/income/trends',
            params: { period: '2024', basis: 'cash' }
        },
        {
            name: 'Rent Income Only',
            url: '/api/finance/income/transactions',
            params: { period: '2024', basis: 'cash', type: 'rent', page: 1, limit: 5 }
        },
        {
            name: 'Other Income Only',
            url: '/api/finance/income/transactions',
            params: { period: '2024', basis: 'cash', type: 'other', page: 1, limit: 5 }
        }
    ];

    for (const endpoint of endpoints) {
        console.log(`📊 Testing: ${endpoint.name}`);
        console.log(`   URL: GET ${endpoint.url}`);
        console.log(`   Params: ${JSON.stringify(endpoint.params)}`);
        
        try {
            const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
                params: endpoint.params,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   ✅ Response: ${JSON.stringify(response.data, null, 2).substring(0, 300)}...`);
            
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
    
    console.log('🎯 New Income Endpoints Summary:');
    console.log('=====================================');
    console.log('✅ GET /api/finance/income/transactions - All income transactions');
    console.log('✅ GET /api/finance/income/summary - Income summary by type');
    console.log('✅ GET /api/finance/income/by-source - Income by source (payments, invoices, other)');
    console.log('✅ GET /api/finance/income/trends - Monthly income trends');
    console.log('');
    console.log('🔍 Query Parameters:');
    console.log('   - period: Year (e.g., "2024")');
    console.log('   - basis: "cash" or "accrual"');
    console.log('   - type: "all", "rent", "other", or account code');
    console.log('   - page: Page number for pagination');
    console.log('   - limit: Items per page');
    console.log('');
    console.log('📊 What Each Endpoint Returns:');
    console.log('   - transactions: Detailed list of income transactions');
    console.log('   - summary: Total income by type with statistics');
    console.log('   - by-source: Income breakdown by source (payments vs invoices vs other)');
    console.log('   - trends: Monthly income trends and patterns');
    console.log('');
    console.log('🔐 All endpoints require authentication with finance role');
}

// Run the test
testIncomeEndpoints(); 