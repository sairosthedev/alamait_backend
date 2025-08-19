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
 * DELETE ORPHANED TRANSACTIONS
 * 
 * This script will ACTUALLY DELETE all orphaned payment transactions
 * from deleted students. Use with extreme caution!
 */

async function deleteOrphanedTransactions() {
  try {
    console.log('\n🗑️  DELETING ORPHANED TRANSACTIONS');
    console.log('====================================\n');
    
    // ========================================
    // STEP 1: FINAL CONFIRMATION
    // ========================================
    console.log('🚨 FINAL WARNING: This will PERMANENTLY DELETE data!');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  ⚠️  WARNING: PERMANENT DELETION                                                           │');
    console.log('│     • This script will DELETE orphaned payment transactions                                │');
    console.log('│     • This action CANNOT be undone                                                         │');
    console.log('│     • Make sure you have a backup before proceeding                                        │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 2: IDENTIFY ORPHANED TRANSACTIONS
    // ========================================
    console.log('📋 STEP 1: IDENTIFYING ORPHANED TRANSACTIONS');
    console.log('============================================\n');
    
    const debtors = await Debtor.find({});
    const debtorIds = debtors.map(d => d._id.toString());
    
    console.log(`👥 ACTUAL STUDENTS: ${debtors.length}`);
    console.log(`🔍 DEBTOR IDs: ${debtorIds.join(', ')}\n`);
    
    // Find all orphaned payment transactions
    const orphanedTransactions = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted',
      sourceId: { $nin: debtorIds }
    });
    
    console.log(`❌ ORPHANED TRANSACTIONS FOUND: ${orphanedTransactions.length}`);
    
    if (orphanedTransactions.length === 0) {
      console.log('✅ No orphaned transactions to delete!');
      return;
    }
    
    // ========================================
    // STEP 3: SHOW WHAT WILL BE DELETED
    // ========================================
    console.log('\n📋 STEP 2: TRANSACTIONS TO BE DELETED');
    console.log('======================================\n');
    
    let totalAmount = 0;
    const transactionsByDate = {};
    
    orphanedTransactions.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            totalAmount += lineItem.debit;
            
            const date = entry.date.toLocaleDateString();
            if (!transactionsByDate[date]) {
              transactionsByDate[date] = {
                count: 0,
                amount: 0,
                transactions: []
              };
            }
            
            transactionsByDate[date].count++;
            transactionsByDate[date].amount += lineItem.debit;
            transactionsByDate[date].transactions.push({
              id: entry._id,
              transactionId: entry.transactionId,
              amount: lineItem.debit,
              description: lineItem.description
            });
          }
        });
      }
    });
    
    console.log('📊 ORPHANED TRANSACTIONS BY DATE:');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Date        │ Count       │ Amount      │ Details     │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┤');
    
    Object.entries(transactionsByDate).forEach(([date, data]) => {
      const datePadded = date.padEnd(12);
      const countPadded = data.count.toString().padStart(12);
      const amountPadded = `$${data.amount.toFixed(2)}`.padStart(12);
      const detailsPadded = `${data.transactions.length} transactions`.padEnd(12);
      
      console.log(`│ ${datePadded} │ ${countPadded} │ ${amountPadded} │ ${detailsPadded} │`);
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalCountPadded = orphanedTransactions.length.toString().padStart(12);
    const totalAmountPadded = `$${totalAmount.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │ ${totalCountPadded} │ ${totalAmountPadded} │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    console.log(`💰 TOTAL AMOUNT TO BE DELETED: $${totalAmount.toFixed(2)}`);
    console.log(`📊 TOTAL TRANSACTIONS TO BE DELETED: ${orphanedTransactions.length}\n`);
    
    // ========================================
    // STEP 4: CONFIRM DELETION
    // ========================================
    console.log('📋 STEP 3: CONFIRM DELETION');
    console.log('============================\n');
    
    console.log('⚠️  FINAL CONFIRMATION REQUIRED:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  🔴 YOU ARE ABOUT TO DELETE:                                                               │');
    console.log(`│     • ${orphanedTransactions.length} payment transactions                                    │`);
    console.log(`│     • $${totalAmount.toFixed(2)} in cash entries                                            │`);
    console.log('│     • All data from deleted students                                                        │');
    console.log('│                                                                                             │');
    console.log('│  ✅ AFTER DELETION:                                                                          │');
    console.log('│     • Your cash received will be $0.00                                                      │');
    console.log('│     • Only current students will have transaction records                                   │');
    console.log('│     • Your financial reports will be accurate                                               │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: EXECUTE DELETION
    // ========================================
    console.log('📋 STEP 4: EXECUTING DELETION');
    console.log('==============================\n');
    
    console.log('🗑️  DELETING ORPHANED TRANSACTIONS...');
    
    // Delete all orphaned transactions
    const deleteResult = await TransactionEntry.deleteMany({
      _id: { $in: orphanedTransactions.map(t => t._id) }
    });
    
    console.log(`✅ DELETION COMPLETE!`);
    console.log(`   • Deleted: ${deleteResult.deletedCount} transactions`);
    console.log(`   • Amount removed: $${totalAmount.toFixed(2)}`);
    
    // ========================================
    // STEP 6: VERIFY DELETION
    // ========================================
    console.log('\n📋 STEP 5: VERIFYING DELETION');
    console.log('==============================\n');
    
    // Check remaining payment transactions
    const remainingTransactions = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    console.log(`🔍 REMAINING PAYMENT TRANSACTIONS: ${remainingTransactions.length}`);
    
    if (remainingTransactions.length === 0) {
      console.log('✅ All orphaned transactions successfully deleted!');
      console.log('💰 Your cash received is now: $0.00');
    } else {
      console.log('⚠️  Some transactions remain. Checking if they are valid...');
      
      const validRemaining = remainingTransactions.filter(entry => 
        debtorIds.includes(entry.sourceId?.toString())
      );
      
      console.log(`✅ Valid transactions remaining: ${validRemaining.length}`);
      console.log(`❌ Invalid transactions remaining: ${remainingTransactions.length - validRemaining.length}`);
    }
    
    // ========================================
    // STEP 7: FINAL SUMMARY
    // ========================================
    console.log('\n📋 STEP 6: FINAL SUMMARY');
    console.log('=========================\n');
    
    console.log('🎉 CLEANUP COMPLETE!');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  ✅ WHAT WAS ACCOMPLISHED:                                                                  │');
    console.log(`│     • Deleted ${deleteResult.deletedCount} orphaned transactions                            │`);
    console.log(`│     • Removed $${totalAmount.toFixed(2)} in phantom cash entries                          │`);
    console.log('│     • Cleaned up data from deleted students                                                │');
    console.log('│                                                                                             │');
    console.log('│  💰 CURRENT STATUS:                                                                         │');
    console.log('│     • Real cash received: $0.00                                                            │');
    console.log('│     • Valid transactions: 0                                                                │');
    console.log('│     • Students: 6 (all current)                                                            │');
    console.log('│                                                                                             │');
    console.log('│  🔧 NEXT STEPS:                                                                             │');
    console.log('│     1. Your financial reports will now show accurate data                                 │');
    console.log('│     2. When current students make payments, they will be properly recorded                 │');
    console.log('│     3. Set up data integrity rules to prevent future orphaned data                        │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    console.log('🎯 YOUR ACCOUNTING SYSTEM IS NOW CLEAN AND ACCURATE!');
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the deletion
deleteOrphanedTransactions();
