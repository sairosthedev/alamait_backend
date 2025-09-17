/**
 * Script to test room availability for Extension 1
 * 
 * This script checks the current room occupancy and availability
 * for the specific room that's causing the booking issue.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');
const RoomStatusManager = require('../utils/roomStatusManager');
const Residence = require('../models/Residence');
const Application = require('../models/Application');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function testRoomAvailability() {
  try {
    console.log('🔍 Testing room availability for Extension 1...');
    
    // Find the St Kilda residence
    const residence = await Residence.findOne({ name: 'St Kilda Student House' });
    if (!residence) {
      console.log('❌ St Kilda Student House not found');
      return;
    }
    
    console.log(`✅ Found residence: ${residence.name} (ID: ${residence._id})`);
    
    // Find Extension 1 room
    const room = residence.rooms.find(r => r.roomNumber === 'Extension 1');
    if (!room) {
      console.log('❌ Extension 1 room not found');
      return;
    }
    
    console.log(`✅ Found room: ${room.roomNumber}`);
    console.log(`   - Current occupancy: ${room.currentOccupancy || 0}`);
    console.log(`   - Capacity: ${room.capacity || 1}`);
    console.log(`   - Status: ${room.status}`);
    
    // Check accurate occupancy using the utility
    const accurateOccupancy = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(
      residence._id, 
      'Extension 1'
    );
    
    console.log('\n📊 Accurate occupancy calculation:');
    console.log(`   - Current occupancy: ${accurateOccupancy.currentOccupancy}`);
    console.log(`   - Capacity: ${accurateOccupancy.capacity}`);
    console.log(`   - Occupancy rate: ${accurateOccupancy.occupancyRate.toFixed(1)}%`);
    console.log(`   - Is full: ${accurateOccupancy.isFull}`);
    console.log(`   - Is available: ${accurateOccupancy.isAvailable}`);
    console.log(`   - Valid students: ${accurateOccupancy.validStudents.length}`);
    
    if (accurateOccupancy.validStudents.length > 0) {
      console.log('\n👥 Students currently in room:');
      accurateOccupancy.validStudents.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} (${student.email}) - Status: ${student.status}`);
      });
    }
    
    // Check applications for this room
    const applications = await Application.find({
      residence: residence._id,
      allocatedRoom: 'Extension 1',
      status: { $nin: ['expired', 'cancelled', 'rejected'] }
    });
    
    console.log(`\n📋 Active applications for Extension 1: ${applications.length}`);
    applications.forEach((app, index) => {
      console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} (${app.email}) - Status: ${app.status}`);
    });
    
    // Check if room should be available
    const shouldBeAvailable = accurateOccupancy.currentOccupancy < accurateOccupancy.capacity;
    console.log(`\n🎯 Room should be available: ${shouldBeAvailable}`);
    
    if (!shouldBeAvailable) {
      console.log('❌ Room is at capacity - this explains the booking error');
    } else {
      console.log('✅ Room should be available for booking');
      
      // Update room occupancy to match accurate calculation
      if (room.currentOccupancy !== accurateOccupancy.currentOccupancy) {
        console.log('\n🔧 Updating room occupancy to match accurate calculation...');
        const updateResult = await RoomStatusManager.decrementRoomOccupancy(
          residence._id,
          'Extension 1',
          'test-script',
          'Correcting occupancy based on accurate calculation'
        );
        
        if (updateResult.success) {
          console.log('✅ Room occupancy updated successfully');
          console.log(`   - Old occupancy: ${updateResult.oldOccupancy}`);
          console.log(`   - New occupancy: ${updateResult.newOccupancy}`);
          console.log(`   - New status: ${updateResult.newStatus}`);
        } else {
          console.log('❌ Failed to update room occupancy:', updateResult.error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing room availability:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the test
testRoomAvailability();


