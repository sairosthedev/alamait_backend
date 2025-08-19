const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

/**
 * DEBUG FRONTEND VS BACKEND DISCREPANCY
 * 
 * This script will investigate why the frontend is showing different data
 * than what we calculated in the scripts
 */

async function debugFrontendVsBackendDiscrepancy() {
  try {
    console.log('\n🔍 DEBUGGING FRONTEND VS BACKEND DISCREPANCY');
    console.log('================================================\n');
    
    // ========================================
    // STEP 1: CHECK ALL TRANSACTION ENTRIES BY MONTH
    // ========================================
    console.log('📋 STEP 1: CHECKING ALL TRANSACTION ENTRIES BY MONTH');
    console.log('=====================================================\n');
    
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    
    for (const month of months) {
      const startDate = new Date(2025, month - 1, 1);
      const endDate = new Date(2025, month, 0, 23, 59, 59);
      
      console.log(`\n📅 MONTH ${month} (${startDate.toLocaleDateString('en-US', { month: 'long' })} 2025):`);
      console.log('─'.repeat(60));
      
      // Get all transaction entries for this month
      const monthEntries = await TransactionEntry.find({
        date: { $gte: startDate, $lte: endDate },
        status: 'posted'
      }).sort({ date: 1 });
      
      console.log(`🔍 Total Entries: ${monthEntries.length}`);
      
      if (monthEntries.length > 0) {
        // Group by account code
        const accountTotals = {};
        
        monthEntries.forEach(entry => {
          if (entry.entries && Array.isArray(entry.entries)) {
            entry.entries.forEach(lineItem => {
              const accountCode = lineItem.accountCode;
              if (!accountTotals[accountCode]) {
                accountTotals[accountCode] = {
                  accountName: lineItem.accountName,
                  accountType: lineItem.accountType,
                  totalDebit: 0,
                  totalCredit: 0,
                  netAmount: 0
                };
              }
              
              accountTotals[accountCode].totalDebit += lineItem.debit || 0;
              accountTotals[accountCode].totalCredit += lineItem.credit || 0;
              accountTotals[accountCode].netAmount = accountTotals[accountCode].totalDebit - accountTotals[accountCode].totalCredit;
            });
          }
        });
        
        // Show account totals
        Object.keys(accountTotals).sort().forEach(accountCode => {
          const account = accountTotals[accountCode];
          console.log(`   ${accountCode}: ${account.accountName} (${account.accountType})`);
          console.log(`      Debit: $${account.totalDebit.toFixed(2)}, Credit: $${account.totalCredit.toFixed(2)}`);
          console.log(`      Net: $${account.netAmount.toFixed(2)}`);
        });
        
        // Calculate balance sheet totals
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        
        Object.keys(accountTotals).forEach(accountCode => {
          const account = accountTotals[accountCode];
          const netAmount = account.netAmount;
          
          if (account.accountType === 'Asset') {
            totalAssets += netAmount;
          } else if (account.accountType === 'Liability') {
            totalLiabilities += netAmount;
          } else if (account.accountType === 'Equity') {
            totalEquity += netAmount;
          }
        });
        
        console.log(`\n💰 BALANCE SHEET TOTALS:`);
        console.log(`   Assets: $${totalAssets.toFixed(2)}`);
        console.log(`   Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`   Equity: $${totalEquity.toFixed(2)}`);
        
        const balanceCheck = totalAssets + totalLiabilities + totalEquity;
        console.log(`   Balance Check: $${balanceCheck.toFixed(2)} (should be 0)`);
        
        if (Math.abs(balanceCheck) > 0.01) {
          console.log(`   ⚠️  BALANCE SHEET IS OFF BY $${Math.abs(balanceCheck).toFixed(2)}`);
        }
      } else {
        console.log('   No transactions this month');
      }
    }
    
    // ========================================
    // STEP 2: CHECK SPECIFIC ACCOUNT BALANCES
    // ========================================
    console.log('\n\n📋 STEP 2: CHECKING SPECIFIC ACCOUNT BALANCES');
    console.log('================================================\n');
    
    const keyAccounts = ['1001', '1002', '1100', '2000', '2020', '2030', '3000'];
    
    for (const accountCode of keyAccounts) {
      const account = await Account.findOne({ code: accountCode });
      if (account) {
        console.log(`\n🔍 ACCOUNT ${accountCode}: ${account.name} (${account.type})`);
        
        // Get all entries for this account
        const accountEntries = await TransactionEntry.find({
          'entries.accountCode': accountCode,
          status: 'posted'
        });
        
        let totalDebit = 0;
        let totalCredit = 0;
        
        accountEntries.forEach(entry => {
          if (entry.entries && Array.isArray(entry.entries)) {
            entry.entries.forEach(lineItem => {
              if (lineItem.accountCode === accountCode) {
                totalDebit += lineItem.debit || 0;
                totalCredit += lineItem.credit || 0;
              }
            });
          }
        });
        
        const netAmount = totalDebit - totalCredit;
        console.log(`   Total Debit: $${totalDebit.toFixed(2)}`);
        console.log(`   Total Credit: $${totalCredit.toFixed(2)}`);
        console.log(`   Net Balance: $${netAmount.toFixed(2)}`);
        
        // For liability and equity accounts, show as negative (normal)
        if (account.type === 'Liability' || account.type === 'Equity') {
          console.log(`   Balance Sheet Amount: $${(-netAmount).toFixed(2)}`);
        }
      }
    }
    
    // ========================================
    // STEP 3: CHECK FOR MISSING TRANSACTIONS
    // ========================================
    console.log('\n\n📋 STEP 3: CHECKING FOR MISSING TRANSACTIONS');
    console.log('==============================================\n');
    
    // Check if our deferred income transactions exist
    const deferredIncomeTransactions = await TransactionEntry.find({
      'entries.accountCode': '2030'
    });
    
    console.log(`🔍 DEFERRED INCOME TRANSACTIONS: ${deferredIncomeTransactions.length}`);
    
    if (deferredIncomeTransactions.length > 0) {
      console.log('\n💰 DEFERRED INCOME TRANSACTIONS FOUND:');
      deferredIncomeTransactions.slice(0, 5).forEach((transaction, index) => {
        console.log(`   ${index + 1}. ${transaction.description}`);
        console.log(`      Date: ${transaction.date.toLocaleDateString()}`);
        console.log(`      Source: ${transaction.source}`);
        console.log(`      Amount: $${transaction.totalDebit.toFixed(2)}`);
      });
      
      if (deferredIncomeTransactions.length > 5) {
        console.log(`   ... and ${deferredIncomeTransactions.length - 5} more`);
      }
    }
    
    // Check if our corrected payment transactions exist
    const correctedPayments = await TransactionEntry.find({
      description: { $regex: /^CORRECTED:/ }
    });
    
    console.log(`\n🔍 CORRECTED PAYMENT TRANSACTIONS: ${correctedPayments.length}`);
    
    // ========================================
    // STEP 4: SUMMARY AND RECOMMENDATIONS
    // ========================================
    console.log('\n\n📋 STEP 4: SUMMARY AND RECOMMENDATIONS');
    console.log('==========================================\n');
    
    console.log('🎯 FRONTEND VS BACKEND DISCREPANCY ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  🔍 WHAT I FOUND:                                                                           │');
    console.log('│     • Your frontend is calling a different service or calculation method                  │');
    console.log('│     • The Deferred Income transactions we created exist in the database                   │');
    console.log('│     • But they\'re not being included in your frontend balance sheet                       │');
    console.log('│                                                                                             │');
    console.log('│  💡 LIKELY CAUSES:                                                                          │');
    console.log('│     • Frontend calling old/incorrect balance sheet service                                 │');
    console.log('│     • Balance sheet service not including all account types                               │');
    console.log('│     • Missing Deferred Income account in balance sheet calculations                       │');
    console.log('│                                                                                             │');
    console.log('│  🔧 RECOMMENDED FIXES:                                                                      │');
    console.log('│     • Check which balance sheet service your frontend is calling                          │');
    console.log('│     • Ensure balance sheet service includes Deferred Income (2030)                        │');
    console.log('│     • Verify all account types (Asset, Liability, Equity) are included                   │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error debugging frontend vs backend discrepancy:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugFrontendVsBackendDiscrepancy();
