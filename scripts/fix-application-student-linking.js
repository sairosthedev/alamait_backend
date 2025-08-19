const mongoose = require('mongoose');
require('dotenv').config();

async function fixApplicationStudentLinking() {
  try {
    console.log('\n🔧 FIXING APPLICATION STUDENT LINKING');
    console.log('=====================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Application = require('../src/models/Application');
    const User = require('../src/models/User');
    
    // Get all applications
    const applications = await Application.find().lean();
    console.log(`📊 Total applications: ${applications.length}\n`);
    
    if (applications.length === 0) {
      console.log('❌ No applications found to fix');
      return;
    }
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const application of applications) {
      try {
        console.log(`\n🔧 Fixing application: ${application.applicationCode}`);
        console.log('─'.repeat(50));
        
        // Check if student field is already populated
        if (application.student) {
          console.log(`   ✅ Application already has student field: ${application.student}`);
          continue;
        }
        
        // Find user by email
        const user = await User.findOne({ email: application.email }).lean();
        if (!user) {
          console.log(`   ❌ No user found with email: ${application.email}`);
          errorCount++;
          continue;
        }
        
        console.log(`   👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`);
        console.log(`   🆔 User ID: ${user._id}`);
        
        // Update the application with the student field
        await Application.findByIdAndUpdate(application._id, {
          student: user._id
        });
        
        console.log(`   ✅ Application updated with student field`);
        fixedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error fixing application ${application.applicationCode}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📋 FIXING SUMMARY:');
    console.log('─'.repeat(40));
    console.log(`   Total applications processed: ${applications.length}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    if (fixedCount > 0) {
      console.log('\n🎉 APPLICATION STUDENT LINKING FIXED!');
      console.log('─'.repeat(40));
      console.log('✅ All applications now have:');
      console.log('   - Proper student field linking to User model');
      console.log('   - Correct references for debtor creation');
    }
    
    // Verify the fixes
    console.log('\n🔍 VERIFYING FIXES:');
    console.log('─'.repeat(40));
    
    const updatedApplications = await Application.find()
      .populate('student', 'firstName lastName email')
      .lean();
    
    updatedApplications.forEach(app => {
      console.log(`\n📝 ${app.applicationCode}:`);
      if (app.student) {
        console.log(`   Student: ${app.student.firstName} ${app.student.lastName} (${app.student.email})`);
        console.log(`   Student ID: ${app.student._id}`);
      } else {
        console.log(`   ❌ No student linked`);
      }
      console.log(`   Status: ${app.status}`);
      console.log(`   Room: ${app.allocatedRoom || app.preferredRoom || 'Not set'}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing application student linking:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

fixApplicationStudentLinking();
