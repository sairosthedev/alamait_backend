const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testEndpointsNoAuth() {
    console.log('🧪 Testing API Endpoints (No Auth)...');
    console.log('=====================================');
    console.log('');

    try {
        // Test 1: Basic health check
        console.log('1️⃣ Testing GET /health');
        try {
            const response = await axios.get('http://localhost:5000/health');
            console.log('   ✅ Success!');
            console.log('   📊 Status:', response.data.status);
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        console.log('');

        // Test 2: Root endpoint
        console.log('2️⃣ Testing GET /');
        try {
            const response = await axios.get('http://localhost:5000/');
            console.log('   ✅ Success!');
            console.log('   📊 Message:', response.data.message);
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        console.log('');

        // Test 3: Check if rental accrual routes exist (should get 401 Unauthorized, not 404)
        console.log('3️⃣ Testing GET /api/rental-accrual/outstanding-balances (expecting 401)');
        try {
            const response = await axios.get(`${API_BASE_URL}/rental-accrual/outstanding-balances`);
            console.log('   ⚠️ Unexpected success (no auth required):', response.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('   ✅ Route exists but requires authentication (401 Unauthorized)');
            } else if (error.response?.status === 404) {
                console.log('   ❌ Route not found (404)');
            } else {
                console.log('   ❌ Unexpected error:', error.response?.status, error.message);
            }
        }
        console.log('');

        // Test 4: Check if financial reports routes exist
        console.log('4️⃣ Testing GET /api/financial-reports/income-statement (expecting 401)');
        try {
            const response = await axios.get(`${API_BASE_URL}/financial-reports/income-statement?period=2025&basis=accrual`);
            console.log('   ⚠️ Unexpected success (no auth required):', response.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('   ✅ Route exists but requires authentication (401 Unauthorized)');
            } else if (error.response?.status === 404) {
                console.log('   ❌ Route not found (404)');
            } else {
                console.log('   ❌ Unexpected error:', error.response?.status, error.message);
            }
        }
        console.log('');

        // Test 5: Check if routes are registered in app.js
        console.log('5️⃣ Checking if routes are properly registered...');
        try {
            // Try to access a route that should exist
            const response = await axios.get(`${API_BASE_URL}/rental-accrual/outstanding-balances`);
            console.log('   ❌ Route accessible without auth (security issue)');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('   ✅ Route properly protected with authentication');
                console.log('   💡 This means the route exists and is working!');
            } else {
                console.log('   ❌ Route not working:', error.response?.status, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tests
testEndpointsNoAuth();
