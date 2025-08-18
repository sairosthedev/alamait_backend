const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateBogusExpense() {
  try {
    console.log('🔍 Investigating Bogus Expense Account 5099...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Look for all transactions with account code 5099
    console.log('🔍 Searching for Account Code 5099...');
    const transactions = await TransactionEntry.find({
      'entries.accountCode': '5099'
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${transactions.length} transactions with account code 5099`);
    
    if (transactions.length > 0) {
      console.log('\n📋 Transaction Details:');
      transactions.forEach((tx, index) => {
        console.log(`\n--- Transaction ${index + 1} ---`);
        console.log(`Date: ${tx.date}`);
        console.log(`Description: ${tx.description}`);
        console.log(`Source: ${tx.source}`);
        console.log(`Status: ${tx.status}`);
        
        if (tx.entries) {
          tx.entries.forEach((entry, entryIndex) => {
            if (entry.accountCode === '5099') {
              console.log(`Entry ${entryIndex + 1}:`);
              console.log(`  Account Code: ${entry.accountCode}`);
              console.log(`  Account Name: ${entry.accountName}`);
              console.log(`  Account Type: ${entry.accountType}`);
              console.log(`  Debit: $${entry.debit || 0}`);
              console.log(`  Credit: $${entry.credit || 0}`);
              console.log(`  Description: ${entry.description}`);
            }
          });
        }
      });
    }
    
    // Also check for any transactions with "Other Operating Expenses" in the name
    console.log('\n🔍 Searching for "Other Operating Expenses"...');
    const otherExpenseTransactions = await TransactionEntry.find({
      'entries.accountName': { $regex: /other operating expenses/i }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${otherExpenseTransactions.length} transactions with "Other Operating Expenses"`);
    
    if (otherExpenseTransactions.length > 0) {
      console.log('\n📋 Other Operating Expenses Details:');
      otherExpenseTransactions.forEach((tx, index) => {
        console.log(`\n--- Transaction ${index + 1} ---`);
        console.log(`Date: ${tx.date}`);
        console.log(`Description: ${tx.description}`);
        console.log(`Source: ${tx.source}`);
        console.log(`Status: ${tx.status}`);
        
        if (tx.entries) {
          tx.entries.forEach((entry, entryIndex) => {
            if (entry.accountName && entry.accountName.toLowerCase().includes('other operating expenses')) {
              console.log(`Entry ${entryIndex + 1}:`);
              console.log(`  Account Code: ${entry.accountCode}`);
              console.log(`  Account Name: ${entry.accountName}`);
              console.log(`  Account Type: ${entry.accountType}`);
              console.log(`  Debit: $${entry.debit || 0}`);
              console.log(`  Credit: $${entry.credit || 0}`);
              console.log(`  Description: ${entry.description}`);
            }
          });
        }
      });
    }
    
    // Check for any suspiciously large amounts
    console.log('\n🔍 Searching for transactions with amounts > $100,000...');
    const largeTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.debit': { $gt: 100000 } },
        { 'entries.credit': { $gt: 100000 } }
      ]
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${largeTransactions.length} transactions with amounts > $100,000`);
    
    if (largeTransactions.length > 0) {
      console.log('\n🚨 LARGE TRANSACTIONS (>$100,000):');
      largeTransactions.forEach((tx, index) => {
        console.log(`\n--- Large Transaction ${index + 1} ---`);
        console.log(`Date: ${tx.date}`);
        console.log(`Description: ${tx.description}`);
        console.log(`Source: ${tx.source}`);
        console.log(`Status: ${tx.status}`);
        
        if (tx.entries) {
          tx.entries.forEach((entry, entryIndex) => {
            if ((entry.debit && entry.debit > 100000) || (entry.credit && entry.credit > 100000)) {
              console.log(`Entry ${entryIndex + 1}:`);
              console.log(`  Account Code: ${entry.accountCode}`);
              console.log(`  Account Name: ${entry.accountName}`);
              console.log(`  Account Type: ${entry.accountType}`);
              console.log(`  Debit: $${entry.debit || 0}`);
              console.log(`  Credit: $${entry.credit || 0}`);
              console.log(`  Description: ${entry.description}`);
            }
          });
        }
      });
    }
    
    console.log('\n✅ Investigation completed!');
    
  } catch (error) {
    console.error('❌ Error investigating bogus expense:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

investigateBogusExpense();
