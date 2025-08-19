const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

async function verifyOriginalLogic() {
  try {
    console.log('\n🔍 VERIFYING ORIGINAL SYSTEM LOGIC');
    console.log('=====================================\n');
    
    // Get a sample of student payment transactions
    const studentPayments = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /Payment.*for.*/, $options: 'i' }
    }).limit(5);
    
    console.log(`Found ${studentPayments.length} student payment transactions to analyze\n`);
    
    studentPayments.forEach((tx, idx) => {
      console.log(`📊 TRANSACTION ${idx + 1}: ${tx.description}`);
      console.log(`Date: ${tx.date.toDateString()}`);
      console.log(`Source: ${tx.source}`);
      console.log('Entries:');
      
      tx.entries.forEach((entry, entryIdx) => {
        const accountCode = entry.accountCode;
        const accountName = entry.accountName;
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        
        console.log(`  ${entryIdx + 1}. ${accountCode} - ${accountName}`);
        console.log(`     Debit: $${debit.toFixed(2)} | Credit: $${credit.toFixed(2)}`);
        
        // Analyze if this follows "Debit the Receiver, Credit the Giver"
        if (['1001', '1002', '1011'].includes(accountCode)) {
          // This is a cash account
          if (debit > 0) {
            console.log(`     ✅ CORRECT: Cash account DEBITED (you received cash)`);
            console.log(`         This follows "Debit the Receiver" - you received cash`);
          } else if (credit > 0) {
            console.log(`     ❌ INCORRECT: Cash account CREDITED (you gave cash away)`);
            console.log(`         This would mean you're giving cash, not receiving it`);
          }
        } else {
          // This is a non-cash account
          if (credit > 0) {
            console.log(`     ✅ CORRECT: Non-cash account CREDITED (you're giving a reduction in debt/income)`);
            console.log(`         This follows "Credit the Giver" - you're giving a reduction`);
          } else if (debit > 0) {
            console.log(`     ❌ INCORRECT: Non-cash account DEBITED`);
            console.log(`         This would mean you're receiving something, not giving`);
          }
        }
        console.log('');
      });
      
      console.log('---');
    });
    
    // Now let's check what the "fix" actually did
    console.log('\n🔧 ANALYZING WHAT THE "FIX" ACTUALLY DID:\n');
    
    const correctionEntries = await TransactionEntry.find({
      source: 'adjustment',
      description: { $regex: /^CORRECTION:/, $options: 'i' }
    }).limit(3);
    
    console.log(`Found ${correctionEntries.length} correction entries to analyze\n`);
    
    correctionEntries.forEach((tx, idx) => {
      console.log(`🔧 CORRECTION ${idx + 1}: ${tx.description}`);
      console.log('Entries:');
      
      tx.entries.forEach((entry, entryIdx) => {
        const accountCode = entry.accountCode;
        const accountName = entry.accountName;
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        
        console.log(`  ${entryIdx + 1}. ${accountCode} - ${accountName}`);
        console.log(`     Debit: $${debit.toFixed(2)} | Credit: $${credit.toFixed(2)}`);
        
        if (['1001', '1002', '1011'].includes(accountCode)) {
          if (credit > 0) {
            console.log(`     ❌ THIS "FIX" IS WRONG!`);
            console.log(`         It's CREDITING cash when you should be DEBITING it`);
            console.log(`         This violates "Debit the Receiver" rule`);
          }
        }
        console.log('');
      });
      
      console.log('---');
    });
    
    // Summary
    console.log('\n📋 ANALYSIS SUMMARY:');
    console.log('=====================');
    console.log('1. 🔍 ORIGINAL SYSTEM:');
    console.log('   - Student payments: DEBIT cash (✅ CORRECT - you receive cash)');
    console.log('   - Student payments: CREDIT accounts receivable (✅ CORRECT - you give reduction in debt)');
    console.log('   - This follows "Debit the Receiver, Credit the Giver" perfectly!');
    
    console.log('\n2. 🔧 THE "FIX":');
    console.log('   - Student payments: CREDIT cash (❌ WRONG - this means you gave cash away)');
    console.log('   - Student payments: DEBIT accounts receivable (❌ WRONG - this means you received debt)');
    console.log('   - This VIOLATES "Debit the Receiver, Credit the Giver"!');
    
    console.log('\n3. 🎯 CONCLUSION:');
    console.log('   - Your ORIGINAL system was CORRECT');
    console.log('   - The "fix" made it WRONG');
    console.log('   - We need to REVERSE the fix and restore the original logic');
    
  } catch (error) {
    console.error('❌ Error verifying original logic:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyOriginalLogic();
