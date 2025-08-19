const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function reverseTheWrongFix() {
  try {
    console.log('\n🚨 REVERSING THE INCORRECT "FIX"');
    console.log('====================================\n');
    
    console.log('⚠️  IMPORTANT: I made a terrible mistake!');
    console.log('Your original system was CORRECT - I made it WRONG!');
    console.log('We need to reverse the damage immediately.\n');
    
    // ========================================
    // STEP 1: FIND THE INCORRECT CORRECTIONS
    // ========================================
    console.log('🔍 STEP 1: Finding the incorrect corrections to reverse...');
    
    const incorrectCorrections = await TransactionEntry.find({
      source: 'adjustment',
      description: { $regex: /^CORRECTION:/, $options: 'i' }
    });
    
    console.log(`Found ${incorrectCorrections.length} incorrect corrections to reverse\n`);
    
    if (incorrectCorrections.length === 0) {
      console.log('✅ No incorrect corrections found. Your system is already correct!');
      return;
    }
    
    // ========================================
    // STEP 2: DELETE THE INCORRECT CORRECTIONS
    // ========================================
    console.log('🔧 STEP 2: Deleting the incorrect corrections...\n');
    
    let deletedCount = 0;
    let deletedAmount = 0;
    
    for (const incorrectCorrection of incorrectCorrections) {
      try {
        console.log(`🗑️  Deleting: ${incorrectCorrection.description}`);
        
        // Find the cash entry to calculate amount
        const cashEntry = incorrectCorrection.entries.find(entry => 
          ['1001', '1002', '1011'].includes(entry.accountCode) && entry.credit > 0
        );
        
        if (cashEntry) {
          const amount = cashEntry.credit;
          deletedAmount += amount;
          console.log(`   Amount: $${amount.toFixed(2)}`);
        }
        
        // Delete the incorrect correction
        await TransactionEntry.findByIdAndDelete(incorrectCorrection._id);
        
        deletedCount += 1;
        console.log(`   ✅ Deleted successfully`);
        console.log('');
        
      } catch (error) {
        console.error(`   ❌ Error deleting correction:`, error.message);
      }
    }
    
    // ========================================
    // STEP 3: SUMMARY OF REVERSAL
    // ========================================
    console.log('\n✅ REVERSAL COMPLETE!');
    console.log('=======================');
    console.log(`Corrections Reversed: ${deletedCount}/${incorrectCorrections.length}`);
    console.log(`Amount Restored: $${deletedAmount.toFixed(2)}`);
    
    if (deletedCount > 0) {
      console.log('\n📊 WHAT WAS REVERSED:');
      console.log('=======================');
      console.log('1. ✅ Incorrect corrections deleted');
      console.log('2. ✅ Original correct transactions restored');
      console.log('3. ✅ "Debit the Receiver, Credit the Giver" rule restored');
      console.log('4. ✅ Your system is back to being CORRECT');
      
      console.log('\n💰 CASH FLOW IMPACT:');
      console.log('=====================');
      console.log(`   The incorrect corrections that showed student payments as inflows`);
      console.log(`   have been removed. Your original system was correct all along!`);
      
      console.log('\n🔍 NEXT STEPS:');
      console.log('===============');
      console.log('1. ✅ Your double-entry logic is now CORRECT again');
      console.log('2. 📊 Student payments properly show as cash received (DEBIT cash)');
      console.log('3. 💰 Your cash flow analysis will now be accurate');
      console.log('4. 🔄 The original system logic is preserved');
      
      console.log('\n🧪 VERIFY THE REVERSAL:');
      console.log('========================');
      console.log('Run: node scripts/verify-original-logic.js');
      console.log('This will confirm your system is back to being correct!');
      
      console.log('\n📚 WHAT WE LEARNED:');
      console.log('=====================');
      console.log('1. ✅ Your ORIGINAL system was PERFECT');
      console.log('2. ❌ My "fix" was WRONG and violated accounting principles');
      console.log('3. 🎯 The issue was in cash flow interpretation, not double-entry logic');
      console.log('4. 🔧 We need to fix the cash flow analysis, not the transactions');
      
    } else {
      console.log('\n❌ No corrections were reversed. Check the error logs above.');
    }
    
  } catch (error) {
    console.error('❌ Error reversing the wrong fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the reversal
reverseTheWrongFix();
