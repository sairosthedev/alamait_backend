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

async function debugRoomCapacity() {
    try {
        await connectDB();
        
        console.log('\n🔍 DEBUGGING ROOM CAPACITY ISSUE');
        console.log('==================================\n');
        
        // Get all residences
        const residences = await Residence.find().lean();
        console.log(`📊 Found ${residences.length} residences`);
        
        let totalRooms = 0;
        let fullCapacityRooms = 0;
        let availableRooms = 0;
        
        residences.forEach((residence, index) => {
            console.log(`\n🏠 Residence ${index + 1}: ${residence.name} (${residence._id})`);
            console.log(`   Total rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    totalRooms++;
                    const capacity = room.capacity || 1;
                    const currentOccupancy = room.currentOccupancy || 0;
                    const isFull = currentOccupancy >= capacity;
                    
                    console.log(`   - Room ${room.roomNumber}:`);
                    console.log(`     Status: ${room.status}`);
                    console.log(`     Capacity: ${capacity}`);
                    console.log(`     Current Occupancy: ${currentOccupancy}`);
                    console.log(`     Is Full: ${isFull ? 'YES ❌' : 'NO ✅'}`);
                    console.log(`     Type: ${room.type || 'unknown'}`);
                    console.log(`     Price: $${room.price || 'unknown'}`);
                    
                    if (isFull) {
                        fullCapacityRooms++;
                        console.log(`     ⚠️  This room would fail capacity validation!`);
                    } else {
                        availableRooms++;
                    }
                });
            } else {
                console.log('   ⚠️  No rooms array found');
            }
        });
        
        console.log('\n📈 ROOM CAPACITY SUMMARY');
        console.log('========================');
        console.log(`Total rooms: ${totalRooms}`);
        console.log(`Available rooms (not full): ${availableRooms}`);
        console.log(`Full capacity rooms: ${fullCapacityRooms}`);
        
        console.log('\n🔍 MANUAL ADD STUDENT VALIDATION');
        console.log('================================');
        console.log('Backend validation checks: room.currentOccupancy >= room.capacity');
        console.log(`Rooms that would pass validation: ${availableRooms}`);
        console.log(`Rooms that would fail validation: ${fullCapacityRooms}`);
        
        if (fullCapacityRooms > 0) {
            console.log('\n❌ PROBLEM IDENTIFIED:');
            console.log('Some rooms have currentOccupancy >= capacity');
            console.log('This causes the "Room is at full capacity" error');
            console.log('\n💡 SOLUTION:');
            console.log('Need to reset currentOccupancy to 0 for all rooms');
        } else {
            console.log('\n✅ NO CAPACITY ISSUES FOUND');
            console.log('All rooms should pass capacity validation');
        }
        
        // Show specific rooms that are at full capacity
        if (fullCapacityRooms > 0) {
            console.log('\n🚨 ROOMS AT FULL CAPACITY:');
            console.log('==========================');
            residences.forEach(residence => {
                if (residence.rooms && Array.isArray(residence.rooms)) {
                    residence.rooms.forEach(room => {
                        const capacity = room.capacity || 1;
                        const currentOccupancy = room.currentOccupancy || 0;
                        const isFull = currentOccupancy >= capacity;
                        
                        if (isFull) {
                            console.log(`   - ${residence.name} - Room ${room.roomNumber}:`);
                            console.log(`     Capacity: ${capacity}, Current: ${currentOccupancy}`);
                        }
                    });
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
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

debugRoomCapacity(); 