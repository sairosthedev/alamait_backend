const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .then(() => console.log('📊 Fetching ALL Transaction Entries...'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function showAllTransactionEntries() {
  try {
    console.log('\n📊 ALL TRANSACTION ENTRIES - COMPLETE TABLE');
    console.log('=============================================\n');
    
    const now = new Date();
    
    // Get ALL transaction entries
    const allEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    }).sort({ date: -1 }); // Most recent first
    
    console.log(`Total Transaction Entries Found: ${allEntries.length}\n`);
    
    if (allEntries.length === 0) {
      console.log('❌ No transaction entries found');
      return;
    }
    
    // ========================================
    // CREATE COMPREHENSIVE TABLE
    // ========================================
    
    // Table header
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ #  │ Date       │ Source           │ Description                                    │ Account Code │ Account Name        │ Debit      │ Credit     │ Cash Flow │');
    console.log('├────┼────────────┼──────────────────┼────────────────────────────────────────────────┼──────────────┼─────────────────────┼────────────┼────────────┼───────────┤');
    
    let totalDebits = 0;
    let totalCredits = 0;
    let cashInflows = 0;
    let cashOutflows = 0;
    
    allEntries.forEach((tx, idx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIdx) => {
          const entryNumber = `${idx + 1}.${entryIdx + 1}`;
          const date = tx.date.toLocaleDateString();
          const source = (tx.source || 'Unknown').padEnd(16);
          const description = (tx.description || 'No description').substring(0, 40).padEnd(40);
          const accountCode = (entry.accountCode || 'N/A').padEnd(12);
          const accountName = (entry.accountName || 'Unknown').substring(0, 19).padEnd(19);
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          // Determine if this is a cash account
          const isCashAccount = ['1001', '1002', '1011'].includes(entry.accountCode);
          
          // Determine cash flow direction
          let cashFlow = '';
          if (isCashAccount) {
            if (debit > 0) {
              cashFlow = 'OUTFLOW 🔴';
              cashOutflows += debit;
            } else if (credit > 0) {
              cashFlow = 'INFLOW 🟢';
              cashInflows += credit;
            }
          } else {
            cashFlow = 'N/A';
          }
          
          totalDebits += debit;
          totalCredits += credit;
          
          // Format amounts
          const debitStr = debit > 0 ? `$${debit.toFixed(2)}` : '';
          const creditStr = credit > 0 ? `$${credit.toFixed(2)}` : '';
          
          console.log(`│ ${entryNumber.padEnd(3)} │ ${date.padEnd(10)} │ ${source} │ ${description} │ ${accountCode} │ ${accountName} │ ${debitStr.padEnd(10)} │ ${creditStr.padEnd(10)} │ ${cashFlow.padEnd(9)} │`);
        });
      }
    });
    
    // Table footer
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');
    
    // ========================================
    // SUMMARY STATISTICS
    // ========================================
    console.log('\n📊 TRANSACTION SUMMARY STATISTICS');
    console.log('==================================');
    console.log(`Total Transaction Entries: ${allEntries.length}`);
    console.log(`Total Debits:  $${totalDebits.toFixed(2)}`);
    console.log(`Total Credits: $${totalCredits.toFixed(2)}`);
    console.log(`Balance Check: ${totalDebits === totalCredits ? '✅ BALANCED' : '❌ UNBALANCED'}`);
    
    console.log('\n💰 CASH FLOW ANALYSIS');
    console.log('=====================');
    console.log(`Cash Inflows:  $${cashInflows.toFixed(2)} 🟢`);
    console.log(`Cash Outflows: $${cashOutflows.toFixed(2)} 🔴`);
    console.log(`Net Cash Flow: $${(cashInflows - cashOutflows).toFixed(2)}`);
    
    // ========================================
    // CASH ACCOUNT BREAKDOWN
    // ========================================
    console.log('\n🏦 CASH ACCOUNT BREAKDOWN');
    console.log('==========================');
    
    const cashAccounts = {};
    allEntries.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (['1001', '1002', '1011'].includes(entry.accountCode)) {
            const accountKey = `${entry.accountCode} - ${entry.accountName}`;
            if (!cashAccounts[accountKey]) {
              cashAccounts[accountKey] = { debits: 0, credits: 0, net: 0 };
            }
            cashAccounts[accountKey].debits += entry.debit || 0;
            cashAccounts[accountKey].credits += entry.credit || 0;
            cashAccounts[accountKey].net = cashAccounts[accountKey].credits - cashAccounts[accountKey].debits;
          }
        });
      }
    });
    
    Object.entries(cashAccounts).forEach(([account, data]) => {
      console.log(`${account}:`);
      console.log(`  Debits:  $${data.debits.toFixed(2)} (money going OUT)`);
      console.log(`  Credits: $${data.credits.toFixed(2)} (money coming IN)`);
      console.log(`  Net:     $${data.net.toFixed(2)} ${data.net >= 0 ? '🟢' : '🔴'}`);
    });
    
    // ========================================
    // SOURCE TYPE ANALYSIS
    // ========================================
    console.log('\n📋 SOURCE TYPE ANALYSIS');
    console.log('========================');
    
    const sourceAnalysis = {};
    allEntries.forEach(tx => {
      const source = tx.source || 'Unknown';
      if (!sourceAnalysis[source]) {
        sourceAnalysis[source] = { count: 0, totalDebit: 0, totalCredit: 0 };
      }
      sourceAnalysis[source].count += 1;
      
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          sourceAnalysis[source].totalDebit += entry.debit || 0;
          sourceAnalysis[source].totalCredit += entry.credit || 0;
        });
      }
    });
    
    Object.entries(sourceAnalysis).forEach(([source, data]) => {
      console.log(`${source.toUpperCase()}:`);
      console.log(`  Count: ${data.count} transactions`);
      console.log(`  Total Debit:  $${data.totalDebit.toFixed(2)}`);
      console.log(`  Total Credit: $${data.totalCredit.toFixed(2)}`);
      console.log(`  Net:          $${(data.totalCredit - data.totalDebit).toFixed(2)}`);
    });
    
    console.log('\n✅ Complete transaction analysis finished!');
    
  } catch (error) {
    console.error('❌ Error showing transaction entries:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
showAllTransactionEntries();
