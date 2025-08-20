const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');
const Debtor = require('../src/models/Debtor');

async function linkApplicationsWithRoomDetails() {
  try {
    console.log('🔗 Linking applications with residence room details...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get all applications
    const applications = await Application.find({}).populate('residence', 'name');
    console.log(`📋 Found ${applications.length} applications\n`);
    
    // Get all residences with their rooms
    const residences = await Residence.find({});
    console.log(`📋 Found ${residences.length} residences\n`);
    
    let updatedCount = 0;
    
    for (const application of applications) {
      console.log(`\n🔍 Processing application: ${application.applicationCode || 'No code'} - ${application.firstName} ${application.lastName}`);
      console.log(`   Residence: ${application.residence?.name || 'Unknown'}`);
      
      if (!application.residence) {
        console.log('   ❌ No residence linked, skipping...');
        continue;
      }
      
      // Find the residence
      const residence = residences.find(r => r._id.toString() === application.residence._id.toString());
      if (!residence) {
        console.log('   ❌ Residence not found, skipping...');
        continue;
      }
      
      // Find rooms by room number/name
      const findRoomByNumber = (roomNumber) => {
        if (!roomNumber) return null;
        return residence.rooms.find(room => 
          room.roomNumber === roomNumber || 
          room.roomNumber.toLowerCase() === roomNumber.toLowerCase()
        );
      };
      
      // Update room details
      const updateData = {
        roomDetails: {}
      };
      
      // Process preferred room
      if (application.preferredRoom) {
        const room = findRoomByNumber(application.preferredRoom);
        if (room) {
          updateData.roomDetails.preferredRoom = {
            roomNumber: room.roomNumber,
            roomId: room._id,
            price: room.price,
            type: room.type,
            capacity: room.capacity
          };
          console.log(`   ✅ Linked preferred room: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ⚠️  Preferred room not found: ${application.preferredRoom}`);
        }
      }
      
      // Process allocated room
      if (application.allocatedRoom) {
        const room = findRoomByNumber(application.allocatedRoom);
        if (room) {
          updateData.roomDetails.allocatedRoom = {
            roomNumber: room.roomNumber,
            roomId: room._id,
            price: room.price,
            type: room.type,
            capacity: room.capacity
          };
          console.log(`   ✅ Linked allocated room: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ⚠️  Allocated room not found: ${application.allocatedRoom}`);
        }
      }
      
      // Process current room (for upgrades)
      if (application.currentRoom) {
        const room = findRoomByNumber(application.currentRoom);
        if (room) {
          updateData.roomDetails.currentRoom = {
            roomNumber: room.roomNumber,
            roomId: room._id,
            price: room.price,
            type: room.type,
            capacity: room.capacity
          };
          console.log(`   ✅ Linked current room: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ⚠️  Current room not found: ${application.currentRoom}`);
        }
      }
      
      // Process requested room (for upgrades)
      if (application.requestedRoom) {
        const room = findRoomByNumber(application.requestedRoom);
        if (room) {
          updateData.roomDetails.requestedRoom = {
            roomNumber: room.roomNumber,
            roomId: room._id,
            price: room.price,
            type: room.type,
            capacity: room.capacity
          };
          console.log(`   ✅ Linked requested room: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ⚠️  Requested room not found: ${application.requestedRoom}`);
        }
      }
      
      // Update the application if we have room details
      if (Object.keys(updateData.roomDetails).length > 0) {
        try {
          // Only add the roomDetails field, don't touch anything else
          await Application.findByIdAndUpdate(application._id, {
            $set: { roomDetails: updateData.roomDetails }
          }, { new: true, runValidators: false });
          updatedCount++;
          console.log(`   ✅ Updated application with room details`);
        } catch (updateError) {
          console.error(`   ❌ Error updating application:`, updateError.message);
        }
      } else {
        console.log(`   ⚠️  No room details to update`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total applications processed: ${applications.length}`);
    console.log(`   Applications updated: ${updatedCount}`);
    
    // Show final status with room details
    console.log(`\n📋 Final application status with room details:`);
    const finalApplications = await Application.find({})
      .populate('residence', 'name')
      .populate('debtor', 'debtorCode currentBalance totalOwed');
    
    for (const app of finalApplications) {
      console.log(`\n   ${app.applicationCode || 'No code'}: ${app.firstName} ${app.lastName}`);
      console.log(`     Residence: ${app.residence?.name || 'Unknown'}`);
      
      if (app.roomDetails) {
        if (app.roomDetails.allocatedRoom) {
          console.log(`     Allocated Room: ${app.roomDetails.allocatedRoom.roomNumber} - $${app.roomDetails.allocatedRoom.price} (${app.roomDetails.allocatedRoom.type})`);
        }
        if (app.roomDetails.preferredRoom) {
          console.log(`     Preferred Room: ${app.roomDetails.preferredRoom.roomNumber} - $${app.roomDetails.preferredRoom.price} (${app.roomDetails.preferredRoom.type})`);
        }
        if (app.roomDetails.currentRoom) {
          console.log(`     Current Room: ${app.roomDetails.currentRoom.roomNumber} - $${app.roomDetails.currentRoom.price} (${app.roomDetails.currentRoom.type})`);
        }
        if (app.roomDetails.requestedRoom) {
          console.log(`     Requested Room: ${app.roomDetails.requestedRoom.roomNumber} - $${app.roomDetails.requestedRoom.price} (${app.roomDetails.requestedRoom.type})`);
        }
      }
      
      if (app.debtor) {
        console.log(`     Debtor: ${app.debtor.debtorCode} (Balance: $${app.debtor.currentBalance})`);
      }
    }
    
    console.log('\n✅ Room details linking completed successfully!');
    
  } catch (error) {
    console.error('❌ Error linking applications with room details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
linkApplicationsWithRoomDetails();
