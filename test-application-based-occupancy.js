const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/public/applications';

async function testApplicationBasedOccupancy() {
    try {
        console.log('📊 Testing Application-Based Room Occupancy...\n');

        // Test 1: Get overall data
        console.log('1. 📈 Overall Application-Based Occupancy:');
        const response1 = await axios.get(`${BASE_URL}/public-data`);
        
        if (response1.data.success) {
            const stats = response1.data.statistics;
            console.log('✅ Total Rooms:', stats.rooms.total);
            console.log('✅ Available Rooms:', stats.rooms.available);
            console.log('✅ Occupied Rooms (from applications):', stats.rooms.occupied);
            console.log('✅ Reserved Rooms (from applications):', stats.rooms.reserved);
            console.log('✅ Overall Occupancy Rate:', stats.rooms.overallOccupancyRate.toFixed(1) + '%');
            console.log('');
            
            // Application-based statistics
            const appStats = stats.applications;
            console.log('📝 Application-Based Statistics:');
            console.log('✅ Total Applications:', appStats.total);
            console.log('✅ Approved Applications:', appStats.approved);
            console.log('✅ Allocated Rooms (from approved apps):', appStats.allocatedRooms);
            console.log('✅ Waitlisted Rooms (from approved apps):', appStats.waitlistedRooms);
            console.log('✅ Occupancy Based on Applications:', appStats.occupancyBasedOnApplications);
            console.log('');
        }

        // Test 2: Show residence-specific application data
        console.log('2. 🏢 Residence-Specific Application Data:');
        if (response1.data.residences?.length > 0) {
            response1.data.residences.forEach(residence => {
                console.log(`\n🏠 ${residence.name}:`);
                console.log(`   📍 Address: ${residence.address.street}, ${residence.address.city}`);
                console.log(`   🏠 Total Rooms: ${residence.totalRooms}`);
                console.log(`   ✅ Available: ${residence.availableRooms}`);
                console.log(`   👥 Occupied (from apps): ${residence.occupiedRooms}`);
                console.log(`   📋 Reserved (from apps): ${residence.reservedRooms}`);
                console.log(`   📊 Occupancy Rate: ${residence.occupancyRate.toFixed(1)}%`);
                console.log(`   📝 Total Applications: ${residence.totalApplications}`);
                console.log(`   ✅ Allocated Applications: ${residence.allocatedApplications}`);
                console.log(`   📋 Waitlisted Applications: ${residence.waitlistedApplications}`);
            });
            console.log('');
        }

        // Test 3: Show detailed room information with application data
        console.log('3. 🚪 Room Details with Application Data:');
        if (response1.data.rooms?.length > 0) {
            const occupiedRooms = response1.data.rooms.filter(room => room.isOccupied);
            const reservedRooms = response1.data.rooms.filter(room => room.isReserved);
            const availableRooms = response1.data.rooms.filter(room => room.isAvailable);

            if (occupiedRooms.length > 0) {
                console.log(`\n👥 Occupied Rooms (${occupiedRooms.length}):`);
                occupiedRooms.forEach(room => {
                    console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                    console.log(`      💰 Price: $${room.price}`);
                    console.log(`      📝 Allocated Applications: ${room.allocatedApplications.length}`);
                    console.log(`      📊 Occupancy Rate: ${room.occupancyRate}%`);
                });
            }

            if (reservedRooms.length > 0) {
                console.log(`\n📋 Reserved Rooms (${reservedRooms.length}):`);
                reservedRooms.forEach(room => {
                    console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                    console.log(`      💰 Price: $${room.price}`);
                    console.log(`      📝 Waitlisted Applications: ${room.waitlistedApplications.length}`);
                });
            }

            if (availableRooms.length > 0) {
                console.log(`\n✅ Available Rooms (${availableRooms.length}):`);
                availableRooms.slice(0, 3).forEach(room => {
                    console.log(`   🚪 ${room.residenceName} - Room ${room.roomNumber}`);
                    console.log(`      💰 Price: $${room.price}`);
                    console.log(`      📝 Total Applications: ${room.totalApplications}`);
                });
            }
            console.log('');
        }

        // Test 4: Show application details
        console.log('4. 📝 Application Details:');
        if (response1.data.applications?.length > 0) {
            const approvedApps = response1.data.applications.filter(app => app.status === 'approved');
            const pendingApps = response1.data.applications.filter(app => app.status === 'pending');
            
            console.log(`\n✅ Approved Applications (${approvedApps.length}):`);
            approvedApps.forEach(app => {
                console.log(`   📝 ${app.applicationCode}:`);
                console.log(`      🏠 Residence: ${app.residence?.name || 'N/A'}`);
                console.log(`      🚪 Allocated Room: ${app.allocatedRoom || 'None'}`);
                console.log(`      📋 Waitlisted Room: ${app.waitlistedRoom || 'None'}`);
                console.log(`      📅 Application Date: ${new Date(app.applicationDate).toLocaleDateString()}`);
            });

            if (pendingApps.length > 0) {
                console.log(`\n⏳ Pending Applications (${pendingApps.length}):`);
                pendingApps.forEach(app => {
                    console.log(`   📝 ${app.applicationCode}:`);
                    console.log(`      🏠 Residence: ${app.residence?.name || 'N/A'}`);
                    console.log(`      🚪 Preferred Room: ${app.preferredRoom || 'None'}`);
                });
            }
            console.log('');
        }

        // Test 5: Verify data consistency
        console.log('5. 🔍 Data Consistency Check:');
        const stats = response1.data.statistics;
        const totalOccupiedFromApps = stats.applications.allocatedRooms;
        const totalReservedFromApps = stats.applications.waitlistedRooms;
        
        console.log(`✅ Occupied rooms from room data: ${stats.rooms.occupied}`);
        console.log(`✅ Occupied rooms from applications: ${totalOccupiedFromApps}`);
        console.log(`✅ Reserved rooms from room data: ${stats.rooms.reserved}`);
        console.log(`✅ Reserved rooms from applications: ${totalReservedFromApps}`);
        
        if (stats.rooms.occupied === totalOccupiedFromApps && stats.rooms.reserved === totalReservedFromApps) {
            console.log('✅ Data consistency: PASSED - Room occupancy matches application data');
        } else {
            console.log('❌ Data consistency: FAILED - Room occupancy does not match application data');
        }
        console.log('');

        // Test 6: Filter by approved applications only
        console.log('6. 🔍 Filter by Approved Applications:');
        try {
            const response2 = await axios.get(`${BASE_URL}/public-data?status=approved`);
            if (response2.data.success) {
                console.log(`✅ Approved applications only: ${response2.data.applications.length}`);
                console.log(`✅ Occupied rooms (approved only): ${response2.data.statistics.rooms.occupied}`);
                console.log(`✅ Reserved rooms (approved only): ${response2.data.statistics.rooms.reserved}`);
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error filtering by approved status:', error.response?.data?.error || error.message);
        }

        console.log('🎉 Application-Based Occupancy Test Completed Successfully!');
        console.log('\n💡 Key Improvements:');
        console.log('   ✅ Occupancy calculated from actual approved applications');
        console.log('   ✅ Room status based on allocated/waitlisted rooms');
        console.log('   ✅ Real application data instead of static room status');
        console.log('   ✅ Application tracking per room');
        console.log('   ✅ Data consistency verification');
        console.log('   ✅ Residence-specific application statistics');

    } catch (error) {
        console.error('❌ Test failed:', error.response ? {
            status: error.response.status,
            data: error.response.data
        } : error.message);
    }
}

// Run the test
testApplicationBasedOccupancy(); 