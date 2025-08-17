const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials (you'll need to update these with actual credentials)
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@alamait.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123456';

let authToken = null;

// Login to get auth token
async function login() {
    try {
        console.log('🔐 Logging in to test petty cash routes...');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('✅ Login successful');
            return true;
        } else {
            console.log('❌ Login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Login error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash status endpoint
async function testPettyCashStatus() {
    try {
        console.log('\n📊 Testing petty cash status endpoint...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/petty-cash/status`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Petty cash status endpoint working');
        console.log('Response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash status error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash report endpoint
async function testPettyCashReport() {
    try {
        console.log('\n📋 Testing petty cash report endpoint...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/petty-cash/report`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Petty cash report endpoint working');
        console.log('Response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash report error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash allocation endpoint (from finance routes)
async function testPettyCashAllocation() {
    try {
        console.log('\n💰 Testing petty cash allocation endpoint...');
        
        const response = await axios.post(`${BASE_URL}/api/finance/allocate-petty-cash`, {
            userId: 'test-user-id',
            amount: 100,
            description: 'Test allocation'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Petty cash allocation endpoint working');
        console.log('Response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash allocation error:', error.response?.data || error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Testing Petty Cash Routes Fix');
    console.log('================================');
    
    // Login first
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without login');
        return;
    }
    
    // Test endpoints
    const statusSuccess = await testPettyCashStatus();
    const reportSuccess = await testPettyCashReport();
    const allocationSuccess = await testPettyCashAllocation();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Petty Cash Status: ${statusSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Report: ${reportSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Allocation: ${allocationSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (statusSuccess && reportSuccess && allocationSuccess) {
        console.log('\n🎉 All petty cash routes are working correctly!');
    } else {
        console.log('\n⚠️ Some petty cash routes have issues');
    }
}

// Run the tests
runTests().catch(console.error);
