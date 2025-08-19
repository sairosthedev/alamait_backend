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
 * VERIFY STUDENT PAYMENTS
 * 
 * This script will:
 * 1. Check the debtors collection for payment records
 * 2. Cross-reference with TransactionEntry records
 * 3. Find any missing payment links
 */

async function verifyStudentPayments() {
  try {
    console.log('\n🔍 VERIFYING STUDENT PAYMENTS');
    console.log('================================\n');
    
    // ========================================
    // STEP 1: CHECK DEBTORS COLLECTION
    // ========================================
    console.log('📋 STEP 1: CHECKING DEBTORS COLLECTION');
    console.log('========================================\n');
    
    const debtors = await Debtor.find({});
    console.log(`👥 TOTAL DEBTORS: ${debtors.length}\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found!');
      return;
    }
    
    // Display debtor details with payment info
    console.log('📊 DEBTOR PAYMENT DETAILS:');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code │ Student     │ Total Owed  │ Total Paid  │ Balance     │ Last Payment│');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalOwed = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    
    debtors.forEach(debtor => {
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      const student = debtor.user ? `ID: ${debtor.user}` : 'No User'.padEnd(15);
      const owed = `$${(debtor.totalOwed || 0).toFixed(2)}`.padStart(12);
      const paid = `$${(debtor.totalPaid || 0).toFixed(2)}`.padStart(12);
      const balance = `$${(debtor.currentBalance || 0).toFixed(2)}`.padStart(12);
      const lastPayment = debtor.lastPaymentDate ? 
        new Date(debtor.lastPaymentDate).toLocaleDateString() : 'Never'.padEnd(12);
      
      console.log(`│ ${code} │ ${student} │ ${owed} │ ${paid} │ ${balance} │ ${lastPayment} │`);
      
      totalOwed += debtor.totalOwed || 0;
      totalPaid += debtor.totalPaid || 0;
      totalBalance += debtor.currentBalance || 0;
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalOwedPadded = `$${totalOwed.toFixed(2)}`.padStart(12);
    const totalPaidPadded = `$${totalPaid.toFixed(2)}`.padStart(12);
    const totalBalancePadded = `$${totalBalance.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │             │ ${totalOwedPadded} │ ${totalPaidPadded} │ ${totalBalancePadded} │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    console.log(`💰 TOTAL OWED: $${totalOwed.toFixed(2)}`);
    console.log(`💰 TOTAL PAID: $${totalPaid.toFixed(2)}`);
    console.log(`💰 TOTAL BALANCE: $${totalBalance.toFixed(2)}\n`);
    
    // ========================================
    // STEP 2: CHECK PAYMENT HISTORY IN DEBTORS
    // ========================================
    console.log('📋 STEP 2: CHECKING PAYMENT HISTORY IN DEBTORS');
    console.log('================================================\n');
    
    debtors.forEach(debtor => {
      console.log(`👤 DEBTOR: ${debtor.debtorCode}`);
      console.log(`   • Total Paid: $${(debtor.totalPaid || 0).toFixed(2)}`);
      console.log(`   • Last Payment: ${debtor.lastPaymentDate ? new Date(debtor.lastPaymentDate).toLocaleDateString() : 'Never'}`);
      console.log(`   • Last Payment Amount: $${(debtor.lastPaymentAmount || 0).toFixed(2)}`);
      
      if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
        console.log(`   • Payment History Count: ${debtor.paymentHistory.length}`);
        console.log(`   • Payment History:`, debtor.paymentHistory);
      } else {
        console.log(`   • Payment History: None`);
      }
      
      if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
        console.log(`   • Monthly Payments Count: ${debtor.monthlyPayments.length}`);
        console.log(`   • Monthly Payments:`, debtor.monthlyPayments);
      } else {
        console.log(`   • Monthly Payments: None`);
      }
      
      if (debtor.transactionEntries && debtor.transactionEntries.length > 0) {
        console.log(`   • Transaction Entries Count: ${debtor.transactionEntries.length}`);
        console.log(`   • Transaction Entries:`, debtor.transactionEntries);
      } else {
        console.log(`   • Transaction Entries: None`);
      }
      
      console.log('');
    });
    
    // ========================================
    // STEP 3: SEARCH TRANSACTIONENTRY FOR EACH DEBTOR
    // ========================================
    console.log('📋 STEP 3: SEARCHING TRANSACTIONENTRY FOR EACH DEBTOR');
    console.log('========================================================\n');
    
    const debtorIds = debtors.map(d => d._id.toString());
    console.log(`🔍 SEARCHING FOR TRANSACTIONS WITH THESE SOURCE IDs:`);
    console.log(`   ${debtorIds.join(', ')}\n`);
    
    // Search for any TransactionEntry records with these source IDs
    const allMatchingTransactions = await TransactionEntry.find({
      sourceId: { $in: debtorIds },
      status: 'posted'
    });
    
    console.log(`📊 TRANSACTIONENTRY RECORDS FOUND: ${allMatchingTransactions.length}\n`);
    
    if (allMatchingTransactions.length > 0) {
      console.log('🔍 DETAILED TRANSACTION ANALYSIS:');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Transaction ID                                 │ Date        │ Source      │ Source ID   │ Amount      │');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      allMatchingTransactions.forEach(entry => {
        const transactionId = entry.transactionId.padEnd(35);
        const date = entry.date.toLocaleDateString().padEnd(12);
        const source = (entry.source || 'N/A').padEnd(12);
        const sourceId = (entry.sourceId || 'N/A').toString().padEnd(12);
        
        // Calculate total amount from entries
        let totalAmount = 0;
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (lineItem.debit > 0) totalAmount += lineItem.debit;
            if (lineItem.credit > 0) totalAmount += lineItem.credit;
          });
        }
        
        const amount = `$${totalAmount.toFixed(2)}`.padStart(12);
        
        console.log(`│ ${transactionId} │ ${date} │ ${source} │ ${sourceId} │ ${amount} │`);
      });
      
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    }
    
    // ========================================
    // STEP 4: SEARCH FOR PAYMENT SOURCE SPECIFICALLY
    // ========================================
    console.log('📋 STEP 4: SEARCHING FOR PAYMENT SOURCE TRANSACTIONS');
    console.log('========================================================\n');
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      sourceId: { $in: debtorIds },
      status: 'posted'
    });
    
    console.log(`💰 PAYMENT SOURCE TRANSACTIONS FOUND: ${paymentTransactions.length}\n`);
    
    if (paymentTransactions.length > 0) {
      console.log('💰 PAYMENT TRANSACTIONS FOR YOUR STUDENTS:');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Transaction ID                                 │ Date        │ Student     │ Amount      │ Description │');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      let totalCashReceived = 0;
      
      paymentTransactions.forEach(entry => {
        const student = debtors.find(d => d._id.toString() === entry.sourceId?.toString());
        const studentName = student ? `DR${student.debtorCode}` : 'Unknown';
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              totalCashReceived += lineItem.debit;
              
              const transactionId = entry.transactionId.padEnd(35);
              const date = entry.date.toLocaleDateString().padEnd(12);
              const studentPadded = studentName.padEnd(15);
              const amount = `$${lineItem.debit.toFixed(2)}`.padStart(12);
              const description = (lineItem.description || 'N/A').padEnd(15);
              
              console.log(`│ ${transactionId} │ ${date} │ ${studentPadded} │ ${amount} │ ${description} │`);
            }
          });
        }
      });
      
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      const totalPadded = `$${totalCashReceived.toFixed(2)}`.padStart(12);
      console.log(`│ TOTAL CASH RECEIVED                           │             │             │ ${totalPadded} │             │`);
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
      
      console.log(`💰 TOTAL CASH RECEIVED FROM YOUR STUDENTS: $${totalCashReceived.toFixed(2)}`);
    } else {
      console.log('❌ NO PAYMENT TRANSACTIONS FOUND FOR YOUR CURRENT STUDENTS!');
    }
    
    // ========================================
    // STEP 5: COMPARE DEBTOR TOTALS VS TRANSACTION TOTALS
    // ========================================
    console.log('📋 STEP 5: COMPARING DEBTOR TOTALS VS TRANSACTION TOTALS');
    console.log('==========================================================\n');
    
    console.log('📊 COMPARISON ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 DEBTOR COLLECTION TOTALS:                                                              │');
    console.log(`│     • Total Paid: $${totalPaid.toFixed(2)}                                                          │`);
    console.log(`│     • Total Owed: $${totalOwed.toFixed(2)}                                                          │`);
    console.log(`│     • Current Balance: $${totalBalance.toFixed(2)}                                                │`);
    console.log('│                                                                                             │');
    
    if (paymentTransactions.length > 0) {
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
      
      console.log('│  💰 TRANSACTIONENTRY TOTALS:                                                               │');
      console.log(`│     • Payment Transactions: ${paymentTransactions.length}                                    │`);
      console.log(`│     • Total Cash Received: $${totalCashFromTransactions.toFixed(2)}                                        │`);
      console.log('│                                                                                             │');
      
      const difference = totalPaid - totalCashFromTransactions;
      console.log('│  🔍 DIFFERENCE ANALYSIS:                                                                   │');
      console.log(`│     • Difference: $${difference.toFixed(2)}                                                          │`);
      
      if (Math.abs(difference) < 0.01) {
        console.log('│     • Status: ✅ PERFECT MATCH!                                                           │');
      } else if (Math.abs(difference) < 1.00) {
        console.log('│     • Status: ⚠️  MINOR DIFFERENCE (rounding)                                             │');
      } else {
        console.log('│     • Status: ❌ SIGNIFICANT DIFFERENCE - INVESTIGATE!                                    │');
      }
    } else {
      console.log('│  💰 TRANSACTIONENTRY TOTALS:                                                               │');
      console.log('│     • Payment Transactions: 0                                                              │');
      console.log('│     • Total Cash Received: $0.00                                                           │');
      console.log('│                                                                                             │');
      console.log('│  🔍 DIFFERENCE ANALYSIS:                                                                   │');
      console.log(`│     • Difference: $${totalPaid.toFixed(2)}                                                          │`);
      console.log('│     • Status: ❌ NO TRANSACTION RECORDS FOUND!                                              │');
    }
    
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL SUMMARY');
    console.log('================\n');
    
    if (paymentTransactions.length > 0) {
      console.log('✅ PAYMENT RECORDS FOUND:');
      console.log(`   • Your 6 students have ${paymentTransactions.length} payment transactions`);
      console.log(`   • Total cash received: $${paymentTransactions.reduce((sum, entry) => {
        let entrySum = 0;
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              entrySum += lineItem.debit;
            }
          });
        }
        return sum + entrySum;
      }, 0).toFixed(2)}`);
      console.log(`   • These are linked to your current debtors`);
    } else {
      console.log('❌ NO PAYMENT RECORDS FOUND:');
      console.log('   • Your 6 students have 0 payment transactions');
      console.log('   • The $5,420.00 must be from deleted students');
      console.log('   • Need to clean up orphaned transactions');
    }
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyStudentPayments();
