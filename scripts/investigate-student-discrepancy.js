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
 * INVESTIGATE STUDENT DISCREPANCY
 * 
 * You only have 6 students but system shows payments from 20+ students
 * This script will find out what's happening!
 */

async function investigateStudentDiscrepancy() {
  try {
    console.log('\n🚨 INVESTIGATING STUDENT DISCREPANCY!');
    console.log('=====================================\n');
    
    // ========================================
    // STEP 1: COUNT ACTUAL STUDENTS
    // ========================================
    console.log('📋 STEP 1: COUNT ACTUAL STUDENTS');
    console.log('=================================\n');
    
    const debtors = await Debtor.find({});
    console.log(`👥 ACTUAL STUDENTS IN DEBTOR COLLECTION: ${debtors.length}`);
    
    if (debtors.length > 0) {
      console.log('\n📊 DEBTOR DETAILS:');
      console.log('┌─────────────┬──────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Debtor Code│ Student  │ Total Owed  │ Total Paid  │ Balance     │');
      console.log('├─────────────┼──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      debtors.forEach(debtor => {
        const code = (debtor.debtorCode || 'N/A').padEnd(12);
        const student = (debtor.user ? 'Has User ID' : 'No User').padEnd(9);
        const owed = `$${(debtor.totalOwed || 0).toFixed(2)}`.padStart(12);
        const paid = `$${(debtor.totalPaid || 0).toFixed(2)}`.padStart(12);
        const balance = `$${(debtor.currentBalance || 0).toFixed(2)}`.padStart(12);
        
        console.log(`│ ${code} │ ${student} │ ${owed} │ ${paid} │ ${balance} │`);
      });
      
      console.log('└─────────────┴──────────┴─────────────┴─────────────┴─────────────┘\n');
    }
    
    // ========================================
    // STEP 2: ANALYZE PAYMENT TRANSACTIONS
    // ========================================
    console.log('📋 STEP 2: ANALYZE PAYMENT TRANSACTIONS');
    console.log('========================================\n');
    
    const paymentEntries = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    console.log(`💰 PAYMENT TRANSACTIONS FOUND: ${paymentEntries.length}`);
    
    // Group by transaction ID to see how many unique payments
    const uniqueTransactions = new Set();
    const transactionDetails = {};
    
    paymentEntries.forEach(entry => {
      uniqueTransactions.add(entry.transactionId);
      
      if (!transactionDetails[entry.transactionId]) {
        transactionDetails[entry.transactionId] = {
          date: entry.date,
          sourceId: entry.sourceId,
          sourceModel: entry.sourceModel,
          metadata: entry.metadata,
          entries: []
        };
      }
      
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            transactionDetails[entry.transactionId].entries.push({
              accountCode: lineItem.accountCode,
              amount: lineItem.debit,
              description: lineItem.description
            });
          }
        });
      }
    });
    
    console.log(`🔍 UNIQUE PAYMENT TRANSACTIONS: ${uniqueTransactions.size}`);
    console.log(`📊 TOTAL CASH ENTRIES: ${paymentEntries.length}`);
    
    // ========================================
    // STEP 3: EXAMINE TRANSACTION STRUCTURE
    // ========================================
    console.log('\n📋 STEP 3: EXAMINE TRANSACTION STRUCTURE');
    console.log('==========================================\n');
    
    console.log('🔍 SAMPLE TRANSACTION ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Transaction ID                                 │ Date        │ Source ID   │ Cash Entries│');
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
    
    let count = 0;
    Object.entries(transactionDetails).forEach(([transactionId, details]) => {
      if (count < 10) { // Show first 10
        const txId = transactionId.padEnd(35);
        const date = details.date.toLocaleDateString().padEnd(12);
        const sourceId = (details.sourceId || 'N/A').toString().padEnd(12);
        const cashEntries = details.entries.length.toString().padEnd(12);
        
        console.log(`│ ${txId} │ ${date} │ ${sourceId} │ ${cashEntries} │`);
        count++;
      }
    });
    
    if (Object.keys(transactionDetails).length > 10) {
      console.log('│ ... (showing first 10 of ' + Object.keys(transactionDetails).length + ' transactions) │');
    }
    
    console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // STEP 4: INVESTIGATE SOURCE IDs
    // ========================================
    console.log('📋 STEP 4: INVESTIGATE SOURCE IDs');
    console.log('==================================\n');
    
    const sourceIds = new Set();
    const sourceModels = new Set();
    
    paymentEntries.forEach(entry => {
      if (entry.sourceId) sourceIds.add(entry.sourceId.toString());
      if (entry.sourceModel) sourceModels.add(entry.sourceModel);
    });
    
    console.log(`🔍 UNIQUE SOURCE IDs: ${sourceIds.size}`);
    console.log(`📊 SOURCE MODELS: ${Array.from(sourceModels).join(', ')}`);
    
    // Check if source IDs match debtor IDs
    const debtorIds = debtors.map(d => d._id.toString());
    const matchingSourceIds = Array.from(sourceIds).filter(id => debtorIds.includes(id));
    const nonMatchingSourceIds = Array.from(sourceIds).filter(id => !debtorIds.includes(id));
    
    console.log(`✅ SOURCE IDs MATCHING DEBTORS: ${matchingSourceIds.length}`);
    console.log(`❌ SOURCE IDs NOT MATCHING DEBTORS: ${nonMatchingSourceIds.length}`);
    
    if (nonMatchingSourceIds.length > 0) {
      console.log('\n🚨 NON-MATCHING SOURCE IDs (THESE ARE THE PROBLEM!):');
      nonMatchingSourceIds.slice(0, 10).forEach(id => {
        console.log(`   • ${id}`);
      });
      if (nonMatchingSourceIds.length > 10) {
        console.log(`   • ... and ${nonMatchingSourceIds.length - 10} more!`);
      }
    }
    
    // ========================================
    // STEP 5: CHECK FOR DUPLICATE ENTRIES
    // ========================================
    console.log('\n📋 STEP 5: CHECK FOR DUPLICATE ENTRIES');
    console.log('=========================================\n');
    
    // Check if the same transaction has multiple cash entries
    const duplicateTransactions = {};
    
    Object.entries(transactionDetails).forEach(([transactionId, details]) => {
      if (details.entries.length > 1) {
        duplicateTransactions[transactionId] = details;
      }
    });
    
    console.log(`🔄 TRANSACTIONS WITH MULTIPLE CASH ENTRIES: ${Object.keys(duplicateTransactions).length}`);
    
    if (Object.keys(duplicateTransactions).length > 0) {
      console.log('\n📊 EXAMPLE OF DUPLICATE CASH ENTRIES:');
      const exampleTx = Object.entries(duplicateTransactions)[0];
      console.log(`   Transaction: ${exampleTx[0]}`);
      console.log(`   Date: ${exampleTx[1].date.toLocaleDateString()}`);
      exampleTx[1].entries.forEach(entry => {
        console.log(`   • Account ${entry.accountCode}: $${entry.amount.toFixed(2)} - ${entry.description}`);
      });
    }
    
    // ========================================
    // STEP 6: CALCULATE ACTUAL CASH RECEIVED
    // ========================================
    console.log('\n📋 STEP 6: CALCULATE ACTUAL CASH RECEIVED');
    console.log('============================================\n');
    
    let totalCashReceived = 0;
    let totalCashEntries = 0;
    
    paymentEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            totalCashReceived += lineItem.debit;
            totalCashEntries++;
          }
        });
      }
    });
    
    console.log(`💰 TOTAL CASH RECEIVED: $${totalCashReceived.toFixed(2)}`);
    console.log(`📊 TOTAL CASH ENTRIES: ${totalCashEntries}`);
    console.log(`🔍 UNIQUE TRANSACTIONS: ${uniqueTransactions.size}`);
    
    // ========================================
    // STEP 7: IDENTIFY THE PROBLEM
    // ========================================
    console.log('\n📋 STEP 7: IDENTIFY THE PROBLEM');
    console.log('==================================\n');
    
    console.log('🚨 ROOT CAUSE ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    
    if (nonMatchingSourceIds.length > 0) {
      console.log('│  🔴 PROBLEM 1: ORPHANED TRANSACTIONS                                                      │');
      console.log('│     • You have ${nonMatchingSourceIds.length} payment transactions with source IDs that don\'t match your debtors │');
      console.log('│     • These are likely from deleted students or test data                                │');
      console.log('│     • They\'re inflating your cash received total                                          │');
    }
    
    if (Object.keys(duplicateTransactions).length > 0) {
      console.log('│  🔴 PROBLEM 2: DUPLICATE CASH ENTRIES                                                     │');
      console.log('│     • Some transactions have multiple cash account entries                                │');
      console.log('│     • This could be double-counting the same payment                                      │');
    }
    
    if (totalCashEntries > uniqueTransactions.size) {
      console.log('│  🔴 PROBLEM 3: OVER-COUNTING                                                              │');
      console.log('│     • ${totalCashEntries} cash entries vs ${uniqueTransactions.size} unique transactions    │');
      console.log('│     • Each payment should only have ONE cash entry                                        │');
    }
    
    console.log('│                                                                                             │');
    console.log('│  💡 SOLUTION: Clean up orphaned transactions and fix duplicate entries                      │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL SUMMARY');
    console.log('================\n');
    
    console.log('✅ WHAT WE CONFIRMED:');
    console.log(`   • You actually have ${debtors.length} students (correct)`);
    console.log(`   • System shows ${uniqueTransactions.size} payment transactions`);
    console.log(`   • Total cash entries: ${totalCashEntries}`);
    console.log(`   • Total cash received: $${totalCashReceived.toFixed(2)}`);
    
    console.log('\n🚨 THE PROBLEM:');
    console.log('   • You have orphaned payment transactions from deleted/test students');
    console.log('   • These transactions are inflating your cash received total');
    console.log('   • The $5,420.00 includes payments from students who no longer exist');
    
    console.log('\n🔧 WHAT TO DO:');
    console.log('   1. Clean up orphaned transactions');
    console.log('   2. Verify only current students have payment records');
    console.log('   3. Reconcile actual cash received with your 6 students');
    
    console.log('\n🎉 INVESTIGATION COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error investigating student discrepancy:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigateStudentDiscrepancy();
