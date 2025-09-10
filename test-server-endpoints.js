const axios = require('axios');

// Test script to check if server endpoints are working
const BASE_URL = 'http://localhost:5000/api';

async function testEndpoints() {
    try {
        console.log('🔍 Testing server endpoints...');
        
        // Test 1: Check if server is running
        console.log('\n1️⃣ Testing server connectivity...');
        try {
            const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
            console.log('✅ Server is running');
        } catch (error) {
            console.log('❌ Server is not running or health endpoint not available');
            console.log('   Error:', error.message);
            return;
        }

        // Test 2: Test /finance/accounts endpoint
        console.log('\n2️⃣ Testing /finance/accounts endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/finance/accounts`, { timeout: 5000 });
            console.log('✅ /finance/accounts endpoint working');
            console.log(`   Response: ${Array.isArray(response.data) ? response.data.length + ' accounts' : 'Not an array'}`);
        } catch (error) {
            console.log('❌ /finance/accounts endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
            console.log('   Message:', error.response?.data?.message || error.message);
        }

        // Test 3: Test /finance/transaction-accounts endpoint
        console.log('\n3️⃣ Testing /finance/transaction-accounts endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/finance/transaction-accounts`, { timeout: 5000 });
            console.log('✅ /finance/transaction-accounts endpoint working');
            console.log(`   Response: ${response.data?.success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.log('❌ /finance/transaction-accounts endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
            console.log('   Message:', error.response?.data?.message || error.message);
        }

        // Test 4: Test financial reports endpoints (with required parameters)
        console.log('\n4️⃣ Testing financial reports endpoints...');
        
        // Test income statement
        try {
            const response = await axios.get(`${BASE_URL}/financial-reports/income-statement?period=2025&basis=cash`, { timeout: 5000 });
            console.log('✅ Income statement endpoint working');
        } catch (error) {
            console.log('❌ Income statement endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
        }

        // Test balance sheet
        try {
            const response = await axios.get(`${BASE_URL}/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash`, { timeout: 5000 });
            console.log('✅ Balance sheet endpoint working');
        } catch (error) {
            console.log('❌ Balance sheet endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
        }

        // Test cash flow
        try {
            const response = await axios.get(`${BASE_URL}/financial-reports/cash-flow?period=2025&basis=cash`, { timeout: 5000 });
            console.log('✅ Cash flow endpoint working');
        } catch (error) {
            console.log('❌ Cash flow endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
        }

        // Test 5: Test debtors endpoint
        console.log('\n5️⃣ Testing /finance/debtors endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/finance/debtors`, { timeout: 5000 });
            console.log('✅ /finance/debtors endpoint working');
            console.log(`   Response: ${response.data?.success ? 'Success' : 'Failed'}`);
            console.log(`   Debtors count: ${response.data?.debtors?.length || 0}`);
        } catch (error) {
            console.log('❌ /finance/debtors endpoint failed');
            console.log('   Error:', error.response?.status, error.response?.statusText);
            console.log('   Message:', error.response?.data?.message || error.message);
        }

        console.log('\n✅ Endpoint testing completed!');
        
    } catch (error) {
        console.error('❌ Error testing endpoints:', error.message);
    }
}

testEndpoints();
