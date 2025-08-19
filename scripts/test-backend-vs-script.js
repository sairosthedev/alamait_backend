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
 * TEST BACKEND VS SCRIPT
 * 
 * This script will compare what the actual backend service returns vs. what my script calculates
 */

async function testBackendVsScript() {
  try {
    console.log('\n🔍 TESTING BACKEND VS SCRIPT');
    console.log('==============================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: WHAT MY SCRIPT CALCULATES
    // ========================================
    console.log('📋 STEP 1: WHAT MY SCRIPT CALCULATES');
    console.log('=====================================\n');
    
    // Get all rental accruals (revenue earned regardless of cash)
    const rentalAccruals = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'rental_accrual',
      status: 'posted'
    });
    
    // Get all expenses incurred (regardless of cash payment)
    const expenseAccruals = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'posted'
    });
    
    // Calculate accrual totals
    let totalAccrualRevenue = 0;
    let totalAccrualExpenses = 0;
    
    rentalAccruals.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['4001', '4000', '4100', '4020'].includes(lineItem.accountCode) && lineItem.credit > 0) {
            totalAccrualRevenue += lineItem.credit;
          }
        });
      }
    });
    
    expenseAccruals.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['5099', '5003', '5030', '5050'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            totalAccrualExpenses += lineItem.debit;
          }
        });
      }
    });
    
    const accrualNetIncome = totalAccrualRevenue - totalAccrualExpenses;
    
    console.log('💰 MY SCRIPT CALCULATION:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log(`│  📈 REVENUES: $${totalAccrualRevenue.toFixed(2)}                                        │`);
    console.log(`│  📉 EXPENSES: $${totalAccrualExpenses.toFixed(2)}                                        │`);
    console.log(`│  🎯 NET INCOME: $${accrualNetIncome.toFixed(2)}                                        │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 2: WHAT BACKEND SERVICE RETURNS
    // ========================================
    console.log('📋 STEP 2: WHAT BACKEND SERVICE RETURNS');
    console.log('========================================\n');
    
    try {
      // Call the actual backend service
      const backendResult = await financialReportingService.generateIncomeStatement('2025', 'accrual');
      
      console.log('💰 BACKEND SERVICE RESULT:');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│                                                                                             │');
      console.log(`│  📈 REVENUES: $${backendResult.revenue.total_revenue.toFixed(2)}                                        │`);
      console.log(`│  📉 EXPENSES: $${backendResult.expenses.total_expenses.toFixed(2)}                                        │`);
      console.log(`│  🎯 NET INCOME: $${backendResult.net_income.toFixed(2)}                                        │`);
      console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      
      // ========================================
      // STEP 3: COMPARISON
      // ========================================
      console.log('📋 STEP 3: COMPARISON');
      console.log('======================\n');
      
      const revenueDiff = Math.abs(totalAccrualRevenue - backendResult.revenue.total_revenue);
      const expenseDiff = Math.abs(totalAccrualExpenses - backendResult.expenses.total_expenses);
      const netIncomeDiff = Math.abs(accrualNetIncome - backendResult.net_income);
      
      console.log('🔍 DIFFERENCES:');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│                                                                                             │');
      console.log(`│  📈 REVENUE DIFFERENCE: $${revenueDiff.toFixed(2)}                                        │`);
      console.log(`│  📉 EXPENSE DIFFERENCE: $${expenseDiff.toFixed(2)}                                        │`);
      console.log(`│  🎯 NET INCOME DIFFERENCE: $${netIncomeDiff.toFixed(2)}                                        │`);
      console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
      
      if (revenueDiff < 0.01 && expenseDiff < 0.01 && netIncomeDiff < 0.01) {
        console.log('✅ PERFECT MATCH! Backend and script are identical.');
      } else {
        console.log('❌ MISMATCH DETECTED! There are differences between backend and script.');
        console.log('💡 This means the frontend might be showing different numbers than expected.');
      }
      
    } catch (backendError) {
      console.log('❌ BACKEND SERVICE ERROR:');
      console.log(backendError.message);
      console.log('\n💡 This means there might be an issue with the backend service.');
    }
    
    // ========================================
    // STEP 4: DETAILED ANALYSIS
    // ========================================
    console.log('\n📋 STEP 4: DETAILED ANALYSIS');
    console.log('=============================\n');
    
    console.log('🔍 RENTAL ACCRUALS FOUND:');
    console.log(`   • Total count: ${rentalAccruals.length}`);
    console.log(`   • Date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
    
    if (rentalAccruals.length > 0) {
      console.log('   • Sample entries:');
      rentalAccruals.slice(0, 3).forEach((accrual, index) => {
        console.log(`     ${index + 1}. ${accrual.description} (${accrual.date.toLocaleDateString()})`);
      });
    }
    
    console.log('\n🔍 EXPENSE ACCRUALS FOUND:');
    console.log(`   • Total count: ${expenseAccruals.length}`);
    
    if (expenseAccruals.length > 0) {
      console.log('   • Sample entries:');
      expenseAccruals.slice(0, 3).forEach((expense, index) => {
        console.log(`     ${index + 1}. ${expense.description} (${expense.date.toLocaleDateString()})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing backend vs script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testBackendVsScript();
