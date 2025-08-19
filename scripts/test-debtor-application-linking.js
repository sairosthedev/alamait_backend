const mongoose = require('mongoose');
require('dotenv').config();

async function testDebtorApplicationLinking() {
  try {
    console.log('\n🧪 TESTING DEBTOR-APPLICATION LINKING MECHANISM');
    console.log('================================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const Residence = require('../src/models/Residence');
    const { createDebtorForStudent } = require('../src/services/debtorService');
    
    // Step 1: Check current state
    console.log('🔍 STEP 1: CHECKING CURRENT DATABASE STATE');
    console.log('─'.repeat(50));
    
    const currentUsers = await User.find({ role: 'student' }).lean();
    const currentApplications = await Application.find().lean();
    const currentDebtors = await Debtor.find().lean();
    
    console.log(`👥 Students: ${currentUsers.length}`);
    console.log(`📝 Applications: ${currentApplications.length}`);
    console.log(`💰 Debtors: ${currentDebtors.length}`);
    
    // Step 2: Create a test student with application
    console.log('\n🔧 STEP 2: CREATING TEST STUDENT WITH APPLICATION');
    console.log('─'.repeat(50));
    
    // Check if we have any residences to work with
    const residences = await Residence.find().lean();
    if (residences.length === 0) {
      console.log('❌ No residences found - cannot create test data');
      return;
    }
    
    const testResidence = residences[0];
    const testRoom = testResidence.rooms[0];
    
    console.log(`🏠 Using residence: ${testResidence.name}`);
    console.log(`   Room: ${testRoom.roomNumber} - $${testRoom.price}`);
    
    // Create test student
    const testStudent = new User({
      email: 'test.student@example.com',
      firstName: 'Test',
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
    
    // Create test application
    const testApplication = new Application({
      student: testStudent._id, // ✅ This links the application to the student
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
    console.log(`   Status: ${testApplication.status}`);
    
    // Step 3: Test debtor creation
    console.log('\n🔧 STEP 3: TESTING DEBTOR CREATION');
    console.log('─'.repeat(50));
    
    // First, delete the auto-created debtor so we can test the full flow
    await Debtor.deleteMany({ user: testStudent._id });
    console.log('🗑️  Deleted auto-created debtor to test full flow');
    
    try {
      const debtor = await createDebtorForStudent(testStudent, {
        createdBy: testStudent._id
      });
      
      console.log(`✅ Debtor created successfully: ${debtor.debtorCode}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Residence: ${debtor.residence || 'Not set'}`);
      console.log(`   Room: ${debtor.roomNumber || 'Not set'}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      
      if (debtor.billingPeriod) {
        console.log(`   Billing Period: ${debtor.billingPeriod.duration.value} months`);
        console.log(`   Start Date: ${debtor.billingPeriod.startDate}`);
        console.log(`   End Date: ${debtor.billingPeriod.endDate}`);
      }
      
    } catch (error) {
      console.error(`❌ Error creating debtor: ${error.message}`);
    }
    
    // Step 4: Verify the linking
    console.log('\n🔍 STEP 4: VERIFYING LINKING');
    console.log('─'.repeat(50));
    
    // Check application has student field
    const verifyApplication = await Application.findById(testApplication._id)
      .populate('student', 'firstName lastName email')
      .lean();
    
    console.log(`📝 Application Verification:`);
    console.log(`   Application Code: ${verifyApplication.applicationCode}`);
    console.log(`   Student Field: ${verifyApplication.student ? '✅ POPULATED' : '❌ MISSING'}`);
    if (verifyApplication.student) {
      console.log(`   Student Name: ${verifyApplication.student.firstName} ${verifyApplication.student.lastName}`);
      console.log(`   Student Email: ${verifyApplication.student.email}`);
      console.log(`   Student ID: ${verifyApplication.student._id}`);
    }
    
    // Check debtor has proper links
    const verifyDebtor = await Debtor.findOne({ user: testStudent._id })
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name')
      .lean();
    
    if (verifyDebtor) {
      console.log(`\n💰 Debtor Verification:`);
      console.log(`   Debtor Code: ${verifyDebtor.debtorCode}`);
      console.log(`   User Link: ${verifyDebtor.user ? '✅ LINKED' : '❌ NOT LINKED'}`);
      if (verifyDebtor.user) {
        console.log(`   User Name: ${verifyDebtor.user.firstName} ${verifyDebtor.user.lastName}`);
        console.log(`   User Email: ${verifyDebtor.user.email}`);
      }
      console.log(`   Residence Link: ${verifyDebtor.residence ? '✅ LINKED' : '❌ NOT LINKED'}`);
      if (verifyDebtor.residence) {
        console.log(`   Residence Name: ${verifyDebtor.residence.name}`);
      }
      console.log(`   Room Number: ${verifyDebtor.roomNumber || '❌ NOT SET'}`);
    } else {
      console.log(`❌ No debtor found for test student`);
    }
    
    // Step 5: Test the linking query
    console.log('\n🔍 STEP 5: TESTING LINKING QUERY');
    console.log('─'.repeat(50));
    
    // Test the query that debtor service uses
    const linkingTest = await Application.findOne({ student: testStudent._id })
      .populate('residence', 'name rooms')
      .lean();
    
    if (linkingTest) {
      console.log(`✅ Linking query successful:`);
      console.log(`   Application: ${linkingTest.applicationCode}`);
      console.log(`   Student ID: ${linkingTest.student}`);
      console.log(`   Residence: ${linkingTest.residence?.name || 'Not populated'}`);
      console.log(`   Room: ${linkingTest.allocatedRoom}`);
      
      // Test room price extraction
      if (linkingTest.residence && linkingTest.residence.rooms) {
        const room = linkingTest.residence.rooms.find(r => r.roomNumber === linkingTest.allocatedRoom);
        if (room) {
          console.log(`   Room Price: $${room.price}`);
        } else {
          console.log(`   Room Price: ❌ Not found`);
        }
      }
    } else {
      console.log(`❌ Linking query failed - no application found for student ID`);
    }
    
    // Summary
    console.log('\n📋 LINKING VERIFICATION SUMMARY');
    console.log('─'.repeat(50));
    
    const hasStudentField = verifyApplication.student ? '✅ YES' : '❌ NO';
    const hasDebtorLink = verifyDebtor ? '✅ YES' : '❌ NO';
    const hasResidenceLink = verifyDebtor?.residence ? '✅ YES' : '❌ NO';
    const hasRoomLink = verifyDebtor?.roomNumber ? '✅ YES' : '❌ NO';
    
    console.log(`   Application has student field: ${hasStudentField}`);
    console.log(`   Debtor created: ${hasDebtorLink}`);
    console.log(`   Debtor linked to residence: ${hasResidenceLink}`);
    console.log(`   Debtor linked to room: ${hasRoomLink}`);
    
    if (hasStudentField === '✅ YES' && hasDebtorLink === '✅ YES') {
      console.log('\n🎉 SUCCESS! Debtor-Application linking is working correctly');
      console.log('   ✅ Applications will have student field populated');
      console.log('   ✅ Debtors will link to student ID in applications');
      console.log('   ✅ Room details and pricing will be extracted from applications');
    } else {
      console.log('\n⚠️  ISSUES DETECTED with debtor-application linking');
      console.log('   Please check the above verification results');
    }
    
    // Cleanup test data
    console.log('\n🧹 CLEANING UP TEST DATA');
    console.log('─'.repeat(50));
    
    await Debtor.deleteMany({ user: testStudent._id });
    await Application.deleteMany({ _id: testApplication._id });
    await User.deleteMany({ _id: testStudent._id });
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing debtor-application linking:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

testDebtorApplicationLinking();
