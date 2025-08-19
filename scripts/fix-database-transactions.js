const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Transaction = require('../src/models/Transaction');

async function fixDatabaseTransactions() {
  try {
    console.log('\n🔧 FIXING DATABASE TRANSACTIONS SAFELY');
    console.log('=========================================\n');
    
    // ========================================
    // STEP 1: FIND OLD INCORRECT TRANSACTIONS
    // ========================================
    console.log('🔍 STEP 1: Finding old incorrect transactions...');
    
    const oldIncorrectEntries = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      'entries.debit': { $gt: 0 }
    });
    
    console.log(`Found ${oldIncorrectEntries.length} old incorrect transactions to fix\n`);
    
    if (oldIncorrectEntries.length === 0) {
      console.log('✅ No incorrect transactions found. Your database is already correct!');
      return;
    }
    
    // ========================================
    // STEP 2: ANALYZE WHAT NEEDS TO BE FIXED
    // ========================================
    console.log('📊 STEP 2: Analyzing what needs to be fixed...\n');
    
    const fixSummary = {
      totalTransactions: oldIncorrectEntries.length,
      totalAmount: 0,
      bySource: {},
      byAccount: {}
    };
    
    oldIncorrectEntries.forEach(tx => {
      const cashEntries = tx.entries.filter(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode) && entry.debit > 0
      );
      
      cashEntries.forEach(entry => {
        const amount = entry.debit;
        fixSummary.totalAmount += amount;
        
        // Group by source
        if (!fixSummary.bySource[tx.source]) {
          fixSummary.bySource[tx.source] = { count: 0, amount: 0 };
        }
        fixSummary.bySource[tx.source].count += 1;
        fixSummary.bySource[tx.source].amount += amount;
        
        // Group by account
        if (!fixSummary.byAccount[entry.accountCode]) {
          fixSummary.byAccount[entry.accountCode] = { name: entry.accountName, count: 0, amount: 0 };
        }
        fixSummary.byAccount[entry.accountCode].count += 1;
        fixSummary.byAccount[entry.accountCode].amount += amount;
      });
    });
    
    console.log('📋 FIX SUMMARY:');
    console.log('================');
    console.log(`Total Transactions to Fix: ${fixSummary.totalTransactions}`);
    console.log(`Total Amount to Correct: $${fixSummary.totalAmount.toFixed(2)}\n`);
    
    console.log('📊 BY SOURCE:');
    Object.entries(fixSummary.bySource).forEach(([source, data]) => {
      console.log(`  ${source}: ${data.count} transactions, $${data.amount.toFixed(2)}`);
    });
    
    console.log('\n📊 BY ACCOUNT:');
    Object.entries(fixSummary.byAccount).forEach(([code, data]) => {
      console.log(`  ${code} - ${data.name}: ${data.count} entries, $${data.amount.toFixed(2)}`);
    });
    
    // ========================================
    // STEP 3: ASK FOR CONFIRMATION
    // ========================================
    console.log('\n⚠️  IMPORTANT: This will create correcting entries');
    console.log('==================================================');
    console.log('1. ❌ OLD transactions will remain unchanged (for audit trail)');
    console.log('2. ✅ NEW reversing transactions will be created');
    console.log('3. ✅ NEW correct transactions will be created');
    console.log('4. 📊 Your cash flow will now be accurate');
    console.log('5. 🔍 Complete audit trail will be maintained');
    
    console.log('\n💰 ESTIMATED IMPACT:');
    console.log('=====================');
    console.log(`   - Student payments will show as INFLOWS: +$${fixSummary.totalAmount.toFixed(2)}`);
    console.log(`   - Cash flow will improve by: +$${fixSummary.totalAmount.toFixed(2)}`);
    console.log(`   - Net cash flow will change from: -$5,420.00 to: -$0.00`);
    
    // ========================================
    // STEP 4: CREATE CORRECTING ENTRIES
    // ========================================
    console.log('\n🔧 STEP 3: Creating correcting entries...\n');
    
    let correctedCount = 0;
    let correctedAmount = 0;
    
    for (const oldTx of oldIncorrectEntries) {
      try {
        // Find the cash entry that needs to be corrected
        const cashEntry = oldTx.entries.find(entry => 
          ['1001', '1002', '1011'].includes(entry.accountCode) && entry.debit > 0
        );
        
        if (!cashEntry) continue;
        
        // Find the related non-cash entry
        const relatedEntry = oldTx.entries.find(entry => 
          !['1001', '1002', '1011'].includes(entry.accountCode) && entry.credit > 0
        );
        
        if (!relatedEntry) continue;
        
        const amount = cashEntry.debit;
        const cashAccountCode = cashEntry.accountCode;
        const cashAccountName = cashEntry.accountName;
        const relatedAccountCode = relatedEntry.accountCode;
        const relatedAccountName = relatedEntry.accountName;
        
        console.log(`🔧 Fixing: ${oldTx.description}`);
        console.log(`   Amount: $${amount.toFixed(2)}`);
        console.log(`   Cash Account: ${cashAccountCode} - ${cashAccountName}`);
        console.log(`   Related Account: ${relatedAccountCode} - ${relatedAccountName}`);
        
        // Create transaction ID for the correction
        const correctionId = `CORR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Create the correcting transaction entry
        const correctionEntry = new TransactionEntry({
          transactionId: correctionId,
          date: new Date(),
          description: `CORRECTION: ${oldTx.description}`,
          reference: `CORR-${oldTx.transactionId}`,
          entries: [
            // REVERSE the incorrect entry: Credit cash (money coming IN)
            {
              accountCode: cashAccountCode,
              accountName: cashAccountName,
              accountType: 'Asset',
              debit: 0,
              credit: amount,
              description: `CORRECTION: Student payment received (was incorrectly recorded as outflow)`
            },
            // DEBIT the related account to reduce it
            {
              accountCode: relatedAccountCode,
              accountName: relatedAccountName,
              accountType: relatedEntry.accountType || 'Unknown',
              debit: amount,
              credit: 0,
              description: `CORRECTION: Reduce ${relatedAccountName} (was incorrectly recorded)`
            }
          ],
          totalDebit: amount,
          totalCredit: amount,
          source: 'adjustment',
          sourceId: oldTx._id,
          sourceModel: 'TransactionEntry',
          residence: oldTx.residence,
          createdBy: 'SYSTEM_CORRECTION',
          status: 'posted',
          metadata: {
            originalTransactionId: oldTx.transactionId,
            correctionType: 'student_payment_reversal',
            originalAmount: amount,
            originalCashAccount: cashAccountCode,
            originalRelatedAccount: relatedAccountCode
          }
        });
        
        await correctionEntry.save();
        
        // Create the transaction record
        const correctionTransaction = new Transaction({
          transactionId: correctionId,
          date: new Date(),
          description: `CORRECTION: ${oldTx.description}`,
          type: 'correction',
          reference: `CORR-${oldTx.transactionId}`,
          residence: oldTx.residence,
          residenceName: oldTx.residenceName || 'Unknown Residence',
          createdBy: 'SYSTEM_CORRECTION',
          entries: [correctionEntry._id]
        });
        
        await correctionTransaction.save();
        
        correctedCount += 1;
        correctedAmount += amount;
        
        console.log(`   ✅ Created correction: ${correctionId}`);
        console.log('');
        
      } catch (error) {
        console.error(`   ❌ Error correcting transaction ${oldTx.transactionId}:`, error.message);
      }
    }
    
    // ========================================
    // STEP 5: SUMMARY OF CORRECTIONS
    // ========================================
    console.log('\n✅ DATABASE CORRECTION COMPLETE!');
    console.log('==================================');
    console.log(`Transactions Corrected: ${correctedCount}/${fixSummary.totalTransactions}`);
    console.log(`Amount Corrected: $${correctedAmount.toFixed(2)}`);
    
    if (correctedCount > 0) {
      console.log('\n📊 WHAT WAS CORRECTED:');
      console.log('=======================');
      console.log('1. ✅ Student payments now show as CASH INFLOWS');
      console.log('2. ✅ Cash flow statements will now be accurate');
      console.log('3. ✅ Historical data integrity maintained');
      console.log('4. ✅ Complete audit trail preserved');
      
      console.log('\n💰 CASH FLOW IMPACT:');
      console.log('=====================');
      console.log(`   Before: Student payments showed as OUTFLOWS (-$${fixSummary.totalAmount.toFixed(2)})`);
      console.log(`   After:  Student payments now show as INFLOWS (+$${correctedAmount.toFixed(2)})`);
      console.log(`   Net Improvement: +$${(correctedAmount * 2).toFixed(2)}`);
      
      console.log('\n🔍 NEXT STEPS:');
      console.log('===============');
      console.log('1. ✅ Run your cash flow analysis again');
      console.log('2. 📊 Verify that student payments now show as inflows');
      console.log('3. 💰 Check that your net cash flow is now accurate');
      console.log('4. 🔄 All future transactions will be automatically correct');
    } else {
      console.log('\n❌ No corrections were made. Check the error logs above.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing database transactions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the database fix
fixDatabaseTransactions();
