const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');

async function checkAllStudentTransactions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Checking ALL transactions for student 68c308dacad4b54252cec896...');
    
    // Find ALL transactions for this student
    const allTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.student': '68c308dacad4b54252cec896' },
        { 'reference': { $regex: '68c308dacad4b54252cec896' } }
      ]
    }).sort({ createdAt: 1 });
    
    console.log('📊 Found ' + allTransactions.length + ' total transactions:');
    
    allTransactions.forEach((t, index) => {
      console.log('\n' + (index + 1) + '. ' + t.transactionId);
      console.log('   Description: ' + t.description);
      console.log('   Date: ' + t.date);
      console.log('   Total: $' + t.totalDebit + ' / $' + t.totalCredit);
      console.log('   Type: ' + (t.metadata?.transactionType || 'unknown'));
      
      if (t.entries && t.entries.length > 0) {
        console.log('   Entries:');
        t.entries.forEach((entry, i) => {
          console.log('     ' + (i+1) + '. ' + entry.accountCode + ' - ' + entry.accountName);
          console.log('        Debit: $' + entry.debit + ', Credit: $' + entry.credit);
        });
      }
    });
    
    // Check what was actually paid
    const payments = await Payment.find({
      student: '68c308dacad4b54252cec896'
    });
    
    console.log('\n💳 Actual payments made:');
    if (payments.length === 0) {
      console.log('No payments found for this student');
    } else {
      payments.forEach(p => {
        console.log('- Payment: $' + p.amount + ' (' + p.type + ') - ' + p.status);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkAllStudentTransactions();


