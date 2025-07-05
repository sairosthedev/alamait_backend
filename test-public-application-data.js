const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/public/applications';

async function testPublicApplicationData() {
    try {
        console.log('Testing public application data endpoint...\n');

        // Test 1: Get all data
        console.log('1. Testing GET /public-data (all data):');
        const response1 = await axios.get(`${BASE_URL}/public-data`);
        console.log('Status:', response1.status);
        console.log('Success:', response1.data.success);
        console.log('Statistics:', response1.data.statistics);
        console.log('Residences count:', response1.data.residences.length);
        console.log('Rooms count:', response1.data.rooms.length);
        console.log('Applications count:', response1.data.applications.length);
        console.log('');

        // Test 2: Filter by residence
        console.log('2. Testing GET /public-data?residence=Macdonald:');
        const response2 = await axios.get(`${BASE_URL}/public-data?residence=Macdonald`);
        console.log('Status:', response2.status);
        console.log('Success:', response2.data.success);
        console.log('Filtered residences count:', response2.data.residences.length);
        console.log('Filtered rooms count:', response2.data.rooms.length);
        console.log('');

        // Test 3: Filter by application status
        console.log('3. Testing GET /public-data?status=approved:');
        const response3 = await axios.get(`${BASE_URL}/public-data?status=approved`);
        console.log('Status:', response3.status);
        console.log('Success:', response3.data.success);
        console.log('Approved applications count:', response3.data.applications.length);
        console.log('');

        // Test 4: Filter by application type
        console.log('4. Testing GET /public-data?type=boarding:');
        const response4 = await axios.get(`${BASE_URL}/public-data?type=boarding`);
        console.log('Status:', response4.status);
        console.log('Success:', response4.data.success);
        console.log('Boarding applications count:', response4.data.applications.length);
        console.log('');

        // Test 5: Combined filters
        console.log('5. Testing GET /public-data?residence=Macdonald&status=approved:');
        const response5 = await axios.get(`${BASE_URL}/public-data?residence=Macdonald&status=approved`);
        console.log('Status:', response5.status);
        console.log('Success:', response5.data.success);
        console.log('Combined filter results - residences:', response5.data.residences.length);
        console.log('Combined filter results - applications:', response5.data.applications.length);
        console.log('');

        // Display sample room data
        if (response1.data.rooms.length > 0) {
            console.log('Sample room data:');
            console.log(JSON.stringify(response1.data.rooms[0], null, 2));
            console.log('');
        }

        // Display sample residence stats
        if (response1.data.residences.length > 0) {
            console.log('Sample residence statistics:');
            console.log(JSON.stringify(response1.data.residences[0], null, 2));
            console.log('');
        }

        console.log('✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.response ? {
            status: error.response.status,
            data: error.response.data
        } : error.message);
    }
}

// Run the test
testPublicApplicationData(); 