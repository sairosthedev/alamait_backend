/**
 * 🔍 Check Expense Data in Database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkExpenses() {
  try {
    console.log('🔍 Checking Expense Data in Database...\n');
    
    const connectionString = process.env.MONGODB_URI;
    await mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB Atlas\n');
    await mongoose.connection.asPromise();
    
    // Check transactionentries collection for expense accounts
    const transactionEntries = mongoose.connection.db.collection('transactionentries');
    
    console.log('📊 **EXPENSE ACCOUNTS ANALYSIS**\n');
    
    // Find all expense-related entries
    const expenseEntries = await transactionEntries.find({
      'entries.accountType': 'Expense'
    }).toArray();
    
    console.log(`📋 Found ${expenseEntries.length} expense-related entries`);
    
    if (expenseEntries.length > 0) {
      console.log('\n🔍 **Sample Expense Entries:**');
      expenseEntries.slice(0, 5).forEach((entry, index) => {
        console.log(`\n${index + 1}. **Transaction ID:** ${entry.transactionId}`);
        console.log(`   📅 Date: ${entry.date}`);
        console.log(`   📝 Description: ${entry.description}`);
        console.log(`   🏠 Residence: ${entry.metadata?.residenceId || 'N/A'}`);
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach((subEntry, subIndex) => {
            if (subEntry.accountType === 'Expense') {
              console.log(`   💸 Expense Entry ${subIndex + 1}:`);
              console.log(`      Account: ${subEntry.accountCode} - ${subEntry.accountName}`);
              console.log(`      Debit: $${subEntry.debit || 0}`);
              console.log(`      Credit: $${subEntry.credit || 0}`);
            }
          });
        }
      });
    }
    
    // Check for specific expense account codes
    console.log('\n🔍 **EXPENSE ACCOUNT CODES FOUND:**');
    const expenseAccountCodes = new Set();
    
    expenseEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(subEntry => {
          if (subEntry.accountType === 'Expense') {
            expenseAccountCodes.add(`${subEntry.accountCode} - ${subEntry.accountName}`);
          }
        });
      }
    });
    
    if (expenseAccountCodes.size > 0) {
      Array.from(expenseAccountCodes).forEach(code => {
        console.log(`   📊 ${code}`);
      });
    } else {
      console.log('   ❌ No expense account codes found');
    }
    
    // Check transactions collection for expense transactions
    console.log('\n🔍 **EXPENSE TRANSACTIONS:**');
    const transactions = mongoose.connection.db.collection('transactions');
    
    const expenseTransactions = await transactions.find({
      type: 'expense'
    }).toArray();
    
    console.log(`📋 Found ${expenseTransactions.length} expense transactions`);
    
    if (expenseTransactions.length > 0) {
      expenseTransactions.slice(0, 3).forEach((transaction, index) => {
        console.log(`\n${index + 1}. **Transaction:** ${transaction.transactionId}`);
        console.log(`   📅 Date: ${transaction.date}`);
        console.log(`   📝 Description: ${transaction.description}`);
        console.log(`   💰 Amount: $${transaction.amount}`);
        console.log(`   🏠 Residence: ${transaction.residence || 'N/A'}`);
      });
    }
    
    // Check for any entries with debit amounts (expenses)
    console.log('\n🔍 **DEBIT ENTRIES (POTENTIAL EXPENSES):**');
    const debitEntries = await transactionEntries.find({
      'entries.debit': { $gt: 0 }
    }).toArray();
    
    console.log(`📋 Found ${debitEntries.length} entries with debit amounts`);
    
    if (debitEntries.length > 0) {
      let totalDebits = 0;
      debitEntries.forEach(entry => {
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(subEntry => {
            if (subEntry.debit && subEntry.debit > 0) {
              totalDebits += subEntry.debit;
            }
          });
        }
      });
      console.log(`💰 Total Debit Amounts: $${totalDebits.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

if (require.main === module) {
  checkExpenses().catch(console.error);
}

module.exports = { checkExpenses };
