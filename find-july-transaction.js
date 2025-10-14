require('dotenv').config();
const mongoose = require('mongoose');

async function findJulyTransaction() {
  console.log('🔍 Finding July Transaction...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Transaction = require('./src/models/Transaction');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('🔍 Looking for transactions in July 2025 (broader search)...');
    
    // Search for transactions in July 2025 with a broader date range
    const julyTransactions = await Transaction.find({
      date: {
        $gte: new Date('2025-07-01T00:00:00.000Z'),
        $lte: new Date('2025-07-31T23:59:59.999Z')
      }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${julyTransactions.length} transactions in July 2025:`);
    
    for (const transaction of julyTransactions) {
      console.log(`\n📋 Transaction: ${transaction.transactionId || transaction._id}`);
      console.log(`   Date: ${transaction.date}`);
      console.log(`   Source: ${transaction.source}`);
      console.log(`   Description: ${transaction.description || 'N/A'}`);
      
      // Get transaction entries
      const entries = await TransactionEntry.find({ transaction: transaction._id });
      console.log(`   Entries: ${entries.length}`);
      
      for (const entry of entries) {
        console.log(`      - Account: ${entry.accountCode} (${entry.accountName})`);
        console.log(`        Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
        console.log(`        Balance: $${entry.balance || 0}`);
        
        // Check if this is the AP account 20041
        if (entry.accountCode === '20041') {
          console.log(`        🎯 FOUND AP ACCOUNT 20041!`);
          console.log(`        Expected balance: $60`);
          console.log(`        Actual balance: $${entry.balance || 0}`);
        }
      }
    }
    
    // If no transactions found, let's check what transactions exist around that time
    if (julyTransactions.length === 0) {
      console.log('\n🔍 No transactions found in July, checking nearby months...');
      
      // Check June and August
      const nearbyTransactions = await Transaction.find({
        date: {
          $gte: new Date('2025-06-01T00:00:00.000Z'),
          $lte: new Date('2025-08-31T23:59:59.999Z')
        }
      }).sort({ date: 1 }).limit(10);
      
      console.log(`📊 Found ${nearbyTransactions.length} transactions in June-August 2025:`);
      
      for (const transaction of nearbyTransactions) {
        console.log(`   ${transaction.transactionId || transaction._id}: ${transaction.date} (${transaction.source})`);
        
        // Get transaction entries for this transaction
        const entries = await TransactionEntry.find({ transaction: transaction._id });
        for (const entry of entries) {
          if (entry.accountCode === '20041') {
            console.log(`      🎯 FOUND ACCOUNT 20041 in ${transaction.date}!`);
            console.log(`      Balance: $${entry.balance || 0}`);
          }
        }
      }
    }
    
    // Also check if there are any transactions with different date formats
    console.log('\n🔍 Checking all transactions to see date formats...');
    const allTransactions = await Transaction.find({}).sort({ date: -1 }).limit(20);
    console.log(`📊 Sample of ${allTransactions.length} recent transactions:`);
    
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

findJulyTransaction();


