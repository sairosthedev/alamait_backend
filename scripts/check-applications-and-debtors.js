const mongoose = require('mongoose');
require('dotenv').config();

async function checkApplicationsAndDebtors() {
  try {
    console.log('\n🔍 CHECKING APPLICATIONS VS DEBTOR LINKING');
    console.log('==========================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const User = require('../src/models/User');
    const Residence = require('../src/models/Residence');
    
    // Check applications
    console.log('📝 APPLICATIONS COLLECTION:');
    console.log('─'.repeat(50));
    
    const applications = await Application.find()
      .populate('student', 'firstName lastName email')
      .populate('residence', 'name')
      .lean();
    
    console.log(`Total applications: ${applications.length}\n`);
    
    if (applications.length > 0) {
      applications.forEach(app => {
        console.log(`📋 Application: ${app._id}`);
        console.log(`   Student: ${app.student?.firstName} ${app.student?.lastName} (${app.student?.email})`);
        console.log(`   Residence: ${app.residence?.name || 'Not set'}`);
        console.log(`   Room Number: ${app.roomNumber || 'Not set'}`);
        console.log(`   Start Date: ${app.startDate || 'Not set'}`);
        console.log(`   End Date: ${app.endDate || 'Not set'}`);
        console.log(`   Status: ${app.status || 'Not set'}`);
        console.log(`   Room Price: $${app.roomPrice || 'Not set'}`);
        console.log('');
      });
    }
    
    // Check debtors
    console.log('💰 DEBTOR ACCOUNTS:');
    console.log('─'.repeat(50));
    
    const debtors = await Debtor.find()
      .populate('user', 'firstName lastName email currentRoom residence')
      .populate('residence', 'name')
      .lean();
    
    console.log(`Total debtors: ${debtors.length}\n`);
    
    if (debtors.length > 0) {
      debtors.forEach(debtor => {
        console.log(`💳 Debtor: ${debtor.debtorCode}`);
        console.log(`   Student: ${debtor.user?.firstName} ${debtor.user?.lastName} (${debtor.user?.email})`);
        console.log(`   Room Number: ${debtor.roomNumber || 'Not set'}`);
        console.log(`   Residence: ${debtor.residence?.name || 'Not set'}`);
        console.log(`   Start Date: ${debtor.billingPeriod?.startDate || 'Not set'}`);
        console.log(`   End Date: ${debtor.billingPeriod?.endDate || 'Not set'}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log('');
      });
    }
    
    // Check students
    console.log('👥 STUDENTS COLLECTION:');
    console.log('─'.repeat(50));
    
    const students = await User.find({ role: 'student' })
      .populate('residence', 'name')
      .lean();
    
    console.log(`Total students: ${students.length}\n`);
    
    if (students.length > 0) {
      students.forEach(student => {
        console.log(`👤 Student: ${student.firstName} ${student.lastName} (${student.email})`);
        console.log(`   Current Room: ${student.currentRoom || 'Not set'}`);
        console.log(`   Residence: ${student.residence?.name || 'Not set'}`);
        console.log(`   Room Valid Until: ${student.roomValidUntil || 'Not set'}`);
        console.log(`   Room Approval Date: ${student.roomApprovalDate || 'Not set'}`);
        console.log('');
      });
    }
    
    // Analyze linking issues
    console.log('🔗 LINKING ANALYSIS:');
    console.log('─'.repeat(50));
    
    const linkingIssues = [];
    
    // Check each student
    for (const student of students) {
      console.log(`\n🔍 Analyzing: ${student.firstName} ${student.lastName}`);
      
      // Find application for this student
      const application = applications.find(app => app.student._id.toString() === student._id.toString());
      if (application) {
        console.log(`   ✅ Application found:`);
        console.log(`      Room: ${application.roomNumber}`);
        console.log(`      Residence: ${application.residence?.name}`);
        console.log(`      Start: ${application.startDate}`);
        console.log(`      End: ${application.endDate}`);
        console.log(`      Price: $${application.roomPrice}`);
      } else {
        console.log(`   ❌ No application found`);
        linkingIssues.push(`${student.firstName} ${student.lastName}: Missing application`);
      }
      
      // Find debtor for this student
      const debtor = debtors.find(d => d.user._id.toString() === student._id.toString());
      if (debtor) {
        console.log(`   ✅ Debtor found: ${debtor.debtorCode}`);
        
        // Check if debtor has correct room info
        if (debtor.roomNumber !== application?.roomNumber) {
          console.log(`   ⚠️  Room mismatch: Debtor has ${debtor.roomNumber}, Application has ${application?.roomNumber}`);
          linkingIssues.push(`${student.firstName} ${student.lastName}: Room number mismatch between debtor and application`);
        }
        
        // Check if debtor has correct residence
        if (debtor.residence?._id.toString() !== application?.residence?._id.toString()) {
          console.log(`   ⚠️  Residence mismatch: Debtor has ${debtor.residence?.name}, Application has ${application?.residence?.name}`);
          linkingIssues.push(`${student.firstName} ${student.lastName}: Residence mismatch between debtor and application`);
        }
        
        // Check if debtor has correct dates
        if (!debtor.billingPeriod?.startDate || !debtor.billingPeriod?.endDate) {
          console.log(`   ⚠️  Missing dates: Debtor missing start/end dates`);
          linkingIssues.push(`${student.firstName} ${student.lastName}: Debtor missing billing period dates`);
        }
        
        // Check if totalOwed is calculated correctly
        if (debtor.totalOwed === 0 || debtor.totalOwed !== application?.roomPrice) {
          console.log(`   ⚠️  Price mismatch: Debtor totalOwed $${debtor.totalOwed}, Application price $${application?.roomPrice}`);
          linkingIssues.push(`${student.firstName} ${student.lastName}: Price mismatch between debtor and application`);
        }
        
      } else {
        console.log(`   ❌ No debtor found`);
        linkingIssues.push(`${student.firstName} ${student.lastName}: Missing debtor account`);
      }
    }
    
    // Summary
    console.log('\n📋 SUMMARY OF LINKING ISSUES:');
    console.log('─'.repeat(50));
    
    if (linkingIssues.length === 0) {
      console.log('✅ All students are properly linked with applications and debtors');
    } else {
      console.log(`Found ${linkingIssues.length} linking issues:`);
      linkingIssues.forEach(issue => console.log(`   ❌ ${issue}`));
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(30));
    console.log('1. Debtor accounts should be created from application data');
    console.log('2. Room number should match application.roomNumber');
    console.log('3. Residence should match application.residence');
    console.log('4. Start/End dates should match application.startDate/endDate');
    console.log('5. Total owed should be calculated from application.roomPrice');
    console.log('6. Update debtors when applications are approved/modified');
    
  } catch (error) {
    console.error('❌ Error checking applications and debtors:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

checkApplicationsAndDebtors();
