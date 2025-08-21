const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');
const Debtor = require('../src/models/Debtor');

async function linkAllocatedRoomDetails() {
  try {
    console.log('🔗 Linking applications with allocated room details...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get all applications with allocated rooms
    const applications = await Application.find({ 
      allocatedRoom: { $exists: true, $ne: null, $ne: '' }
    }).populate('residence', 'name rooms');
    
    console.log(`📋 Found ${applications.length} applications with allocated rooms\n`);
    
    let updatedCount = 0;
    
    for (const application of applications) {
      console.log(`\n🔍 Processing application: ${application.applicationCode || 'No code'} - ${application.firstName} ${application.lastName}`);
      console.log(`   Residence: ${application.residence?.name || 'Unknown'}`);
      console.log(`   Allocated Room: ${application.allocatedRoom}`);
      
      if (!application.residence || !application.residence.rooms) {
        console.log('   ❌ No residence or rooms data, skipping...');
        continue;
      }
      
      // Find the allocated room in the residence
      const allocatedRoom = application.residence.rooms.find(room => 
        room.roomNumber === application.allocatedRoom || 
        room.roomNumber.toLowerCase() === application.allocatedRoom.toLowerCase()
      );
      
      if (!allocatedRoom) {
        console.log(`   ❌ Allocated room '${application.allocatedRoom}' not found in residence`);
        continue;
      }
      
      // Update with allocated room details
      const allocatedRoomDetails = {
        roomNumber: allocatedRoom.roomNumber,
        roomId: allocatedRoom._id,
        price: allocatedRoom.price,
        type: allocatedRoom.type,
        capacity: allocatedRoom.capacity
      };
      
      try {
        await Application.findByIdAndUpdate(application._id, {
          $set: { allocatedRoomDetails }
        }, { new: true, runValidators: false });
        
        console.log(`   ✅ Linked allocated room: ${allocatedRoom.roomNumber} - $${allocatedRoom.price} (${allocatedRoom.type})`);
        updatedCount++;
        
      } catch (updateError) {
        console.error(`   ❌ Error updating application:`, updateError.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Applications with allocated rooms: ${applications.length}`);
    console.log(`   Applications updated: ${updatedCount}`);
    
    // Show final status
    console.log(`\n📋 Final application status with allocated room details:`);
    const finalApplications = await Application.find({
      allocatedRoomDetails: { $exists: true }
    }).populate('residence', 'name').populate('debtor', 'debtorCode currentBalance totalOwed');
    
    for (const app of finalApplications) {
      console.log(`\n   ${app.applicationCode || 'No code'}: ${app.firstName} ${app.lastName}`);
      console.log(`     Residence: ${app.residence?.name || 'Unknown'}`);
      
      if (app.allocatedRoomDetails) {
        console.log(`     Allocated Room: ${app.allocatedRoomDetails.roomNumber} - $${app.allocatedRoomDetails.price} (${app.allocatedRoomDetails.type})`);
        console.log(`     Room Capacity: ${app.allocatedRoomDetails.capacity}`);
      }
      
      if (app.debtor) {
        console.log(`     Debtor: ${app.debtor.debtorCode} (Balance: $${app.debtor.currentBalance})`);
      }
    }
    
    console.log('\n✅ Allocated room details linking completed successfully!');
    
  } catch (error) {
    console.error('❌ Error linking allocated room details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
linkAllocatedRoomDetails();




