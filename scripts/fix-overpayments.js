const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');

/**
 * FIX OVERPAYMENTS
 * 
 * This script will:
 * 1. Identify students who have paid more than they owe
 * 2. Remove the excess payment amounts
 * 3. Correct the payment records to match actual amounts owed
 */

async function fixOverpayments() {
  try {
    console.log('\n🔧 FIXING OVERPAYMENTS');
    console.log('========================\n');
    
    // ========================================
    // STEP 1: GET ALL DEBTORS
    // ========================================
    console.log('📋 STEP 1: ANALYZING DEBTOR PAYMENTS');
    console.log('======================================\n');
    
    const debtors = await Debtor.find({});
    console.log(`👥 TOTAL DEBTORS: ${debtors.length}\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found!');
      return;
    }
    
    // ========================================
    // STEP 2: IDENTIFY OVERPAYMENTS
    // ========================================
    console.log('📋 STEP 2: IDENTIFYING OVERPAYMENTS');
    console.log('=====================================\n');
    
    console.log('👥 OVERPAYMENT ANALYSIS');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code │ Total Owed  │ Total Paid  │ Overpayment │ Should Pay  │ Status      │ Action      │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalOverpayments = 0;
    const overpayments = [];
    
    debtors.forEach(debtor => {
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      const totalOwed = debtor.totalOwed || 0;
      const totalPaid = debtor.totalPaid || 0;
      
      const totalOwedPadded = `$${totalOwed.toFixed(2)}`.padStart(12);
      const totalPaidPadded = `$${totalPaid.toFixed(2)}`.padStart(12);
      
      let overpayment = 0;
      let shouldPay = totalOwed;
      let status = 'Unknown';
      let action = 'None';
      
      if (totalPaid > totalOwed) {
        overpayment = totalPaid - totalOwed;
        status = '❌ OVERPAID'.padEnd(12);
        action = 'FIX'.padEnd(12);
        totalOverpayments += overpayment;
        overpayments.push({
          debtorId: debtor._id,
          debtorCode: debtor.debtorCode,
          totalOwed: totalOwed,
          totalPaid: totalPaid,
          overpayment: overpayment,
          shouldPay: shouldPay
        });
      } else if (totalPaid === totalOwed) {
        status = '✅ PERFECT'.padEnd(12);
        action = 'NONE'.padEnd(12);
      } else {
        status = '⚠️  UNDERPAID'.padEnd(12);
        action = 'NONE'.padEnd(12);
      }
      
      const overpaymentPadded = `$${overpayment.toFixed(2)}`.padStart(12);
      const shouldPayPadded = `$${shouldPay.toFixed(2)}`.padStart(12);
      
      console.log(`│ ${code} │ ${totalOwedPadded} │ ${totalPaidPadded} │ ${overpaymentPadded} │ ${shouldPayPadded} │ ${status} │ ${action} │`);
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalOverPadded = `$${totalOverpayments.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │             │             │ ${totalOverPadded} │             │             │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    if (overpayments.length === 0) {
      console.log('✅ NO OVERPAYMENTS FOUND - All students have correct payment amounts!');
      return;
    }
    
    // ========================================
    // STEP 3: DETAILED OVERPAYMENT BREAKDOWN
    // ========================================
    console.log('📋 STEP 3: DETAILED OVERPAYMENT BREAKDOWN');
    console.log('==========================================\n');
    
    overpayments.forEach((overpayment, index) => {
      console.log(`👤 OVERPAYMENT ${index + 1}: ${overpayment.debtorCode}`);
      console.log('─'.repeat(60));
      console.log(`   💰 Total Owed: $${overpayment.totalOwed.toFixed(2)}`);
      console.log(`   💰 Total Paid: $${overpayment.totalPaid.toFixed(2)}`);
      console.log(`   ❌ Overpayment: $${overpayment.overpayment.toFixed(2)}`);
      console.log(`   ✅ Should Pay: $${overpayment.shouldPay.toFixed(2)}`);
      console.log('');
    });
    
    // ========================================
    // STEP 4: ASK FOR CONFIRMATION
    // ========================================
    console.log('📋 STEP 4: READY TO FIX OVERPAYMENTS');
    console.log('======================================\n');
    
    console.log('🔍 SUMMARY OF OVERPAYMENTS TO FIX:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 OVERPAYMENT STATUS:                                                                     │');
    console.log(`│     • Students with overpayments: ${overpayments.length}                                        │`);
    console.log(`│     • Total overpayment amount: $${totalOverpayments.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💡 WHAT WILL BE FIXED:                                                                     │');
    console.log('│     • Reduce totalPaid to match totalOwed for overpaid students                              │');
    console.log('│     • Update currentBalance to reflect correct amounts                                       │');
    console.log('│     • Remove excess payment TransactionEntry records                                         │');
    console.log('│                                                                                             │');
    console.log('│  ⚠️  WARNING: This will permanently remove excess payment records                            │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: APPLY THE FIXES
    // ========================================
    console.log('📋 STEP 5: APPLYING OVERPAYMENT FIXES');
    console.log('======================================\n');
    
    let fixedCount = 0;
    let totalFixed = 0;
    
    for (const overpayment of overpayments) {
      try {
        console.log(`🔧 Fixing ${overpayment.debtorCode}...`);
        
        // Update debtor record
        await Debtor.findByIdAndUpdate(overpayment.debtorId, {
          totalPaid: overpayment.shouldPay,
          currentBalance: overpayment.totalOwed - overpayment.shouldPay
        });
        
        // Find and remove excess payment TransactionEntry records
        const excessAmount = overpayment.overpayment;
        const paymentEntries = await TransactionEntry.find({
          source: 'payment',
          sourceId: overpayment.debtorId,
          status: 'posted'
        });
        
        let removedAmount = 0;
        let removedEntries = 0;
        
        // Sort by date (oldest first) to remove most recent overpayments
        paymentEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        for (const entry of paymentEntries) {
          if (removedAmount >= excessAmount) break;
          
          // Calculate how much this entry contributes to cash
          let entryCashAmount = 0;
          if (entry.entries && Array.isArray(entry.entries)) {
            entry.entries.forEach(lineItem => {
              if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
                entryCashAmount += lineItem.debit;
              }
            });
          }
          
          if (entryCashAmount > 0) {
            const amountToRemove = Math.min(entryCashAmount, excessAmount - removedAmount);
            
            if (amountToRemove === entryCashAmount) {
              // Remove entire entry
              await TransactionEntry.findByIdAndDelete(entry._id);
              removedAmount += entryCashAmount;
              removedEntries++;
              console.log(`   🗑️  Removed entire payment entry: $${entryCashAmount.toFixed(2)}`);
            } else {
              // Reduce entry amount
              const newAmount = entryCashAmount - amountToRemove;
              if (newAmount > 0) {
                // Update the entry with reduced amount
                entry.entries.forEach(lineItem => {
                  if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
                    lineItem.debit = newAmount;
                  }
                });
                entry.totalDebit = newAmount;
                entry.totalCredit = newAmount;
                await entry.save();
                console.log(`   ✂️  Reduced payment entry: $${entryCashAmount.toFixed(2)} → $${newAmount.toFixed(2)}`);
              } else {
                // Remove entry if amount becomes 0
                await TransactionEntry.findByIdAndDelete(entry._id);
                console.log(`   🗑️  Removed payment entry (amount became 0)`);
              }
              removedAmount += amountToRemove;
              removedEntries++;
            }
          }
        }
        
        console.log(`   ✅ FIXED ${overpayment.debtorCode}: Removed $${removedAmount.toFixed(2)} in ${removedEntries} entries`);
        fixedCount++;
        totalFixed += removedAmount;
        
      } catch (error) {
        console.log(`   ❌ ERROR fixing ${overpayment.debtorCode}: ${error.message}`);
      }
    }
    
    // ========================================
    // STEP 6: VERIFICATION
    // ========================================
    console.log('\n📋 STEP 6: VERIFICATION');
    console.log('=========================\n');
    
    if (fixedCount > 0) {
      console.log('🎉 OVERPAYMENT FIXES APPLIED SUCCESSFULLY!');
      console.log(`   • Fixed ${fixedCount} debtors`);
      console.log(`   • Total amount corrected: $${totalFixed.toFixed(2)}`);
      console.log(`   • Your payment records are now accurate`);
    } else {
      console.log('✅ NO FIXES APPLIED');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('   1. Run your financial reports again to see the corrected amounts');
    console.log('   2. Student payments will now match what they actually owe');
    console.log('   3. Your cash flow statements will be accurate');
    
  } catch (error) {
    console.error('❌ Error during overpayment fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixOverpayments();
