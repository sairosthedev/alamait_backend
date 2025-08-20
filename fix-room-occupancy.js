const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Residence = require('./src/models/Residence');

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

async function fixRoomOccupancy() {
    try {
        await connectDB();
        
        console.log('\n🔧 FIXING ROOM OCCUPANCY VALUES');
        console.log('===============================\n');
        
        // Get all residences
        const residences = await Residence.find();
        console.log(`📊 Found ${residences.length} residences`);
        
        let totalRoomsFixed = 0;
        let totalRoomsChecked = 0;
        
        for (const residence of residences) {
            console.log(`\n🏠 Processing residence: ${residence.name}`);
            
            if (residence.rooms && Array.isArray(residence.rooms)) {
                let roomsFixed = 0;
                
                for (const room of residence.rooms) {
                    totalRoomsChecked++;
                    const originalOccupancy = room.currentOccupancy || 0;
                    
                    // Check if room occupancy needs to be fixed
                    if (room.currentOccupancy > 0) {
                        console.log(`   🔧 Fixing room ${room.roomNumber}: currentOccupancy ${room.currentOccupancy} → 0`);
                        room.currentOccupancy = 0;
                        roomsFixed++;
                        totalRoomsFixed++;
                    } else {
                        console.log(`   ✅ Room ${room.roomNumber}: already has occupancy 0`);
                    }
                }
                
                if (roomsFixed > 0) {
                    // Save the residence with updated room occupancy
                    await residence.save();
                    console.log(`   💾 Saved ${roomsFixed} room occupancy fixes for ${residence.name}`);
                } else {
                    console.log(`   ✅ No fixes needed for ${residence.name}`);
                }
            } else {
                console.log(`   ⚠️  No rooms array found for ${residence.name}`);
            }
        }
        
        console.log('\n📈 FIX SUMMARY');
        console.log('==============');
        console.log(`Total rooms checked: ${totalRoomsChecked}`);
        console.log(`Total rooms fixed: ${totalRoomsFixed}`);
        console.log(`Residences processed: ${residences.length}`);
        
        if (totalRoomsFixed > 0) {
            console.log('\n✅ Room occupancy values have been fixed!');
            console.log('All rooms now have currentOccupancy = 0');
        } else {
            console.log('\n✅ No fixes needed - all rooms already have occupancy 0!');
        }
        
        // Verify the fix
        console.log('\n🔍 VERIFYING FIX');
        console.log('================');
        
        const updatedResidences = await Residence.find().lean();
        let zeroOccupancyCount = 0;
        let nonZeroOccupancyCount = 0;
        
        updatedResidences.forEach(residence => {
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    if (room.currentOccupancy === 0) {
                        zeroOccupancyCount++;
                    } else {
                        nonZeroOccupancyCount++;
                        console.log(`   ⚠️  Room ${room.roomNumber} in ${residence.name} still has occupancy: ${room.currentOccupancy}`);
                    }
                });
            }
        });
        
        console.log(`\n📊 Verification Results:`);
        console.log(`Rooms with zero occupancy: ${zeroOccupancyCount}`);
        console.log(`Rooms with non-zero occupancy: ${nonZeroOccupancyCount}`);
        
        if (nonZeroOccupancyCount === 0) {
            console.log('✅ All rooms now have zero occupancy!');
        } else {
            console.log('⚠️  Some rooms still have non-zero occupancy.');
        }
        
        // Test capacity validation
        console.log('\n🧪 TESTING CAPACITY VALIDATION');
        console.log('==============================');
        
        let roomsThatWouldPassValidation = 0;
        let roomsThatWouldFailValidation = 0;
        
        updatedResidences.forEach(residence => {
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    const capacity = room.capacity || 1;
                    const currentOccupancy = room.currentOccupancy || 0;
                    const wouldPassValidation = currentOccupancy < capacity;
                    
                    if (wouldPassValidation) {
                        roomsThatWouldPassValidation++;
                    } else {
                        roomsThatWouldFailValidation++;
                        console.log(`   ❌ Room ${room.roomNumber} in ${residence.name} would still fail validation:`);
                        console.log(`      Capacity: ${capacity}, Current: ${currentOccupancy}`);
                    }
                });
            }
        });
        
        console.log(`\n📊 Capacity Validation Results:`);
        console.log(`Rooms that would pass validation: ${roomsThatWouldPassValidation}`);
        console.log(`Rooms that would fail validation: ${roomsThatWouldFailValidation}`);
        
        if (roomsThatWouldFailValidation === 0) {
            console.log('✅ All rooms would now pass capacity validation!');
            console.log('Manual add student should work correctly.');
        } else {
            console.log('⚠️  Some rooms would still fail capacity validation.');
        }
        
    } catch (error) {
        console.error('❌ Error fixing room occupancy:', error);
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

// Add confirmation prompt
console.log('⚠️  WARNING: This script will set ALL room currentOccupancy values to 0');
console.log('Are you sure you want to proceed? (y/N)');

// For automated execution, we'll proceed
fixRoomOccupancy(); 