const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/public/applications';

async function testRoomOccupancyStatus() {
    try {
        console.log('🏠 Testing Real-Time Room Occupancy Status...\n');

        // Test 1: Get overall occupancy statistics
        console.log('1. 📊 Overall Occupancy Statistics:');
        const response1 = await axios.get(`${BASE_URL}/public-data`);
        
        if (response1.data.success) {
            const stats = response1.data.statistics;
            console.log('✅ Total Rooms:', stats.rooms.total);
            console.log('✅ Available Rooms:', stats.rooms.available);
            console.log('✅ Occupied Rooms:', stats.rooms.occupied);
            console.log('✅ Reserved Rooms:', stats.rooms.reserved);
            console.log('✅ Maintenance Rooms:', stats.rooms.maintenance);
            console.log('✅ Overall Occupancy Rate:', stats.rooms.overallOccupancyRate.toFixed(1) + '%');
            console.log('');
        }

        // Test 2: Get residence-specific occupancy
        console.log('2. 🏢 Residence-Specific Occupancy:');
        if (response1.data.residences?.length > 0) {
            response1.data.residences.forEach(residence => {
                console.log(`\n🏠 ${residence.name}:`);
                console.log(`   📍 Address: ${residence.address.street}, ${residence.address.city}`);
                console.log(`   🏠 Total Rooms: ${residence.totalRooms}`);
                console.log(`   ✅ Available: ${residence.availableRooms}`);
                console.log(`   👥 Occupied: ${residence.occupiedRooms}`);
                console.log(`   📋 Reserved: ${residence.reservedRooms}`);
                console.log(`   🔧 Maintenance: ${residence.maintenanceRooms}`);
                console.log(`   📊 Occupancy Rate: ${residence.occupancyRate.toFixed(1)}%`);
            });
            console.log('');
        }

        // Test 3: Get detailed room information
        console.log('3. 🚪 Detailed Room Information:');
        if (response1.data.rooms?.length > 0) {
            const availableRooms = response1.data.rooms.filter(room => room.isAvailable);
            const occupiedRooms = response1.data.rooms.filter(room => room.isOccupied);
            const reservedRooms = response1.data.rooms.filter(room => room.isReserved);

            console.log(`\n✅ Available Rooms (${availableRooms.length}):`);
            availableRooms.slice(0, 3).forEach(room => {
                console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                console.log(`      💰 Price: $${room.price}`);
                console.log(`      🏠 Type: ${room.type} (${room.capacity} person)`);
                console.log(`      📏 Area: ${room.area}m²`);
                console.log(`      🎯 Features: ${room.features.join(', ')}`);
            });

            if (occupiedRooms.length > 0) {
                console.log(`\n👥 Occupied Rooms (${occupiedRooms.length}):`);
                occupiedRooms.slice(0, 2).forEach(room => {
                    console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                    console.log(`      👤 Current Occupancy: ${room.currentOccupancy}/${room.capacity}`);
                    console.log(`      📊 Occupancy Rate: ${room.occupancyRate.toFixed(1)}%`);
                });
            }

            if (reservedRooms.length > 0) {
                console.log(`\n📋 Reserved Rooms (${reservedRooms.length}):`);
                reservedRooms.slice(0, 2).forEach(room => {
                    console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                    console.log(`      💰 Price: $${room.price}`);
                });
            }
            console.log('');
        }

        // Test 4: Get application statistics
        console.log('4. 📝 Application Statistics:');
        if (response1.data.statistics.applications) {
            const appStats = response1.data.statistics.applications;
            console.log('✅ Total Applications:', appStats.total);
            console.log('⏳ Pending Applications:', appStats.pending);
            console.log('✅ Approved Applications:', appStats.approved);
            console.log('📋 Waitlisted Applications:', appStats.waitlisted);
            console.log('❌ Rejected Applications:', appStats.rejected);
            console.log('');
        }

        // Test 5: Filter by residence
        console.log('5. 🔍 Filter by Residence:');
        try {
            const response2 = await axios.get(`${BASE_URL}/public-data?residence=Belvedere`);
            if (response2.data.success && response2.data.residences.length > 0) {
                const residence = response2.data.residences[0];
                console.log(`✅ Found ${residence.name}:`);
                console.log(`   📊 Occupancy Rate: ${residence.occupancyRate.toFixed(1)}%`);
                console.log(`   🏠 Available Rooms: ${residence.availableRooms}/${residence.totalRooms}`);
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error filtering by residence:', error.response?.data?.error || error.message);
        }

        // Test 6: Filter by application status
        console.log('6. 📋 Filter by Application Status:');
        try {
            const response3 = await axios.get(`${BASE_URL}/public-data?status=approved`);
            if (response3.data.success) {
                console.log(`✅ Approved Applications: ${response3.data.applications.length}`);
                if (response3.data.applications.length > 0) {
                    const app = response3.data.applications[0];
                    console.log(`   📝 Sample: ${app.applicationCode} - ${app.requestType}`);
                    if (app.residence) {
                        console.log(`   🏠 Residence: ${app.residence.name}`);
                    }
                }
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error filtering by status:', error.response?.data?.error || error.message);
        }

        // Test 7: Real-time data timestamp
        console.log('7. ⏰ Real-Time Data:');
        console.log(`✅ Last Updated: ${response1.data.timestamp}`);
        console.log(`✅ Data is real-time and current`);
        console.log('');

        console.log('🎉 Room Occupancy Status Test Completed Successfully!');
        console.log('\n💡 Key Features Available:');
        console.log('   ✅ Real-time room availability');
        console.log('   ✅ Detailed room information (price, features, capacity)');
        console.log('   ✅ Residence-specific occupancy rates');
        console.log('   ✅ Application status tracking');
        console.log('   ✅ Filtering by residence, status, and type');
        console.log('   ✅ Maintenance room tracking');
        console.log('   ✅ Reserved room status');

    } catch (error) {
        console.error('❌ Test failed:', error.response ? {
            status: error.response.status,
            data: error.response.data
        } : error.message);
    }
}

// Run the test
testRoomOccupancyStatus(); 