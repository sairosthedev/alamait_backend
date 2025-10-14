require('dotenv').config();
const mongoose = require('mongoose');

async function checkTransactionAmount() {
  console.log('🔍 Checking Transaction Amount for July 2025...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the transaction that should create the $60 balance
    const Transaction = require('./src/models/Transaction');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('🔍 Looking for transactions in July 2025...');
    
    // Find transactions in July 2025
    const julyTransactions = await Transaction.find({
      date: {
        $gte: new Date('2025-07-01'),
        $lte: new Date('2025-07-31')
      }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${julyTransactions.length} transactions in July 2025:`);
    
    for (const transaction of julyTransactions) {
      console.log(`\n📋 Transaction: ${transaction.transactionId || transaction._id}`);
      console.log(`   Date: ${transaction.date}`);
      console.log(`   Source: ${transaction.source}`);
      
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
          
          if (entry.balance === 60) {
            console.log(`        ✅ Balance is correct!`);
          } else {
            console.log(`        ❌ Balance is incorrect!`);
          }
        }
      }
    }
    
    // Also check the account balance directly
    console.log('\n🔍 Checking Account 20041 balance directly...');
    const Account = require('./src/models/Account');
    const account20041 = await Account.findOne({ code: '20041' });
    
    if (account20041) {
      console.log(`   Account: ${account20041.code} - ${account20041.name}`);
      console.log(`   Parent Account: ${account20041.parentAccount}`);
      console.log(`   Type: ${account20041.type}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkTransactionAmount();


