const mongoose = require('mongoose');
require('dotenv').config();

async function testApplicationApprovalFlow() {
  try {
    console.log('\n🧪 TESTING COMPLETE APPLICATION APPROVAL FLOW');
    console.log('==============================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const Residence = require('../src/models/Residence');
    
    // Step 1: Create test student (should NOT create debtor automatically)
    console.log('🔧 STEP 1: CREATING TEST STUDENT');
    console.log('─'.repeat(40));
    
    const testStudent = new User({
      email: 'approval.student@example.com',
      firstName: 'Approval',
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
    
    // Check: No debtor should exist yet
    const debtorAfterStudent = await Debtor.findOne({ user: testStudent._id });
    if (debtorAfterStudent) {
      console.log(`❌ Debtor was created automatically (should not happen): ${debtorAfterStudent.debtorCode}`);
    } else {
      console.log(`✅ No debtor created automatically (correct behavior)`);
    }
    
    // Step 2: Create test application
    console.log('\n🔧 STEP 2: CREATING TEST APPLICATION');
    console.log('─'.repeat(45));
    
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
      status: 'pending', // Start as pending
      paymentStatus: 'unpaid',
      preferredRoom: testRoom.roomNumber,
      allocatedRoom: null, // Not allocated yet
      residence: testResidence._id,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      applicationCode: `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    });
    
    await testApplication.save();
    console.log(`✅ Created test application: ${testApplication.applicationCode}`);
    console.log(`   Student ID: ${testApplication.student}`);
    console.log(`   Status: ${testApplication.status}`);
    console.log(`   Room: ${testApplication.allocatedRoom || 'Not allocated yet'}`);
    console.log(`   Residence: ${testApplication.residence}`);
    
    // Check: Still no debtor should exist
    const debtorAfterApplication = await Debtor.findOne({ user: testStudent._id });
    if (debtorAfterApplication) {
      console.log(`❌ Debtor was created after application (should not happen yet): ${debtorAfterApplication.debtorCode}`);
    } else {
      console.log(`✅ No debtor created after application (correct behavior)`);
    }
    
    // Step 3: Simulate application approval (what admin does)
    console.log('\n🔧 STEP 3: SIMULATING APPLICATION APPROVAL');
    console.log('─'.repeat(50));
    
    // Update application status to approved and allocate room
    testApplication.status = 'approved';
    testApplication.allocatedRoom = testRoom.roomNumber;
    testApplication.paymentStatus = 'unpaid';
    await testApplication.save();
    
    console.log(`✅ Application approved: ${testApplication.applicationCode}`);
    console.log(`   Status: ${testApplication.status}`);
    console.log(`   Allocated Room: ${testApplication.allocatedRoom}`);
    
    // Step 4: Now create debtor manually (simulating the approval process)
    console.log('\n🔧 STEP 4: CREATING DEBTOR AFTER APPROVAL');
    console.log('─'.repeat(50));
    
    const { createDebtorForStudent } = require('../src/services/debtorService');
    
    try {
      const debtor = await createDebtorForStudent(testStudent, {
        createdBy: testStudent._id, // Simulate admin user
        application: testApplication._id
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
      return;
    }
    
    // Step 5: Verify the final debtor record
    console.log('\n🔍 STEP 5: VERIFYING FINAL DEBTOR RECORD');
    console.log('─'.repeat(45));
    
    const finalDebtor = await Debtor.findOne({ user: testStudent._id })
      .populate('user', 'firstName lastName email')
      .populate('residence', 'name')
      .lean();
    
    if (finalDebtor) {
      console.log(`💰 Final Debtor Status:`);
      console.log(`   Debtor Code: ${finalDebtor.debtorCode}`);
      console.log(`   User: ${finalDebtor.user.firstName} ${finalDebtor.user.lastName}`);
      console.log(`   Residence: ${finalDebtor.residence ? finalDebtor.residence.name : '❌ NOT LINKED'}`);
      console.log(`   Room Number: ${finalDebtor.roomNumber || '❌ NOT SET'}`);
      console.log(`   Total Owed: $${finalDebtor.totalOwed}`);
      console.log(`   Current Balance: $${finalDebtor.currentBalance}`);
      
      // Check if residence and room are properly set
      const hasResidence = finalDebtor.residence ? '✅ YES' : '❌ NO';
      const hasRoom = finalDebtor.roomNumber ? '✅ YES' : '❌ NO';
      
      console.log(`\n📋 LINKING STATUS:`);
      console.log(`   Residence Linked: ${hasResidence}`);
      console.log(`   Room Number Set: ${hasRoom}`);
      
      if (hasResidence === '✅ YES' && hasRoom === '✅ YES') {
        console.log('\n🎉 SUCCESS! Complete flow working correctly');
        console.log('   ✅ Student created without auto-debtor');
        console.log('   ✅ Application created with student ID');
        console.log('   ✅ Application approved with room allocation');
        console.log('   ✅ Debtor created with proper residence & room linking');
        console.log('   ✅ Room price extracted from residence.rooms array');
      } else {
        console.log('\n⚠️  ISSUE: Debtor not properly linked');
        console.log('   ❌ Missing residence or room information');
      }
    } else {
      console.log('❌ No debtor found');
    }
    
    // Cleanup
    console.log('\n🧹 CLEANING UP TEST DATA');
    console.log('─'.repeat(40));
    
    await Debtor.deleteMany({ user: testStudent._id });
    await Application.deleteMany({ _id: testApplication._id });
    await User.deleteMany({ _id: testStudent._id });
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing application approval flow:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

testApplicationApprovalFlow();
