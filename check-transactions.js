const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function checkTransactions() {
  try {
    console.log('🔍 Checking transactions in database...\n');

    // Check total transactions
    const totalTransactions = await TransactionEntry.countDocuments();
    console.log(`📊 Total transactions in database: ${totalTransactions}`);

    if (totalTransactions > 0) {
      // Get sample transactions
      const sampleTransactions = await TransactionEntry.find().limit(5).lean();
      console.log('\n📋 Sample transactions:');
      sampleTransactions.forEach((tx, index) => {
        console.log(`Transaction ${index + 1}:`);
        console.log(`  ID: ${tx._id}`);
        console.log(`  Description: ${tx.description}`);
        console.log(`  Date: ${tx.date}`);
        console.log(`  Source: ${tx.source}`);
        console.log(`  Entries: ${tx.entries.length}`);
        console.log('');
      });

      // Check transactions by source
      const sources = await TransactionEntry.distinct('source');
      console.log('📊 Transaction sources:', sources);

      sources.forEach(async (source) => {
        const count = await TransactionEntry.countDocuments({ source });
        console.log(`  ${source}: ${count} transactions`);
      });

      // Check transactions with AR accounts
      const arTransactions = await TransactionEntry.find({
        'entries.accountCode': { $regex: '^1100' }
      }).lean();

      console.log(`\n📊 Transactions with AR accounts: ${arTransactions.length}`);
      arTransactions.forEach((tx, index) => {
        console.log(`AR Transaction ${index + 1}:`);
        console.log(`  Description: ${tx.description}`);
        console.log(`  Date: ${tx.date}`);
        console.log(`  Source: ${tx.source}`);
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            console.log(`    ${entry.accountCode}: Debit ${entry.debit || 0}, Credit ${entry.credit || 0}`);
          }
        });
        console.log('');
      });

    } else {
      console.log('❌ No transactions found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

checkTransactions();
