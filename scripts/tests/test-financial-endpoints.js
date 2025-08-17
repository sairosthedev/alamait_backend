const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const authToken = 'your-auth-token-here'; // Replace with actual token

// Test financial reports endpoints
async function testFinancialReports() {
    console.log('🧪 Testing Financial Reports Endpoints...\n');

    try {
        // Test 1: Income Statement
        console.log('📊 Testing Income Statement...');
        const incomeResponse = await axios.get(`${BASE_URL}/financial-reports/income-statement?period=2025&basis=cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Income Statement - Status:', incomeResponse.status);
        console.log('📋 Data:', JSON.stringify(incomeResponse.data, null, 2));
        console.log('');

        // Test 2: Balance Sheet
        console.log('📋 Testing Balance Sheet...');
        const balanceResponse = await axios.get(`${BASE_URL}/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Balance Sheet - Status:', balanceResponse.status);
        console.log('📋 Data:', JSON.stringify(balanceResponse.data, null, 2));
        console.log('');

        // Test 3: Cash Flow Statement
        console.log('💰 Testing Cash Flow Statement...');
        const cashFlowResponse = await axios.get(`${BASE_URL}/financial-reports/cash-flow?period=2025&basis=cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Cash Flow Statement - Status:', cashFlowResponse.status);
        console.log('📋 Data:', JSON.stringify(cashFlowResponse.data, null, 2));
        console.log('');

        // Test 4: Trial Balance
        console.log('⚖️ Testing Trial Balance...');
        const trialBalanceResponse = await axios.get(`${BASE_URL}/financial-reports/trial-balance?asOf=2025-12-31&basis=cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Trial Balance - Status:', trialBalanceResponse.status);
        console.log('📋 Data:', JSON.stringify(trialBalanceResponse.data, null, 2));
        console.log('');

    } catch (error) {
        console.error('❌ Error testing financial reports:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('URL:', error.config?.url);
    }
}

// Test transaction endpoints
async function testTransactionEndpoints() {
    console.log('🧪 Testing Transaction Endpoints...\n');

    try {
        // Test 1: Get All Transactions
        console.log('📊 Testing Get All Transactions...');
        const transactionsResponse = await axios.get(`${BASE_URL}/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Get All Transactions - Status:', transactionsResponse.status);
        console.log('📋 Data:', JSON.stringify(transactionsResponse.data, null, 2));
        console.log('');

        // Test 2: Get Transaction Summary
        console.log('📊 Testing Transaction Summary...');
        const summaryResponse = await axios.get(`${BASE_URL}/finance/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Transaction Summary - Status:', summaryResponse.status);
        console.log('📋 Data:', JSON.stringify(summaryResponse.data, null, 2));
        console.log('');

    } catch (error) {
        console.error('❌ Error testing transaction endpoints:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('URL:', error.config?.url);
    }
}

// Test that financial reports don't conflict with transaction routes
async function testNoConflicts() {
    console.log('🧪 Testing for Route Conflicts...\n');

    try {
        // This should NOT go to transaction routes
        console.log('📊 Testing that /financial-reports/income-statement does NOT conflict...');
        const response = await axios.get(`${BASE_URL}/financial-reports/income-statement?period=2025&basis=cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Check that we got financial report data, not transaction data
        if (response.data.success && response.data.data && response.data.data.revenue) {
            console.log('✅ SUCCESS: Got financial report data (not transaction data)');
            console.log('📋 Revenue data found:', Object.keys(response.data.data.revenue));
        } else {
            console.log('❌ ERROR: Got wrong data type');
            console.log('📋 Response:', JSON.stringify(response.data, null, 2));
        }
        console.log('');

    } catch (error) {
        console.error('❌ Error testing route conflicts:', error.response?.data || error.message);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Financial System Tests...\n');
    
    await testFinancialReports();
    await testTransactionEndpoints();
    await testNoConflicts();
    
    console.log('🎉 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testFinancialReports,
    testTransactionEndpoints,
    testNoConflicts,
    runAllTests
}; 