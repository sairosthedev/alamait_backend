const mongoose = require('mongoose');
const User = require('../src/models/User');
const TransactionEntry = require('../src/models/TransactionEntry');

async function checkAllStudentsAnd340() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Checking all students and $340 transactions...');
    
    // Get all users
    const allUsers = await User.find({ role: 'student' }).limit(10);
    console.log('👤 First 10 students:');
    allUsers.forEach((user, index) => {
      console.log((index + 1) + '. ' + user._id + ' - ' + user.firstName + ' ' + user.lastName + ' (' + user.email + ')');
    });
    
    // Find all transactions with $340
    const transactions340 = await TransactionEntry.find({
      $or: [
        { totalDebit: 340 },
        { totalCredit: 340 }
      ]
    }).sort({ createdAt: 1 });
    
    console.log('\n💰 All $340 transactions:');
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
        });
      }
    });
    
    // Check for any accrual reversal transactions
    const reversalTransactions = await TransactionEntry.find({
      'metadata.transactionType': 'accrual_reversal'
    }).sort({ createdAt: 1 });
    
    console.log('\n🔄 All accrual reversal transactions:');
    if (reversalTransactions.length === 0) {
      console.log('No accrual reversal transactions found');
    } else {
      reversalTransactions.forEach(t => {
        console.log('- ' + t.transactionId + ': $' + t.totalDebit + ' (' + t.description + ')');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkAllStudentsAnd340();


