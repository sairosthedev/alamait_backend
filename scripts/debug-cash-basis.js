const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models and service
const TransactionEntry = require('../src/models/TransactionEntry');
const financialReportingService = require('../src/services/financialReportingService');

/**
 * DEBUG CASH BASIS
 * 
 * This script will debug why cash basis is returning $0.00
 */

async function debugCashBasis() {
  try {
    console.log('\n🔍 DEBUGGING CASH BASIS');
    console.log('========================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: WHAT CASH ENTRIES EXIST
    // ========================================
    console.log('📋 STEP 1: WHAT CASH ENTRIES EXIST');
    console.log('===================================\n');
    
    // Get payment entries (what backend looks for)
    const paymentEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'payment',
      status: 'posted'
    });
    
    // Get expense payment entries (what backend looks for)
    const expenseEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['expense_payment', 'vendor_payment'] },
      status: 'posted'
    });
    
    console.log(`🔍 PAYMENT ENTRIES FOUND: ${paymentEntries.length}`);
    console.log(`🔍 EXPENSE ENTRIES FOUND: ${expenseEntries.length}\n`);
    
    // ========================================
    // STEP 2: ANALYZE PAYMENT ENTRIES
    // ========================================
    console.log('📋 STEP 2: ANALYZE PAYMENT ENTRIES');
    console.log('===================================\n');
    
    if (paymentEntries.length > 0) {
      console.log('💰 PAYMENT ENTRIES ANALYSIS:');
      paymentEntries.forEach((entry, index) => {
        console.log(`\n📊 PAYMENT ${index + 1}: ${entry.description}`);
        console.log('─'.repeat(50));
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach((lineItem, lineIndex) => {
            console.log(`   Line ${lineIndex + 1}: Account ${lineItem.accountCode} (${lineItem.accountName})`);
            console.log(`      Type: ${lineItem.accountType}`);
            console.log(`      Debit: $${lineItem.debit.toFixed(2)}, Credit: $${lineItem.credit.toFixed(2)}`);
            
            // Check what backend looks for
            if (lineItem.accountType === 'Income') {
              console.log(`      ✅ BACKEND WOULD COUNT THIS AS REVENUE: $${lineItem.credit.toFixed(2)}`);
            } else {
              console.log(`      ❌ BACKEND IGNORES THIS (not Income type)`);
            }
          });
        }
      });
    } else {
      console.log('❌ NO PAYMENT ENTRIES FOUND!');
    }
    
    // ========================================
    // STEP 3: ANALYZE EXPENSE ENTRIES
    // ========================================
    console.log('\n📋 STEP 3: ANALYZE EXPENSE ENTRIES');
    console.log('===================================\n');
    
    if (expenseEntries.length > 0) {
      console.log('💸 EXPENSE ENTRIES ANALYSIS:');
      expenseEntries.forEach((entry, index) => {
        console.log(`\n📊 EXPENSE ${index + 1}: ${entry.description}`);
        console.log('─'.repeat(50));
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach((lineItem, lineIndex) => {
            console.log(`   Line ${lineIndex + 1}: Account ${lineItem.accountCode} (${lineItem.accountName})`);
            console.log(`      Type: ${lineItem.accountType}`);
            console.log(`      Debit: $${lineItem.debit.toFixed(2)}, Credit: $${lineItem.credit.toFixed(2)}`);
            
            // Check what backend looks for
            if (lineItem.accountType === 'Expense') {
              console.log(`      ✅ BACKEND WOULD COUNT THIS AS EXPENSE: $${lineItem.debit.toFixed(2)}`);
            } else {
              console.log(`      ❌ BACKEND IGNORES THIS (not Expense type)`);
            }
          });
        }
      });
    } else {
      console.log('❌ NO EXPENSE ENTRIES FOUND!');
    }
    
    // ========================================
    // STEP 4: WHAT SHOULD BE CASH MOVEMENTS
    // ========================================
    console.log('\n📋 STEP 4: WHAT SHOULD BE CASH MOVEMENTS');
    console.log('==========================================\n');
    
    // Find all entries that have cash account movements
    const allEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'posted'
    });
    
    let cashInflows = 0;
    let cashOutflows = 0;
    const cashMovements = [];
    
    allEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          // Cash accounts: 1001 (Bank), 1002 (Cash on Hand), 1011 (Admin Petty Cash)
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              cashInflows += lineItem.debit;
              cashMovements.push({
                type: 'INFLOW',
                amount: lineItem.debit,
                description: entry.description,
                source: entry.source,
                date: entry.date
              });
            }
            if (lineItem.credit > 0) {
              cashOutflows += lineItem.credit;
              cashMovements.push({
                type: 'OUTFLOW',
                amount: lineItem.credit,
                description: entry.description,
                source: entry.source,
                date: entry.date
              });
            }
          }
        });
      }
    });
    
    console.log(`💰 TOTAL CASH INFLOWS: $${cashInflows.toFixed(2)}`);
    console.log(`💸 TOTAL CASH OUTFLOWS: $${cashOutflows.toFixed(2)}`);
    console.log(`🎯 NET CASH FLOW: $${(cashInflows - cashOutflows).toFixed(2)}\n`);
    
    if (cashMovements.length > 0) {
      console.log('📊 CASH MOVEMENTS BREAKDOWN:');
      cashMovements.forEach((movement, index) => {
        console.log(`   ${index + 1}. ${movement.type}: $${movement.amount.toFixed(2)} - ${movement.description} (${movement.source})`);
      });
    }
    
    // ========================================
    // STEP 5: BACKEND SERVICE TEST
    // ========================================
    console.log('\n📋 STEP 5: BACKEND SERVICE TEST');
    console.log('================================\n');
    
    try {
      const backendResult = await financialReportingService.generateIncomeStatement('2025', 'cash');
      
      console.log('💰 BACKEND CASH BASIS RESULT:');
      console.log(`   Revenue: $${backendResult.revenue.total_revenue.toFixed(2)}`);
      console.log(`   Expenses: $${backendResult.expenses.total_expenses.toFixed(2)}`);
      console.log(`   Net Income: $${backendResult.net_income.toFixed(2)}`);
      
    } catch (backendError) {
      console.log('❌ BACKEND ERROR:', backendError.message);
    }
    
  } catch (error) {
    console.error('❌ Error debugging cash basis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugCashBasis();
