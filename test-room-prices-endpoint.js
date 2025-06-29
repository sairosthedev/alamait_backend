const axios = require('axios');

async function testRoomPricesEndpoint() {
    try {
        console.log('Testing room prices endpoint...');
        
        // Test the room prices endpoint
        const response = await axios.get('http://localhost:3000/api/finance/room-prices', {
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Replace with actual token
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Room prices endpoint working!');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing room prices endpoint:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Also test the stats endpoint
async function testRoomPricesStatsEndpoint() {
    try {
        console.log('\nTesting room prices stats endpoint...');
        
        const response = await axios.get('http://localhost:3000/api/finance/room-prices/stats', {
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Replace with actual token
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Room prices stats endpoint working!');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing room prices stats endpoint:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test applications endpoint too
async function testApplicationsEndpoint() {
    try {
        console.log('\nTesting applications endpoint...');
        
        const response = await axios.get('http://localhost:3000/api/finance/applications', {
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Replace with actual token
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Applications endpoint working!');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing applications endpoint:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run all tests
async function runAllTests() {
    await testRoomPricesEndpoint();
    await testRoomPricesStatsEndpoint();
    await testApplicationsEndpoint();
}

runAllTests(); 