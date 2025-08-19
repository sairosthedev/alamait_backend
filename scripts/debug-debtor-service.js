const mongoose = require('mongoose');
require('dotenv').config();

async function debugDebtorService() {
  try {
    console.log('\n🔍 DEBUGGING DEBTOR SERVICE LOGIC');
    console.log('===================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Residence = require('../src/models/Residence');
    
    // Step 1: Create test student
    console.log('🔧 STEP 1: CREATING TEST STUDENT');
    console.log('─'.repeat(40));
    
    const testStudent = new User({
      email: 'debug.student@example.com',
      firstName: 'Debug',
      lastName: 'Student',
      phone: '+263 78 123 4567',
      password: 'testpassword123',
      role: 'student',
      isVerified: true
    });
    
    await testStudent.save();
    console.log(`✅ Created test student: ${testStudent.firstName} ${testStudent.lastName}`);
    console.log(`   Email: ${testStudent.email}`);
    console.log(`   ID: ${testStudent._id}`);
    
    // Step 2: Create test application
    console.log('\n🔧 STEP 2: CREATING TEST APPLICATION');
    console.log('─'.repeat(40));
    
    const residences = await Residence.find().lean();
    const testResidence = residences[0];
    const testRoom = testResidence.rooms[0];
    
    console.log(`🏠 Using residence: ${testResidence.name}`);
    console.log(`   Room: ${testRoom.roomNumber} - $${testRoom.price}`);
    
    const testApplication = new Application({
      student: testStudent._id,
      email: testStudent.email,
      firstName: testStudent.firstName,
      lastName: testStudent.lastName,
      phone: testStudent.phone,
      requestType: 'new',
      status: 'approved',
      paymentStatus: 'unpaid',
      preferredRoom: testRoom.roomNumber,
      allocatedRoom: testRoom.roomNumber,
      residence: testResidence._id,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      applicationCode: `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    });
    
    await testApplication.save();
    console.log(`✅ Created test application: ${testApplication.applicationCode}`);
    console.log(`   Student ID: ${testApplication.student}`);
    console.log(`   Room: ${testApplication.allocatedRoom}`);
    console.log(`   Residence: ${testApplication.residence}`);
    
    // Step 3: Test the exact query that debtor service uses
    console.log('\n🔍 STEP 3: TESTING DEBTOR SERVICE QUERY LOGIC');
    console.log('─'.repeat(50));
    
    console.log('🔍 Query: Application.findOne({ student: user._id })');
    const application = await Application.findOne({ student: testStudent._id })
      .populate('residence', 'name rooms');
    
    if (application) {
      console.log(`✅ Application found: ${application.applicationCode}`);
      console.log(`   Student ID: ${application.student}`);
      console.log(`   Residence: ${application.residence ? '✅ POPULATED' : '❌ NOT POPULATED'}`);
      
      if (application.residence) {
        console.log(`   Residence Name: ${application.residence.name}`);
        console.log(`   Residence ID: ${application.residence._id}`);
        console.log(`   Rooms Count: ${application.residence.rooms.length}`);
        
        // Test room finding logic
        const roomNumber = application.allocatedRoom;
        console.log(`   Looking for room: ${roomNumber}`);
        
        const room = application.residence.rooms.find(r => 
          r.roomNumber === roomNumber || r.name === roomNumber
        );
        
        if (room) {
          console.log(`   ✅ Room found: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ❌ Room not found in residence.rooms array`);
          console.log(`   Available rooms:`);
          application.residence.rooms.forEach(r => {
            console.log(`     - ${r.roomNumber}: $${r.price}`);
          });
        }
      } else {
        console.log(`   ❌ Residence not populated`);
      }
    } else {
      console.log(`❌ No application found for student ID: ${testStudent._id}`);
    }
    
    // Step 4: Test direct residence query
    console.log('\n🔍 STEP 4: TESTING DIRECT RESIDENCE QUERY');
    console.log('─'.repeat(40));
    
    if (application && application.residence) {
      const residence = await Residence.findById(application.residence._id).lean();
      if (residence) {
        console.log(`✅ Direct residence query successful: ${residence.name}`);
        console.log(`   Rooms: ${residence.rooms.length}`);
        
        const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
        if (room) {
          console.log(`   ✅ Room found: ${room.roomNumber} - $${room.price}`);
        } else {
          console.log(`   ❌ Room not found: ${application.allocatedRoom}`);
        }
      }
    }
    
    // Cleanup
    console.log('\n🧹 CLEANING UP TEST DATA');
    console.log('─'.repeat(40));
    
    await Application.deleteMany({ _id: testApplication._id });
    await User.deleteMany({ _id: testStudent._id });
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error debugging debtor service:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

debugDebtorService();
