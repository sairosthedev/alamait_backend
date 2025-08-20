const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const User = require('../src/models/User');
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');
const { createDebtorForStudent } = require('../src/services/debtorService');

async function testNewDebtorCreation() {
  try {
    console.log('🧪 Testing new debtor creation logic...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get an existing student
    const student = await User.findOne({ role: 'student' });
    if (!student) {
      console.log('❌ No students found in database');
      return;
    }
    
    console.log(`👤 Testing with student: ${student.firstName} ${student.lastName} (${student.email})`);
    
    // Check if debtor already exists
    const existingDebtor = await Debtor.findOne({ user: student._id });
    if (existingDebtor) {
      console.log('🗑️  Deleting existing debtor for clean test...');
      await Debtor.findByIdAndDelete(existingDebtor._id);
    }
    
    // Get application for this student
    const application = await Application.findOne({ student: student._id })
      .populate('residence', 'name');
    
    if (!application) {
      console.log('❌ No application found for this student');
      return;
    }
    
    console.log(`📝 Found application: ${application.applicationCode}`);
    console.log(`   Residence: ${application.residence?.name}`);
    console.log(`   Allocated Room: ${application.allocatedRoom}`);
    console.log(`   Start Date: ${application.startDate}`);
    console.log(`   End Date: ${application.endDate}`);
    
    // Create debtor using the service
    console.log('\n🔄 Creating debtor using updated service...');
    const newDebtor = await createDebtorForStudent(student, {
      createdBy: new mongoose.Types.ObjectId()
    });
    
    console.log('\n📊 Created Debtor Details:');
    console.log(`   Debtor Code: ${newDebtor.debtorCode}`);
    console.log(`   Residence: ${newDebtor.residence}`);
    console.log(`   Room Number: ${newDebtor.roomNumber}`);
    console.log(`   Room Price: $${newDebtor.roomPrice}`);
    console.log(`   Start Date: ${newDebtor.startDate}`);
    console.log(`   End Date: ${newDebtor.endDate}`);
    console.log(`   Total Owed: $${newDebtor.totalOwed}`);
    
    if (newDebtor.financialBreakdown) {
      console.log('\n💰 Financial Breakdown:');
      console.log(`   Monthly Rent: $${newDebtor.financialBreakdown.monthlyRent}`);
      console.log(`   Number of Months: ${newDebtor.financialBreakdown.numberOfMonths}`);
      console.log(`   Total Rent: $${newDebtor.financialBreakdown.totalRent}`);
      console.log(`   Admin Fee: $${newDebtor.financialBreakdown.adminFee}`);
      console.log(`   Deposit: $${newDebtor.financialBreakdown.deposit}`);
      console.log(`   Total Owed: $${newDebtor.financialBreakdown.totalOwed}`);
      
      // Verify calculation
      const expectedTotal = newDebtor.financialBreakdown.totalRent + 
                           newDebtor.financialBreakdown.adminFee + 
                           newDebtor.financialBreakdown.deposit;
      
      console.log('\n✅ Calculation Verification:');
      console.log(`   Expected Total: $${expectedTotal}`);
      console.log(`   Actual Total Owed: $${newDebtor.totalOwed}`);
      console.log(`   Match: ${expectedTotal === newDebtor.totalOwed ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log('\n✅ New debtor creation logic test completed!');
    
  } catch (error) {
    console.error('❌ Error testing new debtor creation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the test
testNewDebtorCreation();

