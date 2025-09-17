const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function find340Reversal() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Finding the $340 reversal transaction...');
    
    // Find transactions with $340 amount
    const transactions340 = await TransactionEntry.find({
      $or: [
        { totalDebit: 340 },
        { totalCredit: 340 }
      ]
    }).sort({ createdAt: 1 });
    
    console.log('📊 Found ' + transactions340.length + ' transactions with $340:');
    
    transactions340.forEach((t, index) => {
      console.log('\n' + (index + 1) + '. ' + t.transactionId);
      console.log('   Description: ' + t.description);
      console.log('   Date: ' + t.date);
      console.log('   Total: $' + t.totalDebit + ' / $' + t.totalCredit);
      console.log('   Type: ' + (t.metadata?.transactionType || 'unknown'));
      console.log('   Status: ' + (t.status || 'posted'));
      
      if (t.entries && t.entries.length > 0) {
        console.log('   Entries:');
        t.entries.forEach((entry, i) => {
          console.log('     ' + (i+1) + '. ' + entry.accountCode + ' - ' + entry.accountName);
          console.log('        Debit: $' + entry.debit + ', Credit: $' + entry.credit);
          if (entry.metadata) {
            console.log('        Student: ' + (entry.metadata.studentId || entry.metadata.student || 'N/A'));
          }
        });
      }
    });
    
    // Also check for accrual reversal transactions
    const reversalTransactions = await TransactionEntry.find({
      'metadata.transactionType': 'accrual_reversal'
    }).sort({ createdAt: 1 });
    
    console.log('\n🔄 All accrual reversal transactions:');
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

find340Reversal();




