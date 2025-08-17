const axios = require('axios');

// Replace with your actual Render backend URL
const RENDER_API_BASE_URL = 'https://your-backend-name.onrender.com/api';

async function testRenderBackend() {
    console.log('🧪 Testing Render Backend API Endpoints...');
    console.log('==========================================');
    console.log('');

    try {
        // Test 1: Health check
        console.log('1️⃣ Testing GET /health');
        try {
            const response = await axios.get(RENDER_API_BASE_URL.replace('/api', '') + '/health');
            console.log('   ✅ Success!');
            console.log('   📊 Status:', response.data.status);
            console.log('   🌐 Environment:', response.data.environment);
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.status, error.message);
        }
        console.log('');

        // Test 2: Root endpoint
        console.log('2️⃣ Testing GET /');
        try {
            const response = await axios.get(RENDER_API_BASE_URL.replace('/api', ''));
            console.log('   ✅ Success!');
            console.log('   📊 Message:', response.data.message);
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.status, error.message);
        }
        console.log('');

        // Test 3: Rental accrual routes (expecting 401 - no auth)
        console.log('3️⃣ Testing GET /api/rental-accrual/outstanding-balances (expecting 401)');
        try {
            const response = await axios.get(`${RENDER_API_BASE_URL}/rental-accrual/outstanding-balances`);
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

        // Test 4: Financial reports routes (expecting 401 - no auth)
        console.log('4️⃣ Testing GET /api/financial-reports/income-statement (expecting 401)');
        try {
            const response = await axios.get(`${RENDER_API_BASE_URL}/financial-reports/income-statement?period=2025&basis=accrual`);
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

        console.log('💡 If you see 401 errors, your routes are working!');
        console.log('💡 You just need to authenticate in your frontend.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Instructions for the user
console.log('📝 INSTRUCTIONS:');
console.log('================');
console.log('1. Replace "your-backend-name" in the RENDER_API_BASE_URL with your actual Render service name');
console.log('2. Run this script to test your Render backend');
console.log('3. Make sure your Render service is running and accessible');
console.log('');

// Run the tests
testRenderBackend();
