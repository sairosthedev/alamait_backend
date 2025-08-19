const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Expense = require('../src/models/finance/Expense');

async function investigate90112CashBasis() {
  try {
    console.log('\n🔍 INVESTIGATING WHY $901.12 APPEARS IN "CASH BASIS"');
    console.log('=====================================================\n');
    
    // ========================================
    // STEP 1: FIND THE $901.12 EXPENSE
    // ========================================
    console.log('🔍 STEP 1: Finding the $901.12 Expense\n');
    
    const expense90112 = await Expense.findOne({
      amount: 901.12
    });
    
    if (expense90112) {
      console.log(`✅ FOUND $901.12 EXPENSE:`);
      console.log(`   ID: ${expense90112._id}`);
      console.log(`   Expense ID: ${expense90112.expenseId}`);
      console.log(`   Description: ${expense90112.description}`);
      console.log(`   Date: ${expense90112.expenseDate?.toDateString()}`);
      console.log(`   Payment Status: ${expense90112.paymentStatus}`);
      console.log(`   Category: ${expense90112.category}`);
      console.log(`   Residence: ${expense90112.residence}`);
    } else {
      console.log(`❌ No expense found with amount $901.12`);
      return;
    }
    
    // ========================================
    // STEP 2: CHECK IF IT HAS A CASH PAYMENT ENTRY
    // ========================================
    console.log('\n🔍 STEP 2: Checking for Cash Payment Entry\n');
    
    const cashPaymentEntry = await TransactionEntry.findOne({
      sourceId: expense90112._id,
      'entries.accountCode': { $in: ['1001', '1002', '1011'] } // Cash accounts
    });
    
    if (cashPaymentEntry) {
      console.log(`🚨 FOUND CASH PAYMENT ENTRY for $901.12!`);
      console.log(`   Transaction ID: ${cashPaymentEntry.transactionId}`);
      console.log(`   Description: ${cashPaymentEntry.description}`);
      console.log(`   Source: ${cashPaymentEntry.source}`);
      console.log(`   Date: ${cashPaymentEntry.date?.toDateString()}`);
      
      // Check the cash movement
      const cashEntry = cashPaymentEntry.entries.find(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode)
      );
      
      if (cashEntry) {
        console.log(`   Cash Account: ${cashEntry.accountCode} - ${cashEntry.accountName}`);
        console.log(`   Debit: $${cashEntry.debit || 0}`);
        console.log(`   Credit: $${cashEntry.credit || 0}`);
        
        if (cashEntry.credit > 0) {
          console.log(`   ✅ This expense WAS paid with cash (CREDIT to cash)`);
          console.log(`   🎯 This justifies it appearing in "cash basis"`);
        } else {
          console.log(`   ❌ This expense was NOT paid with cash`);
          console.log(`   🚨 It should NOT appear in "cash basis"`);
        }
      }
    } else {
      console.log(`❌ NO CASH PAYMENT ENTRY found for $901.12`);
      console.log(`   This means it was NEVER paid with cash`);
      console.log(`   🚨 It should NOT appear in "cash basis" income statement`);
    }
    
    // ========================================
    // STEP 3: CHECK FOR ACCRUAL ENTRIES
    // ========================================
    console.log('\n🔍 STEP 3: Checking for Accrual Entries\n');
    
    const accrualEntries = await TransactionEntry.find({
      sourceId: expense90112._id,
      'entries.accountCode': '5099' // Other Operating Expenses
    });
    
    if (accrualEntries.length > 0) {
      console.log(`📋 FOUND ACCRUAL ENTRIES for $901.12:`);
      accrualEntries.forEach((entry, index) => {
        console.log(`   Entry ${index + 1}:`);
        console.log(`     Transaction ID: ${entry.transactionId}`);
        console.log(`     Description: ${entry.description}`);
        console.log(`     Source: ${entry.source}`);
        console.log(`     Date: ${entry.date?.toDateString()}`);
        
        entry.entries.forEach(e => {
          console.log(`     • ${e.accountCode} - ${e.accountName}: $${e.debit || 0} / $${e.credit || 0}`);
        });
      });
    } else {
      console.log(`❌ No accrual entries found for $901.12`);
    }
    
    // ========================================
    // STEP 4: ANALYSIS & CONCLUSION
    // ========================================
    console.log('\n📋 ANALYSIS & CONCLUSION');
    console.log('==========================');
    
    if (cashPaymentEntry) {
      console.log(`✅ $901.12 SHOULD appear in "cash basis" because:`);
      console.log(`   - It has a cash payment TransactionEntry`);
      console.log(`   - Cash actually moved out of your accounts`);
      console.log(`   - This is a real cash outflow`);
    } else {
      console.log(`🚨 $901.12 should NOT appear in "cash basis" because:`);
      console.log(`   - No cash payment TransactionEntry found`);
      console.log(`   - No cash actually moved out`);
      console.log(`   - This is an accrued expense (liability), not cash spent`);
      console.log(`   - Your "cash basis" reporting is INCORRECT`);
    }
    
    console.log(`\n🎯 RECOMMENDATION:`);
    if (cashPaymentEntry) {
      console.log(`   - Keep $901.12 in cash basis (it was actually paid)`);
    } else {
      console.log(`   - Remove $901.12 from cash basis (it wasn't paid)`);
      console.log(`   - Move it to accrual basis only`);
      console.log(`   - Fix your cash basis logic`);
    }
    
  } catch (error) {
    console.error('❌ Error investigating $901.12 cash basis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigate90112CashBasis();
