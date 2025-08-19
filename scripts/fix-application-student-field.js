const mongoose = require('mongoose');
require('dotenv').config();

async function fixApplicationStudentField() {
  try {
    console.log('\n🔧 FIXING APPLICATION STUDENT FIELD');
    console.log('=====================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    
    // Find the user (student)
    const user = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' }).lean();
    if (!user) {
      console.log('❌ User not found for Macdonald Sairos');
      return;
    }
    
    console.log(`👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   User ID: ${user._id}`);
    
    // Find the application by email
    const application = await Application.findOne({ 
      email: 'macdonald.sairos@students.uz.ac.zw' 
    }).lean();
    
    if (!application) {
      console.log('❌ Application not found for Macdonald Sairos');
      return;
    }
    
    console.log(`📝 Found application: ${application.applicationCode}`);
    console.log(`   Status: ${application.status}`);
    console.log(`   Room: ${application.allocatedRoom}`);
    console.log(`   Residence: ${application.residence}`);
    console.log(`   Student field: ${application.student || 'MISSING'}`);
    
    // Update the application to include the student field
    if (!application.student) {
      console.log('\n🔧 Adding missing student field to application...');
      
      await Application.findByIdAndUpdate(application._id, {
        student: user._id
      });
      
      console.log('✅ Application updated with student field');
      
      // Refresh the application data
      const updatedApp = await Application.findById(application._id).lean();
      console.log(`   Updated student field: ${updatedApp.student}`);
    } else {
      console.log('✅ Application already has student field');
    }
    
    // Verify the fix
    console.log('\n🔍 VERIFYING FIX:');
    console.log('─'.repeat(40));
    
    const finalApp = await Application.findById(application._id)
      .populate('student', 'firstName lastName email')
      .lean();
    
    console.log('\n📝 FINAL APPLICATION STATUS:');
    console.log(`   Application Code: ${finalApp.applicationCode}`);
    console.log(`   Student: ${finalApp.student ? `${finalApp.student.firstName} ${finalApp.student.lastName}` : 'Not linked'}`);
    console.log(`   Student ID: ${finalApp.student?._id || 'Not linked'}`);
    console.log(`   Status: ${finalApp.status}`);
    console.log(`   Room: ${finalApp.allocatedRoom}`);
    console.log(`   Residence: ${finalApp.residence}`);
    
    if (finalApp.student) {
      console.log('\n🎉 SUCCESS! Application now properly linked to student');
      console.log('   This will enable proper syncing with the debtors collection');
    } else {
      console.log('\n❌ FAILED! Application still not linked to student');
    }
    
  } catch (error) {
    console.error('❌ Error fixing application student field:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

fixApplicationStudentField();
