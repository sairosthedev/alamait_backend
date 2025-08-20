const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Residence = require('./src/models/Residence');
const Application = require('./src/models/Application');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

async function compareResidenceEndpoints() {
    try {
        await connectDB();
        
        console.log('\n🔍 COMPARING RESIDENCE ENDPOINTS');
        console.log('================================\n');
        
        // Get all residences directly from database
        const allResidences = await Residence.find().lean();
        console.log(`📊 Total residences in database: ${allResidences.length}`);
        
        // Simulate what the public endpoint would return
        console.log('\n🌐 PUBLIC ENDPOINT SIMULATION (/residences)');
        console.log('==========================================');
        
        const publicResidences = allResidences.map(residence => ({
            _id: residence._id,
            name: residence.name,
            description: residence.description,
            address: residence.address,
            rooms: residence.rooms.map(room => ({
                roomNumber: room.roomNumber,
                type: room.type,
                capacity: room.capacity,
                price: room.price,
                status: room.status,
                currentOccupancy: room.currentOccupancy || 0,
                floor: room.floor,
                area: room.area,
                features: room.features || []
            }))
        }));
        
        console.log(`Public endpoint would return ${publicResidences.length} residences`);
        publicResidences.forEach((residence, index) => {
            console.log(`  ${index + 1}. ${residence.name} - ${residence.rooms.length} rooms`);
            residence.rooms.forEach(room => {
                console.log(`     - Room ${room.roomNumber}: ${room.status} (${room.type}) - $${room.price}`);
            });
        });
        
        // Simulate what the admin endpoint would return
        console.log('\n🔧 ADMIN ENDPOINT SIMULATION (/admin/residences)');
        console.log('===============================================');
        
        // Get approved applications for room counts
        const approvedApplications = await Application.find({ status: 'approved' });
        console.log(`Found ${approvedApplications.length} approved applications`);
        
        const adminResidences = allResidences.map(residence => {
            const roomsWithCounts = residence.rooms.map(room => {
                const approvedCount = approvedApplications.filter(app => {
                    // Match by allocatedRoom and residence
                    const matchesRoom = app.allocatedRoom === room.roomNumber;
                    // If allocatedRoomDetails exists, check residenceId
                    let matchesResidence = true;
                    if (app.allocatedRoomDetails && app.allocatedRoomDetails.residenceId) {
                        matchesResidence = app.allocatedRoomDetails.residenceId.toString() === residence._id.toString();
                    }
                    return matchesRoom && matchesResidence;
                }).length;
                
                return {
                    ...room,
                    approvedCount
                };
            });
            
            return {
                ...residence,
                rooms: roomsWithCounts
            };
        });
        
        console.log(`Admin endpoint would return ${adminResidences.length} residences`);
        adminResidences.forEach((residence, index) => {
            console.log(`  ${index + 1}. ${residence.name} - ${residence.rooms.length} rooms`);
            residence.rooms.forEach(room => {
                console.log(`     - Room ${room.roomNumber}: ${room.status} (${room.type}) - $${room.price} - Approved: ${room.approvedCount}`);
            });
        });
        
        // Compare the differences
        console.log('\n📊 COMPARISON SUMMARY');
        console.log('=====================');
        
        console.log('\n🔍 KEY DIFFERENCES:');
        console.log('1. Public endpoint (/residences):');
        console.log('   - Returns basic room information');
        console.log('   - No approved application counts');
        console.log('   - Used by landing page and manual add student');
        
        console.log('\n2. Admin endpoint (/admin/residences):');
        console.log('   - Returns enhanced room information');
        console.log('   - Includes approvedCount for each room');
        console.log('   - Used by room management');
        
        // Check for specific differences in room data
        console.log('\n🔍 DETAILED ROOM COMPARISON:');
        console.log('============================');
        
        for (let i = 0; i < allResidences.length; i++) {
            const residence = allResidences[i];
            console.log(`\n🏠 ${residence.name}:`);
            
            residence.rooms.forEach(room => {
                const approvedCount = approvedApplications.filter(app => {
                    const matchesRoom = app.allocatedRoom === room.roomNumber;
                    let matchesResidence = true;
                    if (app.allocatedRoomDetails && app.allocatedRoomDetails.residenceId) {
                        matchesResidence = app.allocatedRoomDetails.residenceId.toString() === residence._id.toString();
                    }
                    return matchesRoom && matchesResidence;
                }).length;
                
                console.log(`   Room ${room.roomNumber}:`);
                console.log(`     - Status: ${room.status}`);
                console.log(`     - Capacity: ${room.capacity}`);
                console.log(`     - Current Occupancy: ${room.currentOccupancy || 0}`);
                console.log(`     - Approved Applications: ${approvedCount}`);
                console.log(`     - Available: ${(room.currentOccupancy || 0) < room.capacity ? 'YES' : 'NO'}`);
            });
        }
        
        // Check which endpoint manual add student should use
        console.log('\n💡 RECOMMENDATION FOR MANUAL ADD STUDENT:');
        console.log('========================================');
        
        console.log('✅ Manual add student should use ADMIN endpoint (/admin/residences) because:');
        console.log('   1. It provides more accurate room availability data');
        console.log('   2. It includes approved application counts');
        console.log('   3. It matches what room management uses');
        console.log('   4. It provides better data consistency');
        
        console.log('\n❌ Current manual add student uses PUBLIC endpoint (/residences) which:');
        console.log('   1. Has less detailed room information');
        console.log('   2. Doesn\'t include approved application counts');
        console.log('   3. May not reflect the most current room status');
        
        console.log('\n🔄 SUGGESTED FIX:');
        console.log('Change manual add student to use getAllResidences() from adminService');
        console.log('This will ensure consistency with room management data');
        
    } catch (error) {
        console.error('❌ Comparison failed:', error);
    } finally {
        try {
            await mongoose.connection.close();
            console.log('\n✅ Database connection closed');
        } catch (closeError) {
            console.log('⚠️  Error closing database connection:', closeError.message);
        }
        process.exit(0);
    }
}

compareResidenceEndpoints(); 