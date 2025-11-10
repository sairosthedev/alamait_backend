require('dotenv').config();
const mongoose = require('mongoose');

async function debugBalanceSource() {
  console.log('🔍 Debugging Balance Source...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if there are any transactions that might affect account 20041
    const Transaction = require('./src/models/Transaction');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('🔍 Looking for transactions that might affect account 20041...');
    
    // Check for transactions with "Gift Plumber" in the description or any field
    const giftPlumberTransactions = await Transaction.find({
      $or: [
        { description: { $regex: /gift plumber/i } },
        { reference: { $regex: /gift plumber/i } },
        { notes: { $regex: /gift plumber/i } }
      ]
    });
    
    console.log(`📊 Found ${giftPlumberTransactions.length} transactions with "Gift Plumber":`);
    
    for (const transaction of giftPlumberTransactions) {
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
      }
    }
    
    // Check for any transactions with account code containing "20041"
    const entriesWith20041 = await TransactionEntry.find({
      $or: [
        { accountCode: { $regex: /20041/ } },
        { accountName: { $regex: /gift plumber/i } }
      ]
    });
    
    console.log(`\n📊 Found ${entriesWith20041.length} transaction entries with 20041 or Gift Plumber:`);
    
    for (const entry of entriesWith20041) {
      console.log(`\n📋 Entry: ${entry._id}`);
      console.log(`   Account: ${entry.accountCode} (${entry.accountName})`);
      console.log(`   Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
      console.log(`   Balance: $${entry.balance || 0}`);
      
      const transaction = await Transaction.findById(entry.transaction);
      if (transaction) {
        console.log(`   Transaction Date: ${transaction.date}`);
        console.log(`   Transaction Source: ${transaction.source}`);
      }
    }
    
    // Check if there are any manual transactions that might be creating this balance
    console.log('\n🔍 Checking for manual transactions...');
    const manualTransactions = await Transaction.find({ source: 'manual' }).sort({ date: -1 }).limit(5);
    console.log(`📊 Found ${manualTransactions.length} manual transactions:`);
    
    for (const transaction of manualTransactions) {
      console.log(`\n📋 Manual Transaction: ${transaction.transactionId || transaction._id}`);
      console.log(`   Date: ${transaction.date}`);
      console.log(`   Source: ${transaction.source}`);
      
      const entries = await TransactionEntry.find({ transaction: transaction._id });
      console.log(`   Entries: ${entries.length}`);
      
      for (const entry of entries) {
        console.log(`      - Account: ${entry.accountCode} (${entry.accountName})`);
        console.log(`        Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
        console.log(`        Balance: $${entry.balance || 0}`);
        
        if (entry.accountCode === '20041' || entry.accountName.toLowerCase().includes('gift plumber')) {
          console.log(`        🎯 FOUND ACCOUNT 20041!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugBalanceSource();




