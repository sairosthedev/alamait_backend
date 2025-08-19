const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function debugTransactionSources() {
  try {
    console.log('\n🔍 DEBUGGING TRANSACTION ENTRY SOURCES');
    console.log('========================================\n');
    
    const now = new Date();
    
    // Get all transaction entries
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    console.log(`📊 Total TransactionEntries found: ${transactionEntries.length}\n`);
    
    // Analyze all sources and their descriptions
    const sourceAnalysis = {};
    
    transactionEntries.forEach((tx, idx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          const source = tx.source;
          const description = tx.description;
          
          if (!sourceAnalysis[source]) {
            sourceAnalysis[source] = {
              count: 0,
              totalDebit: 0,
              totalCredit: 0,
              cashAccounts: {},
              descriptions: [],
              examples: []
            };
          }
          
          sourceAnalysis[source].count += 1;
          sourceAnalysis[source].totalDebit += debit;
          sourceAnalysis[source].totalCredit += credit;
          
          // Track cash account movements
          if (isCashAccount(accountCode)) {
            const key = `${accountCode} - ${accountName}`;
            if (!sourceAnalysis[source].cashAccounts[key]) {
              sourceAnalysis[source].cashAccounts[key] = { debit: 0, credit: 0 };
            }
            sourceAnalysis[source].cashAccounts[key].debit += debit;
            sourceAnalysis[source].cashAccounts[key].credit += credit;
          }
          
          // Track descriptions
          if (!sourceAnalysis[source].descriptions.includes(description)) {
            sourceAnalysis[source].descriptions.push(description);
          }
          
          // Keep examples
          if (sourceAnalysis[source].examples.length < 3) {
            sourceAnalysis[source].examples.push({
              description,
              accountCode,
              accountName,
              debit,
              credit,
              date: tx.date
            });
          }
        });
      }
    });
    
    console.log('📋 SOURCE TYPE ANALYSIS:\n');
    Object.entries(sourceAnalysis).forEach(([source, data]) => {
      console.log(`🔸 SOURCE: ${source.toUpperCase()}`);
      console.log(`   Count: ${data.count} transactions`);
      console.log(`   Total Debit: $${data.totalDebit.toFixed(2)}`);
      console.log(`   Total Credit: $${data.totalCredit.toFixed(2)}`);
      
      if (Object.keys(data.cashAccounts).length > 0) {
        console.log(`   💰 Cash Account Movements:`);
        Object.entries(data.cashAccounts).forEach(([account, amounts]) => {
          console.log(`      ${account}: Debit $${amounts.debit.toFixed(2)}, Credit $${amounts.credit.toFixed(2)}`);
        });
      }
      
      console.log(`   📝 Sample Descriptions:`);
      data.examples.forEach((ex, idx) => {
        console.log(`      ${idx + 1}. ${ex.description}`);
        console.log(`         Account: ${ex.accountCode} - ${ex.accountName}`);
        console.log(`         Debit: $${ex.debit.toFixed(2)}, Credit: $${ex.credit.toFixed(2)}`);
        console.log(`         Date: ${ex.date.toDateString()}`);
      });
      
      console.log('');
    });
    
    // Show specific examples of what should be cash inflows
    console.log('🎯 IDENTIFYING POTENTIAL CASH INFLOWS:\n');
    transactionEntries.forEach((tx, txIdx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          // Look for credits to cash accounts (potential inflows)
          if (credit > 0 && isCashAccount(accountCode)) {
            console.log(`💰 POTENTIAL CASH INFLOW:`);
            console.log(`   Account: ${accountCode} - ${accountName}`);
            console.log(`   Amount: $${credit.toFixed(2)}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Date: ${tx.date.toDateString()}`);
            console.log('');
          }
        });
      }
    });
    
    console.log('✅ Source analysis complete!');
    
  } catch (error) {
    console.error('❌ Error debugging sources:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper function to identify cash accounts
function isCashAccount(accountCode) {
  const cashAccounts = [
    '1001', // Bank Account
    '1002', // Cash on Hand
    '1011'  // Admin Petty Cash
  ];
  return cashAccounts.includes(accountCode);
}

// Run the debug analysis
debugTransactionSources();
