const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAccrualAccounts() {
  try {
    console.log('🔍 Checking account codes in rental accrual transactions...\n');

    // Get all rental accrual transactions
    const accrualTxs = await TransactionEntry.find({
      source: 'rental_accrual'
    }).lean();

    console.log(`Found ${accrualTxs.length} rental accrual transactions:\n`);

    accrualTxs.forEach((tx, index) => {
      console.log(`Accrual Transaction ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Date: ${tx.date}`);
      console.log(`  Entries:`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`    Entry ${entryIndex + 1}:`);
        console.log(`      Account Code: ${entry.accountCode}`);
        console.log(`      Account Name: ${entry.accountName}`);
        console.log(`      Debit: ${entry.debit || 0}`);
        console.log(`      Credit: ${entry.credit || 0}`);
      });
      console.log('');
    });

    // Check for AR account codes specifically in accruals
    console.log('🔍 Checking for AR account codes (1100) in accruals:');
    const arAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      'entries.accountCode': { $regex: '^1100' }
    }).lean();

    console.log(`Found ${arAccruals.length} accrual transactions with AR accounts:\n`);

    arAccruals.forEach((tx, index) => {
      console.log(`AR Accrual ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Date: ${tx.date}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode && entry.accountCode.startsWith('1100')) {
          console.log(`    AR Entry: ${entry.accountCode} - Debit: ${entry.debit || 0}`);
        }
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAccrualAccounts();
