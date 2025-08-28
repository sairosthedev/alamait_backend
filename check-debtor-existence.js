const mongoose = require('mongoose');
require('dotenv').config();

async function checkDebtorExistence() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // Cindy's ID
    
    console.log('\n🔍 CHECKING DEBTOR EXISTENCE');
    console.log('=============================');
    
    // 1. Check if debtor exists
    console.log('\n1️⃣ CHECKING DEBTOR RECORD:');
    const debtor = await Debtor.findOne({ user: studentId });
    
    if (debtor) {
      console.log(`✅ Debtor found:`);
      console.log(`   Debtor ID: ${debtor._id}`);
      console.log(`   Debtor Code: ${debtor.debtorCode}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Status: ${debtor.status}`);
      console.log(`   Total Paid: $${debtor.totalPaid || 0}`);
    } else {
      console.log(`❌ No debtor record found for student ${studentId}`);
    }
    
    // 2. Check if user exists
    console.log('\n2️⃣ CHECKING USER RECORD:');
    const user = await User.findById(studentId);
    
    if (user) {
      console.log(`✅ User found:`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Role: ${user.role}`);
    } else {
      console.log(`❌ User not found: ${studentId}`);
    }
    
    // 3. Check if application exists
    console.log('\n3️⃣ CHECKING APPLICATION RECORD:');
    const application = await Application.findOne({ student: studentId });
    
    if (application) {
      console.log(`✅ Application found:`);
      console.log(`   Application ID: ${application._id}`);
      console.log(`   Status: ${application.status}`);
      console.log(`   Start Date: ${application.startDate}`);
      console.log(`   End Date: ${application.endDate}`);
      console.log(`   Residence: ${application.residence}`);
      console.log(`   Allocated Room: ${application.allocatedRoom}`);
    } else {
      console.log(`❌ Application not found for student ${studentId}`);
    }
    
    // 4. Create debtor if missing
    if (!debtor && user && application) {
      console.log('\n4️⃣ CREATING MISSING DEBTOR RECORD:');
      
      try {
        const { createDebtorForStudent } = require('./src/services/debtorService');
        
        const debtorOptions = {
          residenceId: application.residence,
          roomNumber: application.allocatedRoom,
          createdBy: 'system',
          startDate: application.startDate,
          endDate: application.endDate,
          application: application._id,
          applicationCode: application.applicationCode
        };
        
        const newDebtor = await createDebtorForStudent(user, debtorOptions);
        
        if (newDebtor) {
          console.log(`✅ Debtor created successfully:`);
          console.log(`   Debtor ID: ${newDebtor._id}`);
          console.log(`   Debtor Code: ${newDebtor.debtorCode}`);
          console.log(`   User ID: ${newDebtor.user}`);
        } else {
          console.log(`❌ Failed to create debtor`);
        }
        
      } catch (error) {
        console.error(`❌ Error creating debtor:`, error.message);
      }
    } else if (!debtor) {
      console.log('\n4️⃣ CANNOT CREATE DEBTOR:');
      if (!user) console.log('   - User record missing');
      if (!application) console.log('   - Application record missing');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkDebtorExistence();
