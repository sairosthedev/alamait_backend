const mongoose = require('mongoose');
require('dotenv').config();

async function checkCurrentData() {
  try {
    console.log('\n🔍 CHECKING CURRENT DATABASE DATA');
    console.log('==================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const Residence = require('../src/models/Residence');
    
    // Check Users
    console.log('👥 USERS IN DATABASE:');
    console.log('─'.repeat(40));
    const users = await User.find().lean();
    console.log(`Total users: ${users.length}`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Current Room: ${user.currentRoom || 'Not set'}`);
        console.log(`   Residence: ${user.residence || 'Not set'}`);
      });
    }
    
    // Check Applications
    console.log('\n📝 APPLICATIONS IN DATABASE:');
    console.log('─'.repeat(40));
    const applications = await Application.find().lean();
    console.log(`Total applications: ${applications.length}`);
    
    if (applications.length > 0) {
      applications.forEach((app, index) => {
        console.log(`\n${index + 1}. ${app.firstName} ${app.lastName}`);
        console.log(`   Email: ${app.email}`);
        console.log(`   Application Code: ${app.applicationCode}`);
        console.log(`   Status: ${app.status}`);
        console.log(`   Room: ${app.allocatedRoom || app.preferredRoom || 'Not set'}`);
        console.log(`   Residence: ${app.residence}`);
        console.log(`   Student Field: ${app.student || 'MISSING'}`);
        console.log(`   Start Date: ${app.startDate}`);
        console.log(`   End Date: ${app.endDate}`);
      });
    }
    
    // Check Debtors
    console.log('\n💰 DEBTORS IN DATABASE:');
    console.log('─'.repeat(40));
    const debtors = await Debtor.find().lean();
    console.log(`Total debtors: ${debtors.length}`);
    
    if (debtors.length > 0) {
      debtors.forEach((debtor, index) => {
        console.log(`\n${index + 1}. ${debtor.debtorCode}`);
        console.log(`   User ID: ${debtor.user}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Room Number: ${debtor.roomNumber || 'Not set'}`);
        console.log(`   Residence: ${debtor.residence || 'Not set'}`);
      });
    }
    
    // Check Residences
    console.log('\n🏠 RESIDENCES IN DATABASE:');
    console.log('─'.repeat(40));
    const residences = await Residence.find().lean();
    console.log(`Total residences: ${residences.length}`);
    
    if (residences.length > 0) {
      residences.forEach((residence, index) => {
        console.log(`\n${index + 1}. ${residence.name}`);
        console.log(`   ID: ${residence._id}`);
        console.log(`   Total Rooms: ${residence.rooms.length}`);
        console.log(`   Available Rooms: ${residence.rooms.filter(r => r.status === 'available').length}`);
        console.log(`   Occupied Rooms: ${residence.rooms.filter(r => r.status === 'occupied').length}`);
        
        // Show room details
        if (residence.rooms.length > 0) {
          console.log(`   Room Details:`);
          residence.rooms.forEach(room => {
            console.log(`     - ${room.roomNumber}: $${room.price} (${room.status})`);
          });
        }
      });
    }
    
    // Try to find matching data
    console.log('\n🔍 ATTEMPTING TO MATCH DATA:');
    console.log('─'.repeat(40));
    
    if (applications.length > 0 && users.length > 0) {
      console.log('\n📋 POTENTIAL MATCHES:');
      
      applications.forEach(app => {
        // Try to find user by email
        const matchingUser = users.find(user => user.email === app.email);
        if (matchingUser) {
          console.log(`✅ MATCH: Application ${app.applicationCode} ↔ User ${matchingUser.firstName} ${matchingUser.lastName}`);
          console.log(`   Application Email: ${app.email}`);
          console.log(`   User Email: ${matchingUser.email}`);
          console.log(`   User ID: ${matchingUser._id}`);
          console.log(`   Application Student Field: ${app.student || 'MISSING'}`);
        } else {
          console.log(`❌ NO MATCH: Application ${app.applicationCode} (${app.email}) - No user found`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking current data:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

checkCurrentData();
