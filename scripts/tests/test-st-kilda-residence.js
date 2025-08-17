const axios = require('axios');

async function testStKildaResidence() {
    try {
        console.log('🏠 Testing St Kilda Residence Endpoint...\n');

        // Test 1: Test the St Kilda residence endpoint
        console.log('1. Testing GET /api/residences/st-kilda');
        try {
            const response1 = await axios.get('http://localhost:5000/api/residences/st-kilda');
            console.log('✅ Status:', response1.status);
            console.log('✅ Success:', response1.data.success);
            
            if (response1.data.success && response1.data.data) {
                const residence = response1.data.data;
                console.log('✅ Residence Name:', residence.name);
                console.log('✅ Total Rooms:', residence.rooms?.length || 0);
                console.log('✅ Address:', residence.address?.street, residence.address?.city);
                
                if (residence.rooms && residence.rooms.length > 0) {
                    console.log('\n📋 Room Details:');
                    residence.rooms.slice(0, 3).forEach(room => {
                        console.log(`   🚪 ${room.roomNumber}:`);
                        console.log(`      💰 Price: $${room.price}`);
                        console.log(`      🏠 Type: ${room.type}`);
                        console.log(`      👥 Capacity: ${room.capacity}`);
                        console.log(`      📊 Current Occupancy: ${room.currentOccupancy}`);
                        console.log(`      📋 Status: ${room.status}`);
                    });
                }
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            console.log('❌ Full error response:', error.response?.data);
            console.log('');
        }

        // Test 2: Test the public applications endpoint (which is working)
        console.log('2. Testing GET /api/applications/public (for comparison)');
        try {
            const response2 = await axios.get('http://localhost:5000/api/applications/public');
            console.log('✅ Status:', response2.status);
            console.log('✅ Success:', response2.data.success);
            
            if (response2.data.success && response2.data.residences) {
                const stKildaResidence = response2.data.residences.find(r => 
                    r.name.toLowerCase().includes('st kilda')
                );
                if (stKildaResidence) {
                    console.log('✅ Found St Kilda in public data:');
                    console.log('   📊 Occupancy Rate:', stKildaResidence.occupancyRate + '%');
                    console.log('   🏠 Available Rooms:', stKildaResidence.availableRooms);
                    console.log('   👥 Occupied Rooms:', stKildaResidence.occupiedRooms);
                }
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        console.log('🎉 St Kilda Residence Test Completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testStKildaResidence(); 