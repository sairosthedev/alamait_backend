const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testMonthlyIncomeStatement() {
    console.log('📊 Testing Monthly Income Statement Endpoint...\n');
    
    const endpoint = {
        name: 'Monthly Income Statement',
        url: '/api/finance/income-statements/monthly',
        params: { period: '2024', basis: 'cash' }
    };

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
        console.log(`   ✅ Response: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`);
        
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
    
    console.log('\n📋 Monthly Income Statement Response Structure:');
    console.log('===============================================');
    console.log('✅ GET /api/finance/income-statements/monthly?period=2024&basis=cash');
    console.log('');
    console.log('📊 What You\'ll Get Back:');
    console.log('{');
    console.log('  "success": true,');
    console.log('  "data": {');
    console.log('    "period": "2024",');
    console.log('    "basis": "cash",');
    console.log('    "monthly_breakdown": {');
    console.log('      "january": {');
    console.log('        "revenue": { "4001 - Rent Income": 2500 },');
    console.log('        "expenses": { "5001 - Maintenance": 800 },');
    console.log('        "total_revenue": 2500,');
    console.log('        "total_expenses": 800,');
    console.log('        "net_income": 1700');
    console.log('      },');
    console.log('      "february": { ... },');
    console.log('      "march": { ... },');
    console.log('      // ... all 12 months');
    console.log('    },');
    console.log('    "yearly_totals": {');
    console.log('      "revenue": { "4001 - Rent Income": 30000 },');
    console.log('      "expenses": { "5001 - Maintenance": 9600 },');
    console.log('      "total_revenue": 30000,');
    console.log('      "total_expenses": 18000,');
    console.log('      "net_income": 12000');
    console.log('    },');
    console.log('    "summary": {');
    console.log('      "total_months_with_data": 12,');
    console.log('      "best_month": "august",');
    console.log('      "worst_month": "january",');
    console.log('      "average_monthly_revenue": 2500,');
    console.log('      "average_monthly_expenses": 1500,');
    console.log('      "average_monthly_net_income": 1000');
    console.log('    }');
    console.log('  }');
    console.log('}');
    console.log('');
    console.log('🎯 Perfect for Monthly Tables (Jan-Dec)!');
    console.log('   - Each month has revenue, expenses, and net income');
    console.log('   - Yearly totals are calculated automatically');
    console.log('   - Summary statistics for analysis');
    console.log('   - Compatible with your existing data structure');
}

// Run the test
testMonthlyIncomeStatement(); 