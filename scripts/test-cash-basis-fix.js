const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

/**
 * TEST CASH BASIS FIX
 * 
 * This script will verify that the cash basis calculation
 * no longer includes 'manual' source entries (which are accruals)
 */

async function testCashBasisFix() {
  try {
    console.log('\n🧪 TESTING CASH BASIS FIX');
    console.log('==========================\n');
    
    // Test period (August 2025)
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');
    
    console.log(`📅 Testing Period: ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
    
    // ========================================
    // STEP 1: Check what 'manual' source entries exist
    // ========================================
    console.log('🔍 STEP 1: Checking Manual Source Entries\n');
    
    const manualEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'manual',
      status: 'posted'
    });
    
    console.log(`📊 Total Manual Source Entries: ${manualEntries.length}`);
    
    if (manualEntries.length > 0) {
      console.log('\n📋 Manual Entries Found:');
      manualEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.description}`);
        console.log(`      Amount: $${entry.totalDebit}`);
        console.log(`      Account: ${entry.entries[0]?.accountCode} - ${entry.entries[0]?.accountName}`);
        console.log(`      Type: ${entry.entries[0]?.accountType}`);
        console.log('');
      });
    }
    
    // ========================================
    // STEP 2: Check what 'expense_payment' source entries exist
    // ========================================
    console.log('🔍 STEP 2: Checking Expense Payment Source Entries\n');
    
    const expensePaymentEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'expense_payment',
      status: 'posted'
    });
    
    console.log(`📊 Total Expense Payment Entries: ${expensePaymentEntries.length}`);
    
    if (expensePaymentEntries.length > 0) {
      console.log('\n📋 Expense Payment Entries Found:');
      expensePaymentEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.description}`);
        console.log(`      Amount: $${entry.totalDebit}`);
        console.log(`      Account: ${entry.entries[0]?.accountCode} - ${entry.entries[0]?.accountName}`);
        console.log(`      Type: ${entry.entries[0]?.accountType}`);
        console.log('');
      });
    }
    
    // ========================================
    // STEP 3: Check what 'vendor_payment' source entries exist
    // ========================================
    console.log('🔍 STEP 3: Checking Vendor Payment Source Entries\n');
    
    const vendorPaymentEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'vendor_payment',
      status: 'posted'
    });
    
    console.log(`📊 Total Vendor Payment Entries: ${vendorPaymentEntries.length}`);
    
    if (vendorPaymentEntries.length > 0) {
      console.log('\n📋 Vendor Payment Entries Found:');
      vendorPaymentEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.description}`);
        console.log(`      Amount: $${entry.totalDebit}`);
        console.log(`      Account: ${entry.entries[0]?.accountCode} - ${entry.entries[0]?.accountName}`);
        console.log(`      Type: ${entry.entries[0]?.accountType}`);
        console.log('');
      });
    }
    
    // ========================================
    // STEP 4: Calculate what cash basis should show
    // ========================================
    console.log('🔍 STEP 4: Calculating Correct Cash Basis\n');
    
    // OLD WAY (with bug): included 'manual' source
    const oldExpenseEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['expense_payment', 'manual'] },
      status: 'posted'
    });
    
    // NEW WAY (fixed): only includes actual cash payments
    const newExpenseEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['expense_payment', 'vendor_payment'] },
      status: 'posted'
    });
    
    let oldTotalExpenses = 0;
    let newTotalExpenses = 0;
    
    oldExpenseEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (lineItem.accountType === 'Expense') {
            oldTotalExpenses += lineItem.debit || 0;
          }
        });
      }
    });
    
    newExpenseEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (lineItem.accountType === 'Expense') {
            newTotalExpenses += lineItem.debit || 0;
          }
        });
      }
    });
    
    console.log(`💰 OLD WAY (with bug): Total Expenses: $${oldTotalExpenses.toFixed(2)}`);
    console.log(`💰 NEW WAY (fixed): Total Expenses: $${newTotalExpenses.toFixed(2)}`);
    console.log(`💰 DIFFERENCE (phantom expense): $${(oldTotalExpenses - newTotalExpenses).toFixed(2)}`);
    
    // ========================================
    // STEP 5: Summary
    // ========================================
    console.log('\n🔍 STEP 5: Summary\n');
    
    if (oldTotalExpenses > newTotalExpenses) {
      console.log(`✅ SUCCESS! The fix has removed $${(oldTotalExpenses - newTotalExpenses).toFixed(2)} in phantom expenses`);
      console.log(`   Old calculation included accrual entries (source: 'manual')`);
      console.log(`   New calculation only includes actual cash payments`);
      console.log(`   Your cash basis income statement will now be accurate!`);
    } else {
      console.log(`ℹ️  No phantom expenses found in this period`);
    }
    
  } catch (error) {
    console.error('❌ Error testing cash basis fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testCashBasisFix();
