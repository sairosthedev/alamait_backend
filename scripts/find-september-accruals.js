const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function findSeptemberAccruals() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Finding September accruals for student 68c308dacad4b54252cec896...');
    
    // Find accrual transactions for September 2025
    const septemberAccruals = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.student': '68c308dacad4b54252cec896' }
      ],
      date: {
        $gte: new Date('2025-09-01'),
        $lt: new Date('2025-10-01')
      }
    }).sort({ createdAt: 1 });
    
    console.log('📊 Found ' + septemberAccruals.length + ' September transactions:');
    
    let totalAccruals = 0;
    septemberAccruals.forEach((t, index) => {
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
          if (entry.metadata && entry.metadata.studentId === '68c308dacad4b54252cec896') {
            totalAccruals += entry.debit;
          }
        });
      }
    });
    
    console.log('\n💰 Total September accruals for student: $' + totalAccruals);
    
    // Also check for any existing reversal transactions
    const reversals = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' }
      ],
      'metadata.transactionType': 'accrual_reversal'
    });
    
    console.log('\n🔄 Existing reversal transactions:');
    reversals.forEach(t => {
      console.log('- ' + t.transactionId + ': $' + t.totalDebit + ' (' + t.description + ')');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

findSeptemberAccruals();




