const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAccountCodes() {
  try {
    console.log('🔍 Checking account codes in payment transactions...\n');

    // Get all payment transactions with monthSettled
    const paymentTxs = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${paymentTxs.length} payment transactions with monthSettled:\n`);

    paymentTxs.forEach((tx, index) => {
      console.log(`Transaction ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled}`);
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

    // Check for AR account codes specifically
    console.log('🔍 Checking for AR account codes (1100):');
    const arTxs = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true, $ne: null },
      'entries.accountCode': { $regex: '^1100' }
    }).lean();

    console.log(`Found ${arTxs.length} payment transactions with AR accounts:\n`);

    arTxs.forEach((tx, index) => {
      console.log(`AR Transaction ${index + 1}:`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  monthSettled: ${tx.metadata?.monthSettled}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode && entry.accountCode.startsWith('1100')) {
          console.log(`    AR Entry: ${entry.accountCode} - Credit: ${entry.credit || 0}`);
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

checkAccountCodes();
