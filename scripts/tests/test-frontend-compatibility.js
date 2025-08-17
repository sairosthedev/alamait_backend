const axios = require('axios');

async function testFrontendCompatibility() {
    try {
        console.log('🔧 Testing Frontend Compatibility Routes...\n');

        // Test 1: Test the original route
        console.log('1. Testing original route: /api/public/applications/public-data');
        try {
            const response1 = await axios.get('http://localhost:5000/api/public/applications/public-data');
            console.log('✅ Original route works:', response1.status);
        } catch (error) {
            console.log('❌ Original route failed:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Test the frontend compatibility route
        console.log('\n2. Testing frontend compatibility route: /api/applications/public/public-data');
        try {
            const response2 = await axios.get('http://localhost:5000/api/applications/public/public-data');
            console.log('✅ Frontend compatibility route works:', response2.status);
            console.log('✅ Data received:', response2.data.success);
            console.log('✅ Statistics:', response2.data.statistics?.rooms?.total || 0, 'rooms');
        } catch (error) {
            console.log('❌ Frontend compatibility route failed:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Test the exact route the frontend is calling
        console.log('\n3. Testing exact frontend route: /api/applications/public');
        try {
            const response3 = await axios.get('http://localhost:5000/api/applications/public');
            console.log('✅ Exact frontend route works:', response3.status);
        } catch (error) {
            console.log('❌ Exact frontend route failed:', error.response?.status, error.response?.data?.error || error.message);
        }

        console.log('\n🎉 Frontend compatibility test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testFrontendCompatibility(); 