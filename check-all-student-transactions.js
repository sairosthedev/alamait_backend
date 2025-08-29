const mongoose = require('mongoose');
require('dotenv').config();

async function checkAllStudentTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const User = require('./src/models/User');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    console.log(`\n🔍 CHECKING ALL TRANSACTIONS FOR STUDENT: ${studentId}`);
    console.log('================================================');
    
    // Get student details
    const student = await User.findById(studentId);
    console.log(`Student: ${student.firstName} ${student.lastName}`);
    console.log(`Email: ${student.email}`);
    
    // Check ALL transactions that reference this student
    const allTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': studentId },
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } },
        { sourceId: studentId }
      ]
    }).sort({ date: 1 });
    
    console.log(`\n📊 Found ${allTransactions.length} total transactions:`);
    
    if (allTransactions.length === 0) {
      console.log('❌ No transactions found!');
      return;
    }
    
    allTransactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${transaction.source}`);
      console.log(`   Source ID: ${transaction.sourceId}`);
      console.log(`   Description: ${transaction.description}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Total Debit: $${transaction.totalDebit}`);
      console.log(`   Total Credit: $${transaction.totalCredit}`);
      
      // Check metadata
      if (transaction.metadata) {
        console.log(`   Metadata:`);
        console.log(`     Student ID: ${transaction.metadata.studentId || 'N/A'}`);
        console.log(`     Month Key: ${transaction.metadata.monthKey || 'N/A'}`);
        console.log(`     Type: ${transaction.metadata.type || 'N/A'}`);
        console.log(`     Student Name: ${transaction.metadata.studentName || 'N/A'}`);
      }
      
      // Check entries
      console.log(`   Entries:`);
      transaction.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`        Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`        Description: ${entry.description}`);
      });
    });
    
    // Check specifically for AR account codes
    console.log('\n💰 AR ACCOUNT CODES ANALYSIS:');
    console.log('==============================');
    
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    console.log(`Found ${arTransactions.length} transactions with AR account codes:`);
    
    arTransactions.forEach((transaction, index) => {
      const arEntry = transaction.entries.find(e => e.accountCode.startsWith('1100-'));
      console.log(`\n${index + 1}. Transaction: ${transaction._id}`);
      console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${transaction.source}`);
      console.log(`   AR Account: ${arEntry?.accountCode}`);
      console.log(`   AR Debit: $${arEntry?.debit || 0}`);
      console.log(`   AR Credit: $${arEntry?.credit || 0}`);
      console.log(`   Net AR: $${(arEntry?.debit || 0) - (arEntry?.credit || 0)}`);
    });
    
    // Check for outstanding balances specifically
    console.log('\n📈 OUTSTANDING BALANCES DETAILED:');
    console.log('==================================');
    
    const outstandingTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      'entries.accountType': 'asset',
      'entries.debit': { $gt: 0 }
    });
    
    console.log(`Found ${outstandingTransactions.length} transactions with outstanding balances:`);
    
    let totalOutstanding = 0;
    outstandingTransactions.forEach((transaction, index) => {
      const arEntry = transaction.entries.find(e => 
        e.accountCode.startsWith('1100-') && e.debit > 0
      );
      
      if (arEntry) {
        const outstanding = arEntry.debit - (arEntry.credit || 0);
        totalOutstanding += outstanding;
        
        console.log(`\n${index + 1}. Transaction: ${transaction._id}`);
        console.log(`   Date: ${transaction.date.toISOString().split('T')[0]}`);
        console.log(`   Account: ${arEntry.accountCode}`);
        console.log(`   Original Debit: $${arEntry.debit}`);
        console.log(`   Credits Applied: $${arEntry.credit || 0}`);
        console.log(`   Outstanding: $${outstanding}`);
        console.log(`   Source: ${transaction.source}`);
        console.log(`   Month Key: ${transaction.metadata?.monthKey || 'N/A'}`);
      }
    });
    
    console.log(`\n💰 TOTAL OUTSTANDING: $${totalOutstanding.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkAllStudentTransactions();
