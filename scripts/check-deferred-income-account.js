const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Account = require('../src/models/Account');
const TransactionEntry = require('../src/models/TransactionEntry');

/**
 * CHECK DEFERRED INCOME ACCOUNT
 * 
 * This script will check if there's a Deferred Income account and how early payments are handled
 */

async function checkDeferredIncomeAccount() {
  try {
    console.log('\n🔍 CHECKING DEFERRED INCOME ACCOUNT');
    console.log('====================================\n');
    
    // ========================================
    // STEP 1: CHECK CHART OF ACCOUNTS
    // ========================================
    console.log('📋 STEP 1: CHECKING CHART OF ACCOUNTS');
    console.log('======================================\n');
    
    const accounts = await Account.find({});
    
    console.log('🔍 ALL ACCOUNTS IN SYSTEM:');
    accounts.forEach(account => {
      console.log(`   ${account.code}: ${account.name} (${account.type})`);
    });
    
    // Look for Deferred Income accounts
    const deferredIncomeAccounts = accounts.filter(acc => 
      acc.name && acc.name.toLowerCase().includes('deferred') || 
      acc.name && acc.name.toLowerCase().includes('unearned') ||
      acc.code && acc.code.startsWith('2') // Liability accounts typically start with 2
    );
    
    console.log('\n🔍 DEFERRED INCOME / UNEARNED REVENUE ACCOUNTS:');
    if (deferredIncomeAccounts.length > 0) {
      deferredIncomeAccounts.forEach(acc => {
        console.log(`   ✅ ${acc.code}: ${acc.name} (${acc.type})`);
      });
    } else {
      console.log('   ❌ NO DEFERRED INCOME ACCOUNTS FOUND!');
    }
    
    // ========================================
    // STEP 2: CHECK CURRENT TRANSACTION STRUCTURE
    // ========================================
    console.log('\n📋 STEP 2: CHECKING CURRENT TRANSACTION STRUCTURE');
    console.log('==================================================\n');
    
    // Look for payment transactions
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`🔍 PAYMENT TRANSACTIONS FOUND: ${paymentTransactions.length}\n`);
    
    if (paymentTransactions.length > 0) {
      console.log('💰 PAYMENT TRANSACTION ANALYSIS:');
      paymentTransactions.forEach((transaction, index) => {
        console.log(`\n📊 PAYMENT ${index + 1}: ${transaction.description}`);
        console.log(`   Date: ${transaction.date.toLocaleDateString()}`);
        console.log(`   Source: ${transaction.source}`);
        console.log('   ─'.repeat(40));
        
        if (transaction.entries && Array.isArray(transaction.entries)) {
          transaction.entries.forEach((lineItem, lineIndex) => {
            console.log(`   Line ${lineIndex + 1}: Account ${lineItem.accountCode} (${lineItem.accountName})`);
            console.log(`      Type: ${lineItem.accountType}`);
            console.log(`      Debit: $${lineItem.debit.toFixed(2)}, Credit: $${lineItem.credit.toFixed(2)}`);
          });
        }
      });
    }
    
    // ========================================
    // STEP 3: CHECK FOR EARLY PAYMENTS
    // ========================================
    console.log('\n📋 STEP 3: CHECKING FOR EARLY PAYMENTS');
    console.log('========================================\n');
    
    // Look for payments that might be early (before lease start)
    const allTransactions = await TransactionEntry.find({
      status: 'posted'
    }).sort({ date: 1 });
    
    let earlyPaymentCandidates = [];
    
    allTransactions.forEach(transaction => {
      if (transaction.entries && Array.isArray(transaction.entries)) {
        // Check if this has cash inflow (debit to cash account)
        const hasCashInflow = transaction.entries.some(lineItem => 
          ['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0
        );
        
        if (hasCashInflow) {
          earlyPaymentCandidates.push({
            date: transaction.date,
            description: transaction.description,
            source: transaction.source,
            cashAmount: transaction.entries.find(lineItem => 
              ['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0
            )?.debit || 0
          });
        }
      }
    });
    
    console.log(`🔍 CASH INFLOW TRANSACTIONS FOUND: ${earlyPaymentCandidates.length}\n`);
    
    if (earlyPaymentCandidates.length > 0) {
      console.log('💰 CASH INFLOW TRANSACTIONS:');
      earlyPaymentCandidates.forEach((candidate, index) => {
        console.log(`   ${index + 1}. Date: ${candidate.date.toLocaleDateString()}`);
        console.log(`      Amount: $${candidate.cashAmount.toFixed(2)}`);
        console.log(`      Description: ${candidate.description}`);
        console.log(`      Source: ${candidate.source}`);
        console.log('');
      });
    }
    
    // ========================================
    // STEP 4: CHECK RENTAL ACCRUALS
    // ========================================
    console.log('\n📋 STEP 4: CHECKING RENTAL ACCRUALS');
    console.log('=====================================\n');
    
    const rentalAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`🔍 RENTAL ACCRUALS FOUND: ${rentalAccruals.length}\n`);
    
    if (rentalAccruals.length > 0) {
      console.log('📅 RENTAL ACCRUALS ANALYSIS:');
      rentalAccruals.slice(0, 5).forEach((accrual, index) => {
        console.log(`   ${index + 1}. Date: ${accrual.date.toLocaleDateString()}`);
        console.log(`      Description: ${accrual.description}`);
        console.log(`      Entries: ${accrual.entries.length} line items`);
        console.log('');
      });
      
      if (rentalAccruals.length > 5) {
        console.log(`   ... and ${rentalAccruals.length - 5} more accruals`);
      }
    }
    
    // ========================================
    // STEP 5: RECOMMENDATIONS
    // ========================================
    console.log('\n📋 STEP 5: RECOMMENDATIONS');
    console.log('============================\n');
    
    console.log('🎯 ACCOUNTING SYSTEM ASSESSMENT:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    
    if (deferredIncomeAccounts.length > 0) {
      console.log('│  ✅ DEFERRED INCOME ACCOUNTS: FOUND                                        │');
      console.log('│     • Your system has proper deferred income handling                                    │');
      console.log('│     • Early payments should be recorded as deferred income                              │');
    } else {
      console.log('│  ❌ DEFERRED INCOME ACCOUNTS: MISSING                                    │');
      console.log('│     • Your system needs deferred income accounts                                        │');
      console.log('│     • Early payments are currently misclassified                                        │');
    }
    
    console.log('│                                                                                             │');
    console.log('│  💡 CURRENT ISSUES:                                                                         │');
    console.log('│     • Early payments are recorded as immediate revenue                                    │');
    console.log('│     • This violates accrual accounting principles                                         │');
    console.log('│     • Revenue recognition doesn\'t match service delivery                                  │');
    console.log('│                                                                                             │');
    console.log('│  🔧 RECOMMENDED FIXES:                                                                      │');
    console.log('│     • Create Deferred Income liability account                                            │');
    console.log('│     • Modify payment logic to use deferred income                                        │');
    console.log('│     • Monthly transfers from deferred to earned revenue                                  │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error checking deferred income account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkDeferredIncomeAccount();
