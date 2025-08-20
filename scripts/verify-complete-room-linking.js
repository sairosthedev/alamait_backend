const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');

async function verifyCompleteRoomLinking() {
  try {
    console.log('🔍 Verifying complete room linking chain...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Show the complete chain: Application -> Residence -> Room -> Debtor
    console.log('📋 Complete Room Linking Chain:\n');
    
    // 1. Get applications with allocated rooms
    const applications = await Application.find({
      allocatedRoom: { $exists: true, $ne: null, $ne: '' }
    }).populate('residence', 'name rooms')
      .populate('debtor', 'debtorCode roomNumber roomPrice roomDetails currentBalance totalOwed');
    
    for (const app of applications) {
      console.log(`🎯 Application: ${app.applicationCode} - ${app.firstName} ${app.lastName}`);
      console.log(`   📍 Residence: ${app.residence?.name || 'Unknown'}`);
      console.log(`   🏠 Allocated Room: ${app.allocatedRoom}`);
      
      // Find the room in the residence
      if (app.residence && app.residence.rooms) {
        const room = app.residence.rooms.find(r => 
          r.roomNumber === app.allocatedRoom ||
          r.roomNumber.toLowerCase() === app.allocatedRoom.toLowerCase()
        );
        
        if (room) {
          console.log(`   📋 Room Details from Residence Collection:`);
          console.log(`     - Room Number: ${room.roomNumber}`);
          console.log(`     - Price: $${room.price}`);
          console.log(`     - Type: ${room.type}`);
          console.log(`     - Capacity: ${room.capacity}`);
          console.log(`     - Floor: ${room.floor}`);
          console.log(`     - Area: ${room.area} sqm`);
          console.log(`     - Features: ${room.features?.join(', ') || 'None'}`);
          console.log(`     - Amenities: ${room.amenities?.join(', ') || 'None'}`);
        } else {
          console.log(`   ❌ Room not found in residence`);
        }
      }
      
      // Show linked debtor information
      if (app.debtor) {
        console.log(`   💰 Linked Debtor: ${app.debtor.debtorCode}`);
        console.log(`     - Room Number: ${app.debtor.roomNumber}`);
        console.log(`     - Room Price: $${app.debtor.roomPrice}`);
        console.log(`     - Current Balance: $${app.debtor.currentBalance}`);
        console.log(`     - Total Owed: $${app.debtor.totalOwed}`);
        
        if (app.debtor.roomDetails) {
          console.log(`     - Room Type: ${app.debtor.roomDetails.roomType}`);
          console.log(`     - Room Capacity: ${app.debtor.roomDetails.roomCapacity}`);
          console.log(`     - Room Floor: ${app.debtor.roomDetails.roomFloor}`);
          console.log(`     - Room Area: ${app.debtor.roomDetails.roomArea} sqm`);
        }
      } else {
        console.log(`   ❌ No debtor linked to this application`);
      }
      
      console.log('');
    }
    
    // 2. Show how to query by application code
    console.log('📋 Query Examples:\n');
    
    console.log('🔍 1. Find debtor by application code:');
    const applicationCode = applications[0]?.applicationCode;
    if (applicationCode) {
      const debtorByAppCode = await Debtor.findOne({ applicationCode })
        .populate('application', 'allocatedRoom firstName lastName')
        .populate('residence', 'name');
      
      if (debtorByAppCode) {
        console.log(`   ✅ Found: ${debtorByAppCode.debtorCode}`);
        console.log(`   Room: ${debtorByAppCode.roomNumber} - $${debtorByAppCode.roomPrice}`);
        console.log(`   Application: ${debtorByAppCode.application?.firstName} ${debtorByAppCode.application?.lastName}`);
        console.log(`   Residence: ${debtorByAppCode.residence?.name}`);
      }
    }
    
    console.log('\n🔍 2. Find all debtors with room prices:');
    const debtorsWithRooms = await Debtor.find({
      roomPrice: { $exists: true, $gt: 0 }
    }).populate('application', 'applicationCode allocatedRoom')
      .populate('residence', 'name');
    
    debtorsWithRooms.forEach(debtor => {
      console.log(`   ${debtor.debtorCode}: ${debtor.roomNumber} - $${debtor.roomPrice} at ${debtor.residence?.name}`);
    });
    
    console.log('\n🔍 3. Calculate total monthly revenue from all rooms:');
    const totalMonthlyRevenue = debtorsWithRooms.reduce((sum, debtor) => sum + (debtor.roomPrice || 0), 0);
    console.log(`   Total Monthly Revenue: $${totalMonthlyRevenue}`);
    
    console.log('\n🔍 4. Show room utilization by residence:');
    const residences = await Residence.find({}).populate('rooms');
    for (const residence of residences) {
      const occupiedRooms = debtorsWithRooms.filter(d => d.residence && d.residence._id.toString() === residence._id.toString());
      const totalRooms = residence.rooms?.length || 0;
      const occupancyRate = totalRooms > 0 ? ((occupiedRooms.length / totalRooms) * 100).toFixed(1) : '0.0';
      
      console.log(`   ${residence.name}:`);
      console.log(`     - Total Rooms: ${totalRooms}`);
      console.log(`     - Occupied Rooms: ${occupiedRooms.length}`);
      console.log(`     - Occupancy Rate: ${occupancyRate}%`);
      
      if (occupiedRooms.length > 0) {
        const residenceRevenue = occupiedRooms.reduce((sum, d) => sum + (d.roomPrice || 0), 0);
        console.log(`     - Monthly Revenue: $${residenceRevenue}`);
      }
    }
    
    console.log('\n✅ Complete room linking verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error verifying room linking:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
verifyCompleteRoomLinking();



