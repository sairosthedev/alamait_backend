const mongoose = require('mongoose');
require('dotenv').config();

async function testCorrectFlow() {
  try {
    console.log('\n🧪 TESTING CORRECT FLOW: APPLICATION FIRST, THEN DEBTOR');
    console.log('========================================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const Residence = require('../src/models/Residence');
    const { createDebtorForStudent } = require('../src/services/debtorService');
    
    // Step 1: Create test student
    console.log('🔧 STEP 1: CREATING TEST STUDENT');
    console.log('─'.repeat(40));
    
    const testStudent = new User({
      email: 'flow.student@example.com',
      firstName: 'Flow',
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
    
    // Step 2: Create test application FIRST
    console.log('\n🔧 STEP 2: CREATING TEST APPLICATION FIRST');
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
    
    // Step 3: Delete any auto-created debtor and create new one
    console.log('\n🔧 STEP 3: CREATING DEBTOR WITH APPLICATION DATA');
    console.log('─'.repeat(50));
    
    // Delete auto-created debtor
    await Debtor.deleteMany({ user: testStudent._id });
    console.log('🗑️  Deleted auto-created debtor');
    
    // Now create debtor - it should find the application
    try {
      const debtor = await createDebtorForStudent(testStudent, {
        createdBy: testStudent._id
      });
      
      console.log(`\n✅ Debtor created successfully: ${debtor.debtorCode}`);
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
    
    // Step 4: Verify the final debtor record
    console.log('\n🔍 STEP 4: VERIFYING FINAL DEBTOR RECORD');
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
        console.log('\n🎉 SUCCESS! Debtor properly linked to application data');
        console.log('   ✅ Residence ID extracted from application');
        console.log('   ✅ Room number extracted from application');
        console.log('   ✅ Room price extracted from residence.rooms array');
      } else {
        console.log('\n⚠️  ISSUE: Debtor not properly linked to application data');
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
    console.error('❌ Error testing correct flow:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

testCorrectFlow();
