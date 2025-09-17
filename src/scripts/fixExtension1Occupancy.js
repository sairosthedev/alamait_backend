/**
 * Script to fix Extension 1 room occupancy
 * 
 * This script updates Extension 1 room occupancy to match the actual
 * number of approved applications (5 students).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Residence = require('../models/Residence');
const Application = require('../models/Application');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function fixExtension1Occupancy() {
  try {
    console.log('🔧 Fixing Extension 1 room occupancy...');
    
    // Find the St Kilda residence
    const residence = await Residence.findOne({ name: 'St Kilda Student House' });
    if (!residence) {
      console.log('❌ St Kilda Student House not found');
      return;
    }
    
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
    
    // Count approved applications for Extension 1
    const approvedApplications = await Application.find({
      residence: residence._id,
      allocatedRoom: 'Extension 1',
      status: { $in: ['approved', 'active'] }
    });
    
    console.log(`📋 Found ${approvedApplications.length} approved applications for Extension 1`);
    
    const correctOccupancy = approvedApplications.length;
    const oldOccupancy = room.currentOccupancy || 0;
    
    if (oldOccupancy !== correctOccupancy) {
      console.log(`\n🔧 Updating occupancy: ${oldOccupancy} → ${correctOccupancy}`);
      
      // Update room occupancy
      room.currentOccupancy = correctOccupancy;
      
      // Update room status
      if (correctOccupancy === 0) {
        room.status = 'available';
      } else if (correctOccupancy >= (room.capacity || 1)) {
        room.status = 'occupied';
      } else {
        room.status = 'reserved';
      }
      
      // Save the residence
      await residence.save();
      
      console.log(`✅ Room occupancy updated successfully!`);
      console.log(`   - New occupancy: ${room.currentOccupancy}`);
      console.log(`   - New status: ${room.status}`);
      console.log(`   - Available spots: ${(room.capacity || 1) - room.currentOccupancy}`);
      
      // Show the students
      console.log(`\n👥 Students in Extension 1:`);
      approvedApplications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} (${app.email}) - Status: ${app.status}`);
      });
      
    } else {
      console.log(`✅ Room occupancy is already correct: ${correctOccupancy}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing Extension 1 occupancy:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the fix
fixExtension1Occupancy();


