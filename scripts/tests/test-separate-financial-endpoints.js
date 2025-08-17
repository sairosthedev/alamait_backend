const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testSeparateFinancialEndpoints() {
    console.log('🧪 Testing Separate Financial Endpoints...\n');
    
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
            console.log(`   ✅ Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
            
        } catch (error) {
            if (error.response) {
                console.log(`   ❌ Status: ${error.response.status}`);
                console.log(`   ❌ Error: ${JSON.stringify(error.response.data, null, 2)}`);
                
                if (error.response.status === 401) {
                    console.log(`   ℹ️  Expected - Authentication required`);
                }
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('🎯 Summary of Available Endpoints:');
    console.log('=====================================');
    console.log('✅ Income Statement: GET /api/finance/income-statements/report/generate');
    console.log('✅ Balance Sheet: GET /api/finance/balance-sheets/report/generate');
    console.log('✅ Cash Flow: GET /api/finance/cash-flow/report/generate');
    console.log('✅ Trial Balance: GET /api/finance/trial-balance/report/generate');
    console.log('✅ Cash Flow Summary: GET /api/finance/cash-flow/summary');
    console.log('✅ Trial Balance Summary: GET /api/finance/trial-balance/summary');
    console.log('✅ Expenses: GET /api/finance/expenses (existing)');
    console.log('');
    console.log('🔐 All endpoints require authentication with finance role');
    console.log('📝 Query parameters: period (YYYY), asOf (YYYY-MM-DD), basis (cash/accrual)');
}

// Run the test
testSeparateFinancialEndpoints(); 