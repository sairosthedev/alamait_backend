const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugARBalance() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 DEBUGGING AR BALANCE\n');

    // Find all transactions with 1100 accounts
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${arTransactions.length} transactions with 1100 accounts:\n`);

    let runningBalance = 0;
    const accountBalances = {};

    arTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Transaction ID: ${tx.transactionId}`);
      console.log(`   Source: ${tx.source}`);
      
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          const amount = (entry.debit || 0) - (entry.credit || 0);
          runningBalance += amount;
          
          if (!accountBalances[entry.accountCode]) {
            accountBalances[entry.accountCode] = 0;
          }
          accountBalances[entry.accountCode] += amount;
          
          console.log(`   - ${entry.accountCode}: ${entry.accountName}`);
          console.log(`     Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
          console.log(`     Net: $${amount}, Running Balance: $${runningBalance}`);
        }
      });
      console.log('');
    });

    console.log('📊 FINAL ACCOUNT BALANCES:');
    Object.entries(accountBalances).forEach(([accountCode, balance]) => {
      console.log(`   ${accountCode}: $${balance}`);
    });
    console.log(`\n💰 TOTAL AR BALANCE: $${runningBalance}`);

    // Check if there are any transactions with 1100 accounts that might be filtered out
    const allTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /1100/ }
    });

    console.log(`\n🔍 Total transactions containing '1100': ${allTransactions.length}`);
    
    if (allTransactions.length !== arTransactions.length) {
      console.log('⚠️  Some transactions might be filtered out due to status');
      
      allTransactions.forEach(tx => {
        if (tx.status !== 'posted') {
          console.log(`   - ${tx.transactionId}: ${tx.description} (Status: ${tx.status})`);
        }
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

debugARBalance();
