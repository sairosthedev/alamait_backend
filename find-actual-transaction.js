require('dotenv').config();
const mongoose = require('mongoose');

async function findActualTransaction() {
  console.log('🔍 Finding the Actual Transaction...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find ALL transactions that involve account 20041
    const Transaction = require('./src/models/Transaction');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('🔍 Looking for transactions involving account 20041...');
    
    // Find transaction entries for account 20041
    const entries20041 = await TransactionEntry.find({ accountCode: '20041' });
    console.log(`📊 Found ${entries20041.length} transaction entries for account 20041:`);
    
    for (const entry of entries20041) {
      console.log(`\n📋 Entry ID: ${entry._id}`);
      console.log(`   Account: ${entry.accountCode} (${entry.accountName})`);
      console.log(`   Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
      console.log(`   Balance: $${entry.balance || 0}`);
      
      // Get the transaction
      const transaction = await Transaction.findById(entry.transaction);
      if (transaction) {
        console.log(`   Transaction: ${transaction.transactionId || transaction._id}`);
        console.log(`   Date: ${transaction.date}`);
        console.log(`   Source: ${transaction.source}`);
        
        // Check if this is the $60 transaction
        if (entry.balance === 60) {
          console.log(`   🎯 FOUND THE $60 TRANSACTION!`);
          console.log(`   Transaction Date: ${transaction.date}`);
          console.log(`   Year: ${transaction.date.getFullYear()}`);
          console.log(`   Month: ${transaction.date.getMonth() + 1}`);
        }
      }
    }
    
    // Also check all transactions to see what dates we have
    console.log('\n🔍 Checking all transaction dates...');
    const allTransactions = await Transaction.find({}).sort({ date: 1 }).limit(10);
    console.log(`📊 Sample of ${allTransactions.length} transactions:`);
    
    for (const transaction of allTransactions) {
      console.log(`   ${transaction.transactionId || transaction._id}: ${transaction.date} (${transaction.source})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

findActualTransaction();


