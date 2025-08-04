const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');

async function showRecentTransactions() {
  try {
    console.log('📊 Fetching Recent Transactions...\n');
    
    const transactions = await TransactionEntry.find({})
      .sort({ date: -1 })
      .limit(10);
    
    console.log(`Found ${transactions.length} recent transactions:\n`);
    console.log('=' .repeat(80));
    
    transactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction.transactionId}`);
      console.log(`   Date: ${transaction.date.toLocaleDateString()} ${transaction.date.toLocaleTimeString()}`);
      console.log(`   Description: ${transaction.description}`);
      console.log(`   Reference: ${transaction.reference || 'N/A'}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Source: ${transaction.source}`);
      console.log(`   Total Amount: $${transaction.totalDebit.toFixed(2)}`);
      
      console.log('   Entries:');
      transaction.entries.forEach((entry, entryIndex) => {
        const amount = entry.debit > 0 ? entry.debit : entry.credit;
        const type = entry.debit > 0 ? 'DR' : 'CR';
        console.log(`     ${entryIndex + 1}. ${entry.accountName} (${entry.accountType})`);
        console.log(`        ${type} $${amount.toFixed(2)} - ${entry.description}`);
      });
      
      console.log('   ' + '-'.repeat(60));
    });
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('=' .repeat(80));
    
    const totalIncome = transactions.reduce((sum, tx) => {
      return sum + tx.entries.reduce((entrySum, entry) => {
        if (entry.accountType === 'Income' && entry.credit > 0) {
          return entrySum + entry.credit;
        }
        return entrySum;
      }, 0);
    }, 0);
    
    const totalExpenses = transactions.reduce((sum, tx) => {
      return sum + tx.entries.reduce((entrySum, entry) => {
        if (entry.accountType === 'Expense' && entry.debit > 0) {
          return entrySum + entry.debit;
        }
        return entrySum;
      }, 0);
    }, 0);
    
    console.log(`Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`Net Cash Flow: $${(totalIncome - totalExpenses).toFixed(2)}`);
    
    // Account type breakdown
    const accountTypes = {};
    transactions.forEach(tx => {
      tx.entries.forEach(entry => {
        const type = entry.accountType || 'Unknown';
        accountTypes[type] = (accountTypes[type] || 0) + 1;
      });
    });
    
    console.log('\nAccount Types:');
    Object.entries(accountTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} entries`);
    });
    
  } catch (error) {
    console.error('❌ Error fetching recent transactions:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

showRecentTransactions(); 