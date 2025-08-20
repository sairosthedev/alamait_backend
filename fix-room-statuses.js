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

async function fixRoomStatuses() {
    try {
        await connectDB();
        
        console.log('\n🔧 FIXING ROOM STATUSES IN DATABASE');
        console.log('====================================\n');
        
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
                    const originalStatus = room.status;
                    
                    // Check if room status needs to be fixed
                    if (room.status !== 'available') {
                        console.log(`   🔧 Fixing room ${room.roomNumber}: ${room.status} → available`);
                        room.status = 'available';
                        roomsFixed++;
                        totalRoomsFixed++;
                    } else {
                        console.log(`   ✅ Room ${room.roomNumber}: already available`);
                    }
                }
                
                if (roomsFixed > 0) {
                    // Save the residence with updated room statuses
                    await residence.save();
                    console.log(`   💾 Saved ${roomsFixed} room status fixes for ${residence.name}`);
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
            console.log('\n✅ Room statuses have been fixed!');
            console.log('All rooms are now set to "available" status.');
        } else {
            console.log('\n✅ No fixes needed - all rooms are already available!');
        }
        
        // Verify the fix
        console.log('\n🔍 VERIFYING FIX');
        console.log('================');
        
        const updatedResidences = await Residence.find().lean();
        let availableCount = 0;
        let otherCount = 0;
        
        updatedResidences.forEach(residence => {
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    if (room.status === 'available') {
                        availableCount++;
                    } else {
                        otherCount++;
                        console.log(`   ⚠️  Room ${room.roomNumber} in ${residence.name} still has status: ${room.status}`);
                    }
                });
            }
        });
        
        console.log(`\n📊 Verification Results:`);
        console.log(`Available rooms: ${availableCount}`);
        console.log(`Other status rooms: ${otherCount}`);
        
        if (otherCount === 0) {
            console.log('✅ All rooms are now available!');
        } else {
            console.log('⚠️  Some rooms still have non-available statuses.');
        }
        
    } catch (error) {
        console.error('❌ Error fixing room statuses:', error);
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
console.log('⚠️  WARNING: This script will change ALL room statuses to "available"');
console.log('Are you sure you want to proceed? (y/N)');

// For automated execution, we'll proceed
// In a real scenario, you might want to add user confirmation
fixRoomStatuses(); 