const mongoose = require('mongoose');
require('dotenv').config();

async function investigateDebtorLinking() {
  try {
    console.log('\n🔍 INVESTIGATING DEBTOR LINKING ISSUES');
    console.log('=======================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Debtor = require('../src/models/Debtor');
    const User = require('../src/models/User');
    const Residence = require('../src/models/Residence');
    const Application = require('../src/models/Application');
    const Booking = require('../src/models/Booking');
    
    // Check current debtors
    console.log('📊 CURRENT DEBTOR STATUS:');
    console.log('─'.repeat(50));
    
    const debtors = await Debtor.find()
      .populate('user', 'firstName lastName email currentRoom residence')
      .populate('residence', 'name')
      .lean();
    
    console.log(`Total debtors: ${debtors.length}\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found in database');
      return;
    }
    
    // Analyze each debtor
    for (const debtor of debtors) {
      console.log(`\n👤 Debtor: ${debtor.debtorCode}`);
      console.log('─'.repeat(30));
      
      const user = debtor.user;
      if (!user) {
        console.log('   ❌ No user linked to debtor');
        continue;
      }
      
      console.log(`   Student: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Current Room: ${user.currentRoom || 'Not set'}`);
      console.log(`   User Residence: ${user.residence || 'Not set'}`);
      console.log(`   Debtor Room: ${debtor.roomNumber || 'Not set'}`);
      console.log(`   Debtor Residence: ${debtor.residence || 'Not set'}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      
      // Check for room price information
      let roomPrice = null;
      let residenceName = null;
      
      // Try to get room price from various sources
      if (user.currentRoom && user.residence) {
        try {
          const residence = await Residence.findById(user.residence).lean();
          if (residence) {
            residenceName = residence.name;
            const room = residence.rooms.find(r => r.roomNumber === user.currentRoom);
            if (room) {
              roomPrice = room.price;
              console.log(`   ✅ Found room price: $${roomPrice} from residence: ${residenceName}`);
            } else {
              console.log(`   ⚠️  Room ${user.currentRoom} not found in residence ${residenceName}`);
            }
          }
        } catch (error) {
          console.log(`   ❌ Error getting residence data: ${error.message}`);
        }
      }
      
      // Check for application data
      try {
        const application = await Application.findOne({ student: user._id }).lean();
        if (application) {
          console.log(`   📝 Application found: Room ${application.roomNumber || 'Not set'}, Residence: ${application.residence || 'Not set'}`);
        } else {
          console.log(`   📝 No application found`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking application: ${error.message}`);
      }
      
      // Check for booking data
      try {
        const booking = await Booking.findOne({ student: user._id }).lean();
        if (booking) {
          console.log(`   🏠 Booking found: Room ${booking.room?.roomNumber || 'Not set'}, Residence: ${booking.residence || 'Not set'}`);
        } else {
          console.log(`   🏠 No booking found`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking booking: ${error.message}`);
      }
      
      // Identify the problem
      if (!debtor.roomNumber || !debtor.residence) {
        console.log(`   🚨 PROBLEM: Debtor missing room or residence link`);
        if (!debtor.roomNumber) console.log(`      - Missing roomNumber`);
        if (!debtor.residence) console.log(`      - Missing residence`);
      }
      
      if (debtor.totalOwed === 0) {
        console.log(`   🚨 PROBLEM: Debtor has $0 total owed - room price not calculated`);
      }
    }
    
    // Check students without debtors
    console.log('\n🔍 STUDENTS WITHOUT DEBTOR ACCOUNTS:');
    console.log('─'.repeat(50));
    
    const students = await User.find({ role: 'student' }).lean();
    const studentsWithDebtors = debtors.map(d => d.user._id.toString());
    const studentsWithoutDebtors = students.filter(s => !studentsWithDebtors.includes(s._id.toString()));
    
    console.log(`Total students: ${students.length}`);
    console.log(`Students with debtors: ${studentsWithDebtors.length}`);
    console.log(`Students without debtors: ${studentsWithoutDebtors.length}`);
    
    if (studentsWithoutDebtors.length > 0) {
      console.log('\nStudents missing debtor accounts:');
      studentsWithoutDebtors.forEach(student => {
        console.log(`   - ${student.firstName} ${student.lastName} (${student.email})`);
        console.log(`     Room: ${student.currentRoom || 'Not set'}`);
        console.log(`     Residence: ${student.residence || 'Not set'}`);
      });
    }
    
    // Summary of issues
    console.log('\n📋 SUMMARY OF LINKING ISSUES:');
    console.log('─'.repeat(50));
    
    const issues = [];
    
    debtors.forEach(debtor => {
      if (!debtor.roomNumber) issues.push(`Debtor ${debtor.debtorCode}: Missing room number`);
      if (!debtor.residence) issues.push(`Debtor ${debtor.debtorCode}: Missing residence link`);
      if (debtor.totalOwed === 0) issues.push(`Debtor ${debtor.debtorCode}: $0 total owed (room price not set)`);
    });
    
    if (issues.length === 0) {
      console.log('✅ No linking issues found - all debtors are properly connected');
    } else {
      console.log(`Found ${issues.length} linking issues:`);
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(30));
    console.log('1. Ensure debtor creation includes room and residence data');
    console.log('2. Link debtors to student current room and residence');
    console.log('3. Calculate totalOwed based on room price and lease duration');
    console.log('4. Update debtors when students change rooms or residences');
    
  } catch (error) {
    console.error('❌ Error investigating debtor linking:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

investigateDebtorLinking();
