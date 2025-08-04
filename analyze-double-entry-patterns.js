const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');

async function analyzeDoubleEntryPatterns() {
  try {
    console.log('🔍 Analyzing double-entry accounting patterns...');
    
    const transactions = await TransactionEntry.find({}).sort({ date: -1 });
    console.log(`📊 Found ${transactions.length} transactions to analyze`);
    
    let properDoubleEntryCount = 0;
    let improperDoubleEntryCount = 0;
    
    console.log('\n📋 Analyzing each transaction:');
    console.log('=' .repeat(80));
    
    transactions.slice(0, 10).forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction: ${transaction.description}`);
      console.log(`   Date: ${transaction.date}`);
      console.log(`   Total Debit: ${transaction.totalDebit}, Total Credit: ${transaction.totalCredit}`);
      
      const entries = transaction.entries || [];
      let totalDebit = 0;
      let totalCredit = 0;
      
      console.log('   Entries:');
      entries.forEach((entry, entryIndex) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        totalDebit += debit;
        totalCredit += credit;
        
        console.log(`     ${entryIndex + 1}. ${entry.accountName} (${entry.accountType})`);
        console.log(`        Debit: ${debit}, Credit: ${credit}`);
      });
      
      // Check if debits equal credits
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01; // Allow for small rounding differences
      
      if (isBalanced) {
        console.log(`   ✅ BALANCED: Debits (${totalDebit}) = Credits (${totalCredit})`);
        properDoubleEntryCount++;
      } else {
        console.log(`   ❌ UNBALANCED: Debits (${totalDebit}) ≠ Credits (${totalCredit})`);
        improperDoubleEntryCount++;
      }
      
      // Analyze account type patterns
      const accountTypes = entries.map(e => e.accountType);
      const uniqueTypes = [...new Set(accountTypes)];
      console.log(`   Account Types: ${uniqueTypes.join(', ')}`);
      
      // Check for proper double-entry patterns
      if (entries.length >= 2) {
        const hasDebit = entries.some(e => (e.debit || 0) > 0);
        const hasCredit = entries.some(e => (e.credit || 0) > 0);
        
        if (hasDebit && hasCredit) {
          console.log(`   ✅ PROPER PATTERN: Has both debit and credit entries`);
        } else {
          console.log(`   ⚠️  INCOMPLETE PATTERN: Missing ${!hasDebit ? 'debit' : ''} ${!hasCredit ? 'credit' : ''} entries`);
        }
      }
    });
    
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SUMMARY:');
    console.log(`   Proper double-entry transactions: ${properDoubleEntryCount}`);
    console.log(`   Improper double-entry transactions: ${improperDoubleEntryCount}`);
    console.log(`   Total analyzed: ${properDoubleEntryCount + improperDoubleEntryCount}`);
    
    // Analyze account type distribution
    console.log('\n📊 Account Type Analysis:');
    const allEntries = transactions.flatMap(t => t.entries || []);
    const typeCounts = {};
    
    allEntries.forEach(entry => {
      const type = entry.accountType || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} entries`);
    });
    
    // Check for maintenance/expense patterns
    console.log('\n🔍 Looking for maintenance/expense patterns:');
    const maintenanceTransactions = transactions.filter(t => 
      t.description && t.description.toLowerCase().includes('maintenance')
    );
    
    console.log(`   Maintenance transactions found: ${maintenanceTransactions.length}`);
    
    maintenanceTransactions.forEach((transaction, index) => {
      console.log(`   ${index + 1}. ${transaction.description}`);
      const entries = transaction.entries || [];
      entries.forEach((entry, entryIndex) => {
        console.log(`      ${entryIndex + 1}. ${entry.accountName} (${entry.accountType}) - Debit: ${entry.debit}, Credit: ${entry.credit}`);
      });
    });
    
    // Check for payment patterns
    console.log('\n🔍 Looking for payment patterns:');
    const paymentTransactions = transactions.filter(t => 
      t.description && t.description.toLowerCase().includes('payment')
    );
    
    console.log(`   Payment transactions found: ${paymentTransactions.length}`);
    
    paymentTransactions.slice(0, 3).forEach((transaction, index) => {
      console.log(`   ${index + 1}. ${transaction.description}`);
      const entries = transaction.entries || [];
      entries.forEach((entry, entryIndex) => {
        console.log(`      ${entryIndex + 1}. ${entry.accountName} (${entry.accountType}) - Debit: ${entry.debit}, Credit: ${entry.credit}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

analyzeDoubleEntryPatterns(); 