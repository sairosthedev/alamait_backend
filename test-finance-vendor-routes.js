const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';

async function testFinanceVendorRoutes() {
    console.log('🧪 Testing Finance Vendor Routes...\n');

    try {
        // Test 1: Search vendors endpoint
        console.log('1️⃣ Testing /api/finance/vendors/search...');
        const searchResponse = await axios.get(`${BASE_URL}/api/finance/vendors/search?query=&limit=10`);
        console.log('✅ Search endpoint working:', searchResponse.status);
        console.log('   Response data:', searchResponse.data);
        console.log('');

        // Test 2: Get all vendors endpoint
        console.log('2️⃣ Testing /api/finance/vendors...');
        const vendorsResponse = await axios.get(`${BASE_URL}/api/finance/vendors`);
        console.log('✅ Vendors endpoint working:', vendorsResponse.status);
        console.log('   Total vendors:', vendorsResponse.data.vendors?.length || 0);
        console.log('');

        // Test 3: Get vendors for quotations endpoint
        console.log('3️⃣ Testing /api/finance/vendors/for-quotations...');
        const quotationsResponse = await axios.get(`${BASE_URL}/api/finance/vendors/for-quotations`);
        console.log('✅ For-quotations endpoint working:', quotationsResponse.status);
        console.log('   Vendors for quotations:', quotationsResponse.data.vendors?.length || 0);
        console.log('');

        console.log('🎉 All finance vendor routes are working correctly!');

    } catch (error) {
        console.error('❌ Error testing finance vendor routes:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
            console.error('   URL:', error.response.config.url);
        } else {
            console.error('   Message:', error.message);
        }
    }
}

// Run the test
testFinanceVendorRoutes(); 