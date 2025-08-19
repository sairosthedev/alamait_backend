const mongoose = require('mongoose');
require('dotenv').config();

async function checkApplicationStatus() {
  try {
    console.log('\n🔍 CHECKING APPLICATION STATUS VALUES');
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
      console.log('❌ No applications found');
      return;
    }
    
    // Check unique status values
    const statuses = [...new Set(applications.map(app => app.status))];
    console.log('📋 Unique application statuses found:');
    statuses.forEach(status => console.log(`   - "${status}"`));
    
    // Check applications for Macdonald Sairos
    console.log('\n🔍 APPLICATIONS FOR MACDONALD SAIROS:');
    console.log('─'.repeat(50));
    
    const user = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' }).lean();
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`User ID: ${user._id}`);
    
    // Check applications by both student ID and email
    const userApplicationsById = applications.filter(app => app.student && app.student.toString() === user._id.toString());
    const userApplicationsByEmail = applications.filter(app => app.email === user.email);
    
    console.log(`\nFound ${userApplicationsById.length} applications by student ID:`);
    userApplicationsById.forEach((app, index) => {
      console.log(`\n📝 Application ${index + 1} (by ID):`);
      console.log(`   ID: ${app._id}`);
      console.log(`   Status: "${app.status}"`);
      console.log(`   Room: ${app.allocatedRoom || app.preferredRoom || 'Not set'}`);
      console.log(`   Residence: ${app.residence}`);
      console.log(`   Start Date: ${app.startDate}`);
      console.log(`   End Date: ${app.endDate}`);
      console.log(`   Payment Status: ${app.paymentStatus}`);
      console.log(`   Application Date: ${app.applicationDate}`);
      console.log(`   Student Field: ${app.student}`);
    });
    
    console.log(`\nFound ${userApplicationsByEmail.length} applications by email:`);
    userApplicationsByEmail.forEach((app, index) => {
      console.log(`\n📝 Application ${index + 1} (by email):`);
      console.log(`   ID: ${app._id}`);
      console.log(`   Status: "${app.status}"`);
      console.log(`   Room: ${app.allocatedRoom || app.preferredRoom || 'Not set'}`);
      console.log(`   Residence: ${app.residence}`);
      console.log(`   Start Date: ${app.startDate}`);
      console.log(`   End Date: ${app.endDate}`);
      console.log(`   Payment Status: ${app.paymentStatus}`);
      console.log(`   Application Date: ${app.applicationDate}`);
      console.log(`   Student Field: ${app.student}`);
      console.log(`   Email: ${app.email}`);
    });
    
    // Check if there are any applications with different status values
    console.log('\n🔍 ALL APPLICATIONS BY STATUS:');
    console.log('─'.repeat(50));
    
    statuses.forEach(status => {
      const appsWithStatus = applications.filter(app => app.status === status);
      console.log(`\nStatus: "${status}" (${appsWithStatus.length} applications)`);
      appsWithStatus.forEach(app => {
        const studentInfo = app.student ? `Student ID: ${app.student}` : `Email: ${app.email}`;
        const roomInfo = app.allocatedRoom || app.preferredRoom || 'No room';
        console.log(`   - ${studentInfo} (Room: ${roomInfo})`);
      });
    });
    
    // Show the raw application data for debugging
    console.log('\n🔍 RAW APPLICATION DATA FOR MACDONALD:');
    console.log('─'.repeat(50));
    
    const macdonaldApp = applications.find(app => 
      app.email === 'macdonald.sairos@students.uz.ac.zw' || 
      (app.student && app.student.toString() === user._id.toString())
    );
    
    if (macdonaldApp) {
      console.log('Raw application data:');
      console.log(JSON.stringify(macdonaldApp, null, 2));
    } else {
      console.log('❌ No application found for Macdonald Sairos');
    }
    
  } catch (error) {
    console.error('❌ Error checking application status:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

checkApplicationStatus();
