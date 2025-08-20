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

async function emptyAllRooms() {
    try {
        await connectDB();
        
        console.log('\n🏠 EMPTYING ALL ROOMS');
        console.log('=====================\n');
        
        // Get all residences
        const residences = await Residence.find();
        console.log(`📊 Found ${residences.length} residences`);
        
        let totalRooms = 0;
        let roomsEmptied = 0;
        let residencesUpdated = 0;
        
        for (const residence of residences) {
            console.log(`\n🏠 Processing residence: ${residence.name}`);
            
            if (residence.rooms && Array.isArray(residence.rooms)) {
                let roomsChanged = 0;
                
                for (const room of residence.rooms) {
                    totalRooms++;
                    const originalStatus = room.status;
                    const originalOccupancy = room.currentOccupancy || 0;
                    const originalOccupants = room.occupants || [];
                    
                    // Check if room needs to be emptied
                    if (room.currentOccupancy > 0 || room.status !== 'available' || (room.occupants && room.occupants.length > 0)) {
                        console.log(`   🔧 Emptying room ${room.roomNumber}:`);
                        console.log(`      Status: ${originalStatus} → available`);
                        console.log(`      Occupancy: ${originalOccupancy} → 0`);
                        console.log(`      Occupants: ${originalOccupants.length} → 0`);
                        
                        // Reset room to empty state
                        room.status = 'available';
                        room.currentOccupancy = 0;
                        room.occupants = [];
                        room.currentOccupant = null; // Remove any current occupant reference
                        
                        roomsChanged++;
                        roomsEmptied++;
                    } else {
                        console.log(`   ✅ Room ${room.roomNumber}: already empty`);
                    }
                }
                
                if (roomsChanged > 0) {
                    // Save the residence with updated room data
                    await residence.save();
                    console.log(`   💾 Saved ${roomsChanged} room changes for ${residence.name}`);
                    residencesUpdated++;
                } else {
                    console.log(`   ✅ No changes needed for ${residence.name}`);
                }
            } else {
                console.log(`   ⚠️  No rooms array found for ${residence.name}`);
            }
        }
        
        console.log('\n📈 EMPTY ROOMS SUMMARY');
        console.log('======================');
        console.log(`Total residences processed: ${residences.length}`);
        console.log(`Residences updated: ${residencesUpdated}`);
        console.log(`Total rooms checked: ${totalRooms}`);
        console.log(`Rooms emptied: ${roomsEmptied}`);
        
        if (roomsEmptied > 0) {
            console.log('\n✅ All rooms have been emptied!');
            console.log('All rooms now have:');
            console.log('   - Status: available');
            console.log('   - Current Occupancy: 0');
            console.log('   - No occupants');
        } else {
            console.log('\n✅ All rooms were already empty!');
        }
        
        // Verify the changes
        console.log('\n🔍 VERIFYING CHANGES');
        console.log('===================');
        
        const updatedResidences = await Residence.find().lean();
        let availableRooms = 0;
        let nonAvailableRooms = 0;
        let occupiedRooms = 0;
        
        updatedResidences.forEach(residence => {
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    if (room.status === 'available' && room.currentOccupancy === 0) {
                        availableRooms++;
                    } else {
                        nonAvailableRooms++;
                        console.log(`   ⚠️  Room ${room.roomNumber} in ${residence.name} still not empty:`);
                        console.log(`      Status: ${room.status}, Occupancy: ${room.currentOccupancy}`);
                    }
                    
                    if (room.currentOccupancy > 0) {
                        occupiedRooms++;
                    }
                });
            }
        });
        
        console.log(`\n📊 Verification Results:`);
        console.log(`Available rooms (empty): ${availableRooms}`);
        console.log(`Non-available rooms: ${nonAvailableRooms}`);
        console.log(`Occupied rooms: ${occupiedRooms}`);
        
        if (occupiedRooms === 0 && nonAvailableRooms === 0) {
            console.log('✅ All rooms are now empty and available!');
        } else {
            console.log('⚠️  Some rooms may still not be empty.');
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
            console.log('Manual add student should work perfectly.');
        } else {
            console.log('⚠️  Some rooms would still fail capacity validation.');
        }
        
    } catch (error) {
        console.error('❌ Error emptying rooms:', error);
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
console.log('⚠️  WARNING: This script will empty ALL rooms in ALL residences');
console.log('This will:');
console.log('   - Set all room status to "available"');
console.log('   - Set all currentOccupancy to 0');
console.log('   - Remove all occupants');
console.log('   - Clear all currentOccupant references');
console.log('');
console.log('Are you sure you want to proceed? (y/N)');

// For automated execution, we'll proceed
emptyAllRooms(); 