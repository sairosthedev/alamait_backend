const mongoose = require('mongoose');
require('dotenv').config();

async function fixStudentIdMismatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    const Application = require('./src/models/Application');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    const applicationId = '68af5d953dbf8f2c7c41e5b8'; // Wrong ID being used
    
    console.log('\n🔧 FIXING STUDENT ID MISMATCH');
    console.log('================================');
    console.log(`Student ID: ${studentId}`);
    console.log(`Application ID (wrong): ${applicationId}`);
    
    // 1. Get student info
    const student = await User.findById(studentId);
    const application = await Application.findById(applicationId);
    
    console.log(`Student Name: ${student ? `${student.firstName} ${student.lastName}` : 'Not found'}`);
    console.log(`Application Name: ${application ? `${application.firstName} ${application.lastName}` : 'Not found'}`);
    
    // 2. Find transactions using the wrong application ID
    console.log('\n🔍 FINDING TRANSACTIONS WITH WRONG ID:');
    console.log('=======================================');
    
    const wrongTransactions = await TransactionEntry.find({
      'entries.accountCode': `1100-${applicationId}`
    }).sort({ date: 1 });
    
    console.log(`Found ${wrongTransactions.length} transactions using wrong application ID`);
    
    if (wrongTransactions.length === 0) {
      console.log('✅ No transactions found with wrong ID');
      return;
    }
    
    // 3. Show what will be fixed
    console.log('\n📋 TRANSACTIONS TO BE FIXED:');
    console.log('=============================');
    
    wrongTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Current Account Code: 1100-${applicationId}`);
      console.log(`   New Account Code: 1100-${studentId}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode.startsWith('1100-')) {
          console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - $${entry.debit || entry.credit}`);
        }
      });
    });
    
    // 4. Fix the transactions
    console.log('\n🔧 FIXING TRANSACTIONS:');
    console.log('=======================');
    
    let fixedCount = 0;
    
    for (const tx of wrongTransactions) {
      console.log(`\n🔧 Fixing: ${tx.description}`);
      
      // Update sourceId and reference if they point to application
      if (tx.sourceId && tx.sourceId.toString() === applicationId) {
        tx.sourceId = studentId;
        console.log(`   Updated sourceId: ${applicationId} → ${studentId}`);
      }
      
      if (tx.reference && tx.reference.toString() === applicationId) {
        tx.reference = studentId;
        console.log(`   Updated reference: ${applicationId} → ${studentId}`);
      }
      
      // Update metadata
      if (tx.metadata) {
        if (tx.metadata.applicationId === applicationId) {
          tx.metadata.applicationId = studentId;
          console.log(`   Updated metadata.applicationId: ${applicationId} → ${studentId}`);
        }
        if (tx.metadata.studentId === applicationId) {
          tx.metadata.studentId = studentId;
          console.log(`   Updated metadata.studentId: ${applicationId} → ${studentId}`);
        }
      }
      
      // Update account codes in entries
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode === `1100-${applicationId}`) {
          const oldCode = entry.accountCode;
          entry.accountCode = `1100-${studentId}`;
          entry.accountName = `Accounts Receivable - ${student.firstName} ${student.lastName}`;
          console.log(`   Updated Entry ${entryIndex + 1}: ${oldCode} → ${entry.accountCode}`);
        }
      });
      
      // Save the updated transaction
      await tx.save();
      console.log(`   ✅ Fixed successfully`);
      fixedCount++;
    }
    
    // 5. Verify the fix
    console.log('\n✅ VERIFICATION:');
    console.log('=================');
    
    const remainingWrongTransactions = await TransactionEntry.find({
      'entries.accountCode': `1100-${applicationId}`
    });
    
    console.log(`Remaining transactions with wrong ID: ${remainingWrongTransactions.length}`);
    
    if (remainingWrongTransactions.length === 0) {
      console.log('✅ All transactions now use correct student ID');
    } else {
      console.log('⚠️  Some transactions still use wrong ID');
    }
    
    // 6. Show updated balances
    console.log('\n📊 UPDATED BALANCES:');
    console.log('=====================');
    
    const correctTransactions = await TransactionEntry.find({
      'entries.accountCode': `1100-${studentId}`
    });
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    correctTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode === `1100-${studentId}`) {
          totalDebit += entry.debit || 0;
          totalCredit += entry.credit || 0;
        }
      });
    });
    
    const balance = totalDebit - totalCredit;
    console.log(`Student Account (${studentId}):`);
    console.log(`   Total Debit: $${totalDebit.toFixed(2)}`);
    console.log(`   Total Credit: $${totalCredit.toFixed(2)}`);
    console.log(`   Balance: $${balance.toFixed(2)}`);
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Transactions fixed: ${fixedCount}`);
    console.log(`   All transactions now use student ID: ${studentId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixStudentIdMismatch();
