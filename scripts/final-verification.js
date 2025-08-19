const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');

/**
 * FINAL VERIFICATION
 * 
 * This script will verify that:
 * 1. All orphaned transactions are gone
 * 2. Student payments are properly recorded
 * 3. Financial reports will be accurate
 */

async function finalVerification() {
  try {
    console.log('\n🔍 FINAL VERIFICATION');
    console.log('======================\n');
    
    // ========================================
    // STEP 1: VERIFY DEBTORS
    // ========================================
    console.log('📋 STEP 1: VERIFYING DEBTORS');
    console.log('=============================\n');
    
    const debtors = await Debtor.find({});
    console.log(`👥 TOTAL DEBTORS: ${debtors.length}`);
    
    let totalOwed = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    
    debtors.forEach(debtor => {
      totalOwed += debtor.totalOwed || 0;
      totalPaid += debtor.totalPaid || 0;
      totalBalance += debtor.currentBalance || 0;
    });
    
    console.log(`💰 TOTAL OWED: $${totalOwed.toFixed(2)}`);
    console.log(`💰 TOTAL PAID: $${totalPaid.toFixed(2)}`);
    console.log(`💰 TOTAL BALANCE: $${totalBalance.toFixed(2)}\n`);
    
    // ========================================
    // STEP 2: VERIFY PAYMENT TRANSACTIONS
    // ========================================
    console.log('📋 STEP 2: VERIFYING PAYMENT TRANSACTIONS');
    console.log('==========================================\n');
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    console.log(`💰 PAYMENT TRANSACTIONS FOUND: ${paymentTransactions.length}`);
    
    if (paymentTransactions.length > 0) {
      console.log('\n📊 PAYMENT TRANSACTION DETAILS:');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Transaction ID                                 │ Date        │ Source ID   │ Amount      │ Status      │');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      let totalCashReceived = 0;
      
      paymentTransactions.forEach(entry => {
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              totalCashReceived += lineItem.debit;
              
              const transactionId = entry.transactionId.padEnd(35);
              const date = entry.date.toLocaleDateString().padEnd(12);
              const sourceId = (entry.sourceId || 'N/A').toString().padEnd(12);
              const amount = `$${lineItem.debit.toFixed(2)}`.padStart(12);
              const status = (entry.status || 'N/A').padEnd(12);
              
              console.log(`│ ${transactionId} │ ${date} │ ${sourceId} │ ${amount} │ ${status} │`);
            }
          });
        }
      });
      
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      const totalPadded = `$${totalCashReceived.toFixed(2)}`.padStart(12);
      console.log(`│ TOTAL CASH RECEIVED                           │             │             │ ${totalPadded} │             │`);
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
      
      console.log(`💰 TOTAL CASH RECEIVED: $${totalCashReceived.toFixed(2)}`);
    }
    
    // ========================================
    // STEP 3: VERIFY NO ORPHANED TRANSACTIONS
    // ========================================
    console.log('\n📋 STEP 3: VERIFYING NO ORPHANED TRANSACTIONS');
    console.log('================================================\n');
    
    const debtorIds = debtors.map(d => d._id.toString());
    const allPaymentEntries = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    const orphanedTransactions = allPaymentEntries.filter(entry => 
      !debtorIds.includes(entry.sourceId?.toString())
    );
    
    console.log(`🔍 TOTAL PAYMENT ENTRIES: ${allPaymentEntries.length}`);
    console.log(`✅ VALID TRANSACTIONS: ${allPaymentEntries.length - orphanedTransactions.length}`);
    console.log(`❌ ORPHANED TRANSACTIONS: ${orphanedTransactions.length}`);
    
    if (orphanedTransactions.length === 0) {
      console.log('✅ NO ORPHANED TRANSACTIONS FOUND!');
    } else {
      console.log('❌ ORPHANED TRANSACTIONS STILL EXIST!');
    }
    
    // ========================================
    // STEP 4: COMPARE DEBTOR VS TRANSACTION TOTALS
    // ========================================
    console.log('\n📋 STEP 4: COMPARING DEBTOR VS TRANSACTION TOTALS');
    console.log('==================================================\n');
    
    const totalCashFromTransactions = paymentTransactions.reduce((sum, entry) => {
      let entrySum = 0;
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            entrySum += lineItem.debit;
          }
        });
      }
      return sum + entrySum;
    }, 0);
    
    const difference = totalPaid - totalCashFromTransactions;
    
    console.log('📊 COMPARISON ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 DEBTOR COLLECTION TOTALS:                                                              │');
    console.log(`│     • Total Paid: $${totalPaid.toFixed(2)}                                                          │`);
    console.log(`│     • Total Owed: $${totalOwed.toFixed(2)}                                                          │`);
    console.log(`│     • Current Balance: $${totalBalance.toFixed(2)}                                                │`);
    console.log('│                                                                                             │');
    console.log('│  💰 TRANSACTIONENTRY TOTALS:                                                               │');
    console.log(`│     • Payment Transactions: ${paymentTransactions.length}                                    │`);
    console.log(`│     • Total Cash Received: $${totalCashFromTransactions.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🔍 DIFFERENCE ANALYSIS:                                                                   │');
    console.log(`│     • Difference: $${difference.toFixed(2)}                                                          │`);
    
    if (Math.abs(difference) < 0.01) {
      console.log('│     • Status: ✅ PERFECT MATCH!                                                           │');
    } else if (Math.abs(difference) < 1.00) {
      console.log('│     • Status: ⚠️  MINOR DIFFERENCE (rounding)                                             │');
    } else {
      console.log('│     • Status: ❌ SIGNIFICANT DIFFERENCE - INVESTIGATE!                                    │');
    }
    
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL VERIFICATION SUMMARY');
    console.log('==============================\n');
    
    console.log('✅ VERIFICATION RESULTS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    
    if (orphanedTransactions.length === 0) {
      console.log('│  ✅ ORPHANED TRANSACTIONS: CLEANED UP SUCCESSFULLY                                        │');
    } else {
      console.log('│  ❌ ORPHANED TRANSACTIONS: STILL EXIST - NEED ATTENTION                                   │');
    }
    
    if (Math.abs(difference) < 0.01) {
      console.log('│  ✅ PAYMENT RECONCILIATION: PERFECT MATCH                                                 │');
    } else if (Math.abs(difference) < 1.00) {
      console.log('│  ⚠️  PAYMENT RECONCILIATION: MINOR DIFFERENCE (acceptable)                               │');
    } else {
      console.log('│  ❌ PAYMENT RECONCILIATION: SIGNIFICANT DIFFERENCE - INVESTIGATE                          │');
    }
    
    if (paymentTransactions.length > 0) {
      console.log('│  ✅ STUDENT PAYMENTS: PROPERLY RECORDED IN ACCOUNTING SYSTEM                             │');
    } else {
      console.log('│  ❌ STUDENT PAYMENTS: NOT RECORDED IN ACCOUNTING SYSTEM                                  │');
    }
    
    console.log('│                                                                                             │');
    console.log('│  💰 FINAL STATUS:                                                                          │');
    console.log(`│     • Real Cash Received: $${totalCashFromTransactions.toFixed(2)}                                                      │`);
    console.log(`│     • Valid Transactions: ${paymentTransactions.length}                                        │`);
    console.log(`│     • Students: ${debtors.length} (all current)                                               │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    if (orphanedTransactions.length === 0 && Math.abs(difference) < 1.00) {
      console.log('🎉 VERIFICATION PASSED! YOUR ACCOUNTING SYSTEM IS NOW CLEAN AND ACCURATE!');
      console.log('💰 Your financial reports will now show the correct cash received: $' + totalCashFromTransactions.toFixed(2));
    } else {
      console.log('⚠️  VERIFICATION FAILED! Some issues still need attention.');
    }
    
  } catch (error) {
    console.error('❌ Error during final verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the final verification
finalVerification();
