const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');

async function checkStudentAccruals() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Checking actual accruals for student 68c308dacad4b54252cec896...');
    
    // Find all accrual transactions for this student
    const accrualTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.student': '68c308dacad4b54252cec896' }
      ],
      'metadata.transactionType': { $in: ['lease_start', 'student_added', 'accrual'] }
    }).sort({ createdAt: 1 });
    
    console.log('📊 Found ' + accrualTransactions.length + ' accrual transactions:');
    
    let totalAccruals = 0;
    accrualTransactions.forEach((t, index) => {
      console.log('\n' + (index + 1) + '. ' + t.transactionId + ' - ' + t.description);
      console.log('   Date: ' + t.date);
      console.log('   Total: $' + t.totalDebit);
      
      t.entries.forEach(entry => {
        if (entry.metadata && entry.metadata.studentId === '68c308dacad4b54252cec896') {
          console.log('   - ' + entry.accountCode + ': $' + entry.debit + ' (debit)');
          totalAccruals += entry.debit;
        }
      });
    });
    
    console.log('\n💰 Total accruals for student: $' + totalAccruals);
    
    // Check what was actually paid
    const payments = await Payment.find({
      student: '68c308dacad4b54252cec896'
    });
    
    console.log('\n💳 Actual payments made:');
    payments.forEach(p => {
      console.log('- Payment: $' + p.amount + ' (' + p.type + ')');
    });
    
    // Check reversal transactions
    const reversalTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' }
      ],
      'metadata.transactionType': 'accrual_reversal'
    });
    
    console.log('\n🔄 Reversal transactions:');
    reversalTransactions.forEach(t => {
      console.log('- ' + t.transactionId + ': $' + t.totalDebit + ' (' + t.description + ')');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkStudentAccruals();


