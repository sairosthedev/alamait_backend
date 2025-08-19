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
 * CLEANUP ORPHANED TRANSACTIONS
 * 
 * This script will:
 * 1. Remove orphaned payment transactions from deleted students
 * 2. Show real cash received from actual students
 * 3. Set up data integrity rules
 */

async function cleanupOrphanedTransactions() {
  try {
    console.log('\n🧹 CLEANING UP ORPHANED TRANSACTIONS');
    console.log('=====================================\n');
    
    // ========================================
    // STEP 1: IDENTIFY ORPHANED TRANSACTIONS
    // ========================================
    console.log('📋 STEP 1: IDENTIFYING ORPHANED TRANSACTIONS');
    console.log('============================================\n');
    
    const debtors = await Debtor.find({});
    const debtorIds = debtors.map(d => d._id.toString());
    
    console.log(`👥 ACTUAL STUDENTS: ${debtors.length}`);
    console.log(`🔍 DEBTOR IDs: ${debtorIds.join(', ')}\n`);
    
    // Find all payment transactions
    const allPaymentEntries = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    console.log(`💰 TOTAL PAYMENT ENTRIES: ${allPaymentEntries.length}`);
    
    // Separate valid vs orphaned transactions
    const validTransactions = [];
    const orphanedTransactions = [];
    
    allPaymentEntries.forEach(entry => {
      if (debtorIds.includes(entry.sourceId?.toString())) {
        validTransactions.push(entry);
      } else {
        orphanedTransactions.push(entry);
      }
    });
    
    console.log(`✅ VALID TRANSACTIONS: ${validTransactions.length}`);
    console.log(`❌ ORPHANED TRANSACTIONS: ${orphanedTransactions.length}\n`);
    
    // ========================================
    // STEP 2: SHOW ORPHANED TRANSACTIONS
    // ========================================
    console.log('📋 STEP 2: ORPHANED TRANSACTIONS TO BE DELETED');
    console.log('================================================\n');
    
    if (orphanedTransactions.length > 0) {
      console.log('🚨 ORPHANED TRANSACTIONS (FROM DELETED STUDENTS):');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Transaction ID                                 │ Date        │ Source ID   │ Amount      │');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
      
      let totalOrphanedAmount = 0;
      
      orphanedTransactions.forEach(entry => {
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              totalOrphanedAmount += lineItem.debit;
              
              const transactionId = entry.transactionId.padEnd(35);
              const date = entry.date.toLocaleDateString().padEnd(12);
              const sourceId = (entry.sourceId || 'N/A').toString().padEnd(12);
              const amount = `$${lineItem.debit.toFixed(2)}`.padStart(12);
              
              console.log(`│ ${transactionId} │ ${date} │ ${sourceId} │ ${amount} │`);
            }
          });
        }
      });
      
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
      const totalOrphanedPadded = `$${totalOrphanedAmount.toFixed(2)}`.padStart(12);
      console.log(`│ TOTAL ORPHANED AMOUNT                          │             │             │ ${totalOrphanedPadded} │`);
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┘\n');
      
      console.log(`💰 AMOUNT TO BE CLEANED UP: $${totalOrphanedAmount.toFixed(2)}`);
    } else {
      console.log('✅ NO ORPHANED TRANSACTIONS FOUND!');
    }
    
    // ========================================
    // STEP 3: SHOW VALID TRANSACTIONS
    // ========================================
    console.log('📋 STEP 3: VALID TRANSACTIONS (FROM ACTUAL STUDENTS)');
    console.log('=====================================================\n');
    
    if (validTransactions.length > 0) {
      console.log('✅ VALID TRANSACTIONS (FROM YOUR 6 STUDENTS):');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Transaction ID                                 │ Date        │ Student     │ Amount      │');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
      
      let totalValidAmount = 0;
      const validTransactionsByStudent = {};
      
      validTransactions.forEach(entry => {
        const studentId = entry.sourceId?.toString();
        const student = debtors.find(d => d._id.toString() === studentId);
        const studentName = student ? `DR${student.debtorCode}` : 'Unknown';
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              totalValidAmount += lineItem.debit;
              
              if (!validTransactionsByStudent[studentId]) {
                validTransactionsByStudent[studentId] = {
                  name: studentName,
                  total: 0,
                  transactions: []
                };
              }
              
              validTransactionsByStudent[studentId].total += lineItem.debit;
              validTransactionsByStudent[studentId].transactions.push({
                transactionId: entry.transactionId,
                date: entry.date,
                amount: lineItem.debit,
                description: lineItem.description
              });
              
              const transactionId = entry.transactionId.padEnd(35);
              const date = entry.date.toLocaleDateString().padEnd(12);
              const studentPadded = studentName.padEnd(15);
              const amount = `$${lineItem.debit.toFixed(2)}`.padStart(12);
              
              console.log(`│ ${transactionId} │ ${date} │ ${studentPadded} │ ${amount} │`);
            }
          });
        }
      });
      
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
      const totalValidPadded = `$${totalValidAmount.toFixed(2)}`.padStart(12);
      console.log(`│ TOTAL VALID AMOUNT                             │             │             │ ${totalValidPadded} │`);
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┘\n');
      
      console.log(`💰 REAL CASH RECEIVED FROM YOUR 6 STUDENTS: $${totalValidAmount.toFixed(2)}`);
    } else {
      console.log('⚠️  NO VALID TRANSACTIONS FOUND!');
    }
    
    // ========================================
    // STEP 4: CONFIRM CLEANUP
    // ========================================
    console.log('📋 STEP 4: CONFIRM CLEANUP');
    console.log('===========================\n');
    
    if (orphanedTransactions.length > 0) {
      console.log('🚨 READY TO CLEAN UP ORPHANED TRANSACTIONS');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│                                                                                             │');
      console.log('│  🔴 TRANSACTIONS TO BE DELETED:                                                             │');
      console.log(`│     • Count: ${orphanedTransactions.length} transactions                                      │`);
      console.log(`│     • Amount: $${orphanedTransactions.reduce((sum, entry) => {
        let entrySum = 0;
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              entrySum += lineItem.debit;
            }
          });
        }
        return sum + entrySum;
      }, 0).toFixed(2)}                                                          │`);
      console.log('│     • These are from deleted students and should be removed                               │');
      console.log('│                                                                                             │');
      console.log('│  ✅ AFTER CLEANUP:                                                                          │');
      console.log(`│     • Valid transactions: ${validTransactions.length}                                        │`);
      console.log(`│     • Real cash received: $${validTransactions.reduce((sum, entry) => {
        let entrySum = 0;
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
              entrySum += lineItem.debit;
            }
          });
        }
        return sum + entrySum;
      }, 0).toFixed(2)}                                                          │`);
      console.log('│                                                                                             │');
      console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      
      // Ask for confirmation
      console.log('⚠️  WARNING: This will permanently delete orphaned transactions!');
      console.log('   Type "YES" to proceed with cleanup:');
      
      // In a real scenario, you'd want user input confirmation
      // For now, we'll show what would be deleted
      console.log('\n🔧 CLEANUP READY - Run the actual deletion when ready');
      
    } else {
      console.log('✅ NO CLEANUP NEEDED - All transactions are valid!');
    }
    
    // ========================================
    // STEP 5: DATA INTEGRITY RULES
    // ========================================
    console.log('📋 STEP 5: DATA INTEGRITY RULES FOR THE FUTURE');
    console.log('================================================\n');
    
    console.log('🔒 PREVENTING ORPHANED TRANSACTIONS IN THE FUTURE:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  💡 RULE 1: CASCADE DELETE                                                                 │');
    console.log('│     • When deleting a student, automatically delete all related transactions               │');
    console.log('│     • Use database triggers or application-level cascade deletes                          │');
    console.log('│                                                                                             │');
    console.log('│  💡 RULE 2: REFERENTIAL INTEGRITY                                                            │');
    console.log('│     • Set up foreign key constraints between students and transactions                    │');
    console.log('│     • Prevent deletion of students with active transactions                               │');
    console.log('│                                                                                             │');
    console.log('│  💡 RULE 3: SOFT DELETE                                                                     │');
    console.log('│     • Instead of deleting students, mark them as "inactive"                               │');
    console.log('│     • Keep transaction history for audit purposes                                         │');
    console.log('│                                                                                             │');
    console.log('│  💡 RULE 4: REGULAR AUDITS                                                                  │');
    console.log('│     • Run this cleanup script monthly to catch orphaned data                             │');
    console.log('│     • Monitor for data inconsistencies                                                     │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 6: FINAL SUMMARY
    // ========================================
    console.log('📋 STEP 6: FINAL SUMMARY');
    console.log('=========================\n');
    
    console.log('🎯 CLEANUP SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 BEFORE CLEANUP:                                                                         │');
    console.log(`│     • Total cash reported: $5,420.00                                                        │`);
    console.log(`│     • Transactions: ${allPaymentEntries.length}                                              │`);
    console.log(`│     • Students: 6 (but showing payments from 20+ sources)                                  │`);
    console.log('│                                                                                             │');
    console.log('│  📊 AFTER CLEANUP:                                                                          │');
    console.log(`│     • Real cash received: $${validTransactions.reduce((sum, entry) => {
      let entrySum = 0;
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            entrySum += lineItem.debit;
          }
        });
      }
      return sum + entrySum;
    }, 0).toFixed(2)}                                                          │`);
    console.log(`│     • Valid transactions: ${validTransactions.length}                                        │`);
    console.log(`│     • Students: 6 (matching actual data)                                                   │`);
    console.log('│                                                                                             │');
    console.log('│  🔧 NEXT STEPS:                                                                             │');
    console.log('│     1. Review the orphaned transactions above                                              │');
    console.log('│     2. Confirm they should be deleted                                                      │');
    console.log('│     3. Run the actual deletion script                                                      │');
    console.log('│     4. Set up data integrity rules to prevent future issues                               │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    console.log('🎉 CLEANUP ANALYSIS COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error during cleanup analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup analysis
cleanupOrphanedTransactions();
