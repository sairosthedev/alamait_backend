const mongoose = require('mongoose');

// Use the same MongoDB URI as other services
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function checkAccountsPayable() {
  try {
    console.log('🔍 Checking Accounts Payable accounts and their balances...\n');
    
    // Connect to database
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }
    
    const Account = require('./src/models/Account');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Find all Accounts Payable accounts
    const apAccounts = await Account.find({
      $or: [
        { code: { $regex: '^20' } }, // 2000-2099
        { name: { $regex: /accounts payable/i } },
        { type: 'Liability' }
      ]
    }).sort({ code: 1 });
    
    console.log('📋 All Accounts Payable related accounts:');
    apAccounts.forEach(account => {
      console.log(`  ${account.code} - ${account.name} (${account.type})`);
    });
    
    // Check transaction entries for these accounts
    console.log('\n🔍 Checking transaction entries for AP accounts...');
    
    const apCodes = apAccounts.map(acc => acc.code);
    const transactions = await TransactionEntry.find({
      'entries.accountCode': { $in: apCodes }
    }).sort({ date: -1 }).limit(10);
    
    console.log(`\n📊 Found ${transactions.length} transactions with AP accounts:`);
    
    transactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Source: ${tx.source}`);
      
      tx.entries.forEach(entry => {
        if (apCodes.includes(entry.accountCode)) {
          console.log(`   AP Entry: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`   Debit: ${entry.debit}, Credit: ${entry.credit}`);
        }
      });
    });
    
    // Calculate current balances for AP accounts
    console.log('\n💰 Current balances for AP accounts:');
    
    for (const account of apAccounts) {
      const transactions = await TransactionEntry.find({
        'entries.accountCode': account.code
      });
      
      let balance = 0;
      let debitTotal = 0;
      let creditTotal = 0;
      
      transactions.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode === account.code) {
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            debitTotal += debit;
            creditTotal += credit;
            
            // For liabilities, balance = credit - debit
            balance += credit - debit;
          }
        });
      });
      
      if (Math.abs(balance) > 0.01) {
        console.log(`  ${account.code} - ${account.name}: $${balance.toFixed(2)} (Debit: $${debitTotal}, Credit: $${creditTotal})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking Accounts Payable:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAccountsPayable();
