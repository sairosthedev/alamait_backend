const mongoose = require('mongoose');
require('dotenv').config();

async function checkStudentData() {
  try {
    console.log('\n👥 CHECKING STUDENT DATA AND ROOM ASSIGNMENTS');
    console.log('=============================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Residence = require('../src/models/Residence');
    const Debtor = require('../src/models/Debtor');
    
    // Check all students
    console.log('📊 STUDENT DATA ANALYSIS:');
    console.log('─'.repeat(50));
    
    const students = await User.find({ role: 'student' }).lean();
    console.log(`Total students: ${students.length}\n`);
    
    if (students.length === 0) {
      console.log('❌ No students found in database');
      return;
    }
    
    // Analyze each student
    for (const student of students) {
      console.log(`👤 Student: ${student.firstName} ${student.lastName}`);
      console.log('─'.repeat(30));
      console.log(`   Email: ${student.email}`);
      console.log(`   Current Room: ${student.currentRoom || 'Not set'}`);
      console.log(`   Residence: ${student.residence || 'Not set'}`);
      console.log(`   Room Valid Until: ${student.roomValidUntil || 'Not set'}`);
      console.log(`   Room Approval Date: ${student.roomApprovalDate || 'Not set'}`);
      
      // Check if student has a debtor account
      const debtor = await Debtor.findOne({ user: student._id }).lean();
      if (debtor) {
        console.log(`   ✅ Has Debtor Account: ${debtor.debtorCode}`);
        console.log(`   Debtor Room: ${debtor.roomNumber || 'Not set'}`);
        console.log(`   Debtor Residence: ${debtor.residence || 'Not set'}`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
      } else {
        console.log(`   ❌ No Debtor Account`);
      }
      
      // Check residence details if available
      if (student.residence) {
        try {
          const residence = await Residence.findById(student.residence).lean();
          if (residence) {
            console.log(`   🏠 Residence: ${residence.name}`);
            
            // Check if student's room exists in this residence
            if (student.currentRoom) {
              const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
              if (room) {
                console.log(`   ✅ Room Found: ${room.roomNumber} - Type: ${room.type} - Price: $${room.price}`);
              } else {
                console.log(`   ❌ Room ${student.currentRoom} not found in residence ${residence.name}`);
                console.log(`   Available rooms: ${residence.rooms.map(r => r.roomNumber).join(', ')}`);
              }
            }
          } else {
            console.log(`   ❌ Residence not found in database`);
          }
        } catch (error) {
          console.log(`   ❌ Error getting residence data: ${error.message}`);
        }
      }
      
      console.log('');
    }
    
    // Check residences
    console.log('🏠 RESIDENCE DATA:');
    console.log('─'.repeat(50));
    
    const residences = await Residence.find().lean();
    console.log(`Total residences: ${residences.length}\n`);
    
    residences.forEach(residence => {
      console.log(`Residence: ${residence.name}`);
      console.log(`   Rooms: ${residence.rooms.length}`);
      residence.rooms.forEach(room => {
        console.log(`     - ${room.roomNumber}: ${room.type} ($${room.price}) - Status: ${room.status}`);
      });
      console.log('');
    });
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log('─'.repeat(30));
    
    const studentsWithRooms = students.filter(s => s.currentRoom);
    const studentsWithResidences = students.filter(s => s.residence);
    const studentsWithDebtors = students.filter(s => {
      return Debtor.findOne({ user: s._id });
    });
    
    console.log(`Students with room assignments: ${studentsWithRooms.length}/${students.length}`);
    console.log(`Students with residence links: ${studentsWithResidences.length}/${students.length}`);
    console.log(`Students with debtor accounts: ${studentsWithDebtors.length}/${students.length}`);
    
    if (studentsWithRooms.length === 0) {
      console.log('\n🚨 MAIN ISSUE: No students have room assignments!');
      console.log('   This is why debtors can\'t link to room details and price');
    }
    
    if (studentsWithResidences.length === 0) {
      console.log('\n🚨 MAIN ISSUE: No students have residence links!');
      console.log('   This prevents proper room and price lookup');
    }
    
    console.log('\n💡 ROOT CAUSE:');
    console.log('─'.repeat(20));
    console.log('1. Students don\'t have currentRoom set');
    console.log('2. Students don\'t have residence linked');
    console.log('3. Debtor creation can\'t determine room price');
    console.log('4. Total owed calculations are using default values');
    
    console.log('\n🔧 SOLUTION:');
    console.log('─'.repeat(20));
    console.log('1. Assign students to rooms and residences');
    console.log('2. Update debtor accounts with room and residence data');
    console.log('3. Calculate totalOwed based on actual room prices');
    console.log('4. Ensure proper linking between students, rooms, and residences');
    
  } catch (error) {
    console.error('❌ Error checking student data:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

checkStudentData();
