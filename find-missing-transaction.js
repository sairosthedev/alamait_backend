require('dotenv').config();
const mongoose = require('mongoose');

async function findMissingTransaction() {
  console.log('🔍 Finding Missing Transaction...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Transaction = require('./src/models/Transaction');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('🔍 Looking for transaction TXN1760398313882KAG74...');
    
    // Search for the specific transaction ID that was mentioned in the BalanceSheetService output
    const specificTransaction = await Transaction.findOne({ 
      transactionId: 'TXN1760398313882KAG74' 
    });
    
    if (specificTransaction) {
      console.log(`📊 Found transaction: ${specificTransaction.transactionId}`);
      console.log(`   Date: ${specificTransaction.date}`);
      console.log(`   Source: ${specificTransaction.source}`);
      console.log(`   Description: ${specificTransaction.description || 'N/A'}`);
      
      // Get transaction entries
      const entries = await TransactionEntry.find({ transaction: specificTransaction._id });
      console.log(`   Entries: ${entries.length}`);
      
      for (const entry of entries) {
        console.log(`      - Account: ${entry.accountCode} (${entry.accountName})`);
        console.log(`        Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
        console.log(`        Balance: $${entry.balance || 0}`);
        
        if (entry.accountCode === '20041') {
          console.log(`        🎯 FOUND ACCOUNT 20041!`);
          console.log(`        Expected balance: $60`);
          console.log(`        Actual balance: $${entry.balance || 0}`);
        }
      }
    } else {
      console.log('❌ Transaction TXN1760398313882KAG74 not found');
    }
    
    // Let's also search by _id in case the transactionId is different
    console.log('\n🔍 Searching for transactions with similar ID pattern...');
    const similarTransactions = await Transaction.find({
      transactionId: { $regex: /TXN1760398313882/ }
    });
    
    console.log(`📊 Found ${similarTransactions.length} transactions with similar ID:`);
    
    for (const transaction of similarTransactions) {
      console.log(`   ${transaction.transactionId}: ${transaction.date} (${transaction.source})`);
    }
    
    // Let's check if there are any transactions with account 20041 in ANY month
    console.log('\n🔍 Searching for ANY transactions with account 20041...');
    const entries20041 = await TransactionEntry.find({ accountCode: '20041' });
    console.log(`📊 Found ${entries20041.length} transaction entries for account 20041:`);
    
    for (const entry of entries20041) {
      console.log(`\n📋 Entry: ${entry._id}`);
      console.log(`   Account: ${entry.accountCode} (${entry.accountName})`);
      console.log(`   Debit: $${entry.debitAmount || 0}, Credit: $${entry.creditAmount || 0}`);
      console.log(`   Balance: $${entry.balance || 0}`);
      
      const transaction = await Transaction.findById(entry.transaction);
      if (transaction) {
        console.log(`   Transaction: ${transaction.transactionId || transaction._id}`);
        console.log(`   Date: ${transaction.date}`);
        console.log(`   Source: ${transaction.source}`);
      }
    }
    
    // Let's also check if there are transactions in 2024 (maybe it's a different year)
    console.log('\n🔍 Checking for transactions in 2024...');
    const transactions2024 = await Transaction.find({
      date: {
        $gte: new Date('2024-07-01'),
        $lte: new Date('2024-07-31')
      }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${transactions2024.length} transactions in July 2024:`);
    
    for (const transaction of transactions2024) {
      console.log(`   ${transaction.transactionId || transaction._id}: ${transaction.date} (${transaction.source})`);
      
      const entries = await TransactionEntry.find({ transaction: transaction._id });
      for (const entry of entries) {
        if (entry.accountCode === '20041') {
          console.log(`      🎯 FOUND ACCOUNT 20041 in 2024!`);
          console.log(`      Balance: $${entry.balance || 0}`);
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

findMissingTransaction();


