const mongoose = require('mongoose');
require('dotenv').config();

async function checkStudentLease() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const User = require('./src/models/User');
    const Lease = require('./src/models/Lease');
    
    const studentId = '68adf1dc088169424e25c8ab';
    
    console.log('\n🔍 CHECKING STUDENT LEASE INFORMATION');
    console.log('=====================================');
    
    // 1. Check student details
    console.log('\n1️⃣ STUDENT DETAILS:');
    const student = await User.findById(studentId);
    if (student) {
      console.log(`Name: ${student.firstName} ${student.lastName}`);
      console.log(`Email: ${student.email}`);
      console.log(`Status: ${student.status}`);
      console.log(`Role: ${student.role}`);
    } else {
      console.log('❌ Student not found');
      return;
    }
    
    // 2. Check lease information
    console.log('\n2️⃣ LEASE INFORMATION:');
    const lease = await Lease.findOne({ student: studentId });
    if (lease) {
      console.log(`Lease ID: ${lease._id}`);
      console.log(`Start Date: ${lease.startDate}`);
      console.log(`End Date: ${lease.endDate}`);
      console.log(`Status: ${lease.status}`);
      console.log(`Rent Amount: $${lease.rentAmount}`);
      console.log(`Admin Fee: $${lease.adminFee}`);
      console.log(`Security Deposit: $${lease.securityDeposit}`);
      console.log(`Room: ${lease.room}`);
      console.log(`Residence: ${lease.residence}`);
      
      // Calculate lease months
      const startDate = new Date(lease.startDate);
      const endDate = new Date(lease.endDate);
      
      console.log(`\n📅 LEASE TIMELINE:`);
      console.log(`Lease starts: ${startDate.toLocaleDateString()} (Month ${startDate.getMonth() + 1})`);
      console.log(`Lease ends: ${endDate.toLocaleDateString()} (Month ${endDate.getMonth() + 1})`);
      
      // Check if lease started in May or June
      if (startDate.getMonth() === 4) { // May is month 4 (0-indexed)
        console.log(`✅ Lease started in MAY 2025`);
        console.log(`❌ This means May 2025 should have prorated rent!`);
      } else if (startDate.getMonth() === 5) { // June is month 5 (0-indexed)
        console.log(`✅ Lease started in JUNE 2025`);
        console.log(`✅ This means May 2025 has no rent due (correct)`);
      } else {
        console.log(`⚠️ Lease started in month ${startDate.getMonth() + 1} (unexpected)`);
      }
      
    } else {
      console.log('❌ No lease found for this student');
    }
    
    // 3. Check if there should be a lease start transaction
    console.log('\n3️⃣ LEASE START TRANSACTION CHECK:');
    if (lease && lease.startDate) {
      const startDate = new Date(lease.startDate);
      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();
      
      console.log(`Lease start: ${startYear}-${String(startMonth + 1).padStart(2, '0')}`);
      
      if (startMonth === 4) { // May
        console.log(`❌ PROBLEM: Lease starts in May but no lease_start transaction exists!`);
        console.log(`This means the system never created the initial accrual for May 2025.`);
        console.log(`The student should owe prorated rent for May 15-31, 2025.`);
      } else if (startMonth === 5) { // June
        console.log(`✅ CORRECT: Lease starts in June, no May rent due.`);
        console.log(`The system is working correctly - May 2025 has no outstanding balance.`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkStudentLease();
