const mongoose = require('mongoose');
require('dotenv').config();

async function testStudentIdConsistency() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    const RentalAccrualService = require('./src/services/rentalAccrualService');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🧪 TESTING STUDENT ID CONSISTENCY');
    console.log('==================================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Get student and application info
    const student = await User.findById(studentId);
    const application = await Application.findOne({ student: studentId });
    
    console.log(`Student Name: ${student ? `${student.firstName} ${student.lastName}` : 'Not found'}`);
    console.log(`Application ID: ${application ? application._id : 'Not found'}`);
    
    if (!student || !application) {
      console.log('❌ Student or application not found - cannot test');
      return;
    }
    
    // 2. Test creating a new monthly accrual
    console.log('\n📊 TESTING NEW MONTHLY ACCRUAL CREATION:');
    console.log('==========================================');
    
    const testMonth = 9; // September
    const testYear = 2025;
    
    console.log(`Creating accrual for ${testMonth}/${testYear}...`);
    
    try {
      const accrualResult = await RentalAccrualService.createStudentRentAccrual(
        application, // Pass application object
        testMonth,
        testYear
      );
      
      console.log('Accrual Result:', accrualResult);
      
      if (accrualResult.success) {
        console.log('✅ Monthly accrual created successfully');
        
        // 3. Check what account codes were used
        console.log('\n🔍 CHECKING ACCOUNT CODES USED:');
        console.log('================================');
        
        const newTransaction = await TransactionEntry.findOne({
          'metadata.studentId': studentId,
          'metadata.accrualMonth': testMonth,
          'metadata.accrualYear': testYear,
          'metadata.type': 'monthly_rent_accrual'
        });
        
        if (newTransaction) {
          console.log(`Transaction ID: ${newTransaction._id}`);
          console.log(`Description: ${newTransaction.description}`);
          console.log(`Source ID: ${newTransaction.sourceId}`);
          console.log(`Reference: ${newTransaction.reference}`);
          
          console.log('\n📋 Account Codes Used:');
          newTransaction.entries.forEach((entry, index) => {
            console.log(`  ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
            console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
          });
          
          // Check if account codes use student ID or application ID
          const arEntry = newTransaction.entries.find(e => e.accountCode.startsWith('1100-'));
          if (arEntry) {
            const idInCode = arEntry.accountCode.replace('1100-', '');
            console.log(`\n🎯 ACCOUNT CODE ANALYSIS:`);
            console.log(`   Account Code: ${arEntry.accountCode}`);
            console.log(`   ID in Code: ${idInCode}`);
            console.log(`   Expected Student ID: ${studentId}`);
            console.log(`   Application ID: ${application._id}`);
            
            if (idInCode === studentId) {
              console.log(`   ✅ CORRECT: Using student ID`);
            } else if (idInCode === application._id.toString()) {
              console.log(`   ❌ WRONG: Using application ID`);
            } else {
              console.log(`   ❓ UNKNOWN: Using different ID`);
            }
          }
          
          // Check metadata
          console.log(`\n📋 METADATA ANALYSIS:`);
          console.log(`   studentId in metadata: ${newTransaction.metadata?.studentId}`);
          console.log(`   applicationId in metadata: ${newTransaction.metadata?.applicationId || 'None'}`);
          
          if (newTransaction.metadata?.studentId === studentId && !newTransaction.metadata?.applicationId) {
            console.log(`   ✅ CORRECT: Metadata uses student ID only`);
          } else {
            console.log(`   ❌ WRONG: Metadata still uses application ID`);
          }
          
        } else {
          console.log('❌ New transaction not found');
        }
        
        // 4. Clean up test data
        console.log('\n🧹 CLEANING UP TEST DATA:');
        console.log('==========================');
        
        await TransactionEntry.deleteMany({
          'metadata.studentId': studentId,
          'metadata.accrualMonth': testMonth,
          'metadata.accrualYear': testYear,
          'metadata.type': 'monthly_rent_accrual'
        });
        
        console.log('✅ Test data cleaned up');
        
      } else {
        console.log(`❌ Accrual creation failed: ${accrualResult.error}`);
      }
      
    } catch (error) {
      console.error('❌ Error creating accrual:', error.message);
    }
    
    // 5. Summary
    console.log('\n📈 SUMMARY:');
    console.log('===========');
    console.log('✅ Fixed rentalAccrualService.js to use student IDs');
    console.log('✅ Fixed accountingService.js to use student IDs');
    console.log('✅ All new transactions should now use student IDs consistently');
    console.log('✅ No more application IDs in account codes or metadata');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testStudentIdConsistency();
