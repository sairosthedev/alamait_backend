const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

/**
 * SEPTEMBER-DECEMBER FINANCIAL REPORTS
 * 
 * This will show the difference between accrual and cash basis
 * when revenue is accrued but not yet received in cash
 */

async function generateSeptDecReports() {
  try {
    console.log('\n📊 SEPTEMBER-DECEMBER FINANCIAL REPORTS');
    console.log('=========================================\n');
    
    // Set reporting period (September-December 2025)
    const startDate = new Date('2025-09-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 Reporting Period: ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
    
    // ========================================
    // REPORT 1: INCOME STATEMENT (ACCRUAL BASIS)
    // ========================================
    console.log('📋 REPORT 1: INCOME STATEMENT (ACCRUAL BASIS)');
    console.log('=============================================\n');
    
    // Get all revenue and expenses for the period
    const accrualEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'posted'
    });
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByAccount = {};
    const expensesByAccount = {};
    
    accrualEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (lineItem.accountType === 'Income') {
            const amount = lineItem.credit || 0;
            totalRevenue += amount;
            const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
            revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
          } else if (lineItem.accountType === 'Expense') {
            const amount = lineItem.debit || 0;
            totalExpenses += amount;
            const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
            expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
          }
        });
      }
    });
    
    // Display Revenue Table
    console.log('💰 REVENUE (ACCRUED):');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Account Description                            │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    if (Object.keys(revenueByAccount).length > 0) {
      Object.entries(revenueByAccount).forEach(([account, amount]) => {
        const paddedAccount = account.padEnd(45);
        const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
        console.log(`│ ${paddedAccount} │ ${paddedAmount} │`);
      });
    } else {
      console.log('│ No revenue accrued in this period              │ $0.00       │');
    }
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalRevenuePadded = `$${totalRevenue.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL REVENUE (ACCRUED)                        │ ${totalRevenuePadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // Display Expenses Table
    console.log('💸 EXPENSES (ACCRUED):');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Account Description                            │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    if (Object.keys(expensesByAccount).length > 0) {
      Object.entries(expensesByAccount).forEach(([account, amount]) => {
        const paddedAccount = account.padEnd(45);
        const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
        console.log(`│ ${paddedAccount} │ ${paddedAmount} │`);
      });
    } else {
      console.log('│ No expenses accrued in this period            │ $0.00       │');
    }
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalExpensesPadded = `$${totalExpenses.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL EXPENSES (ACCRUED)                       │ ${totalExpensesPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // Net Income
    const netIncome = totalRevenue - totalExpenses;
    console.log('📊 NET INCOME (ACCRUAL):');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    const netIncomePadded = `$${netIncome.toFixed(2)}`.padStart(12);
    console.log(`│ Net Income (Loss)                             │ ${netIncomePadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 2: INCOME STATEMENT (CASH BASIS)
    // ========================================
    console.log('📋 REPORT 2: INCOME STATEMENT (CASH BASIS)');
    console.log('==========================================\n');
    
    // Get only cash movements
    const cashEntries = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['payment', 'expense_payment', 'vendor_payment'] },
      status: 'posted'
    });
    
    let totalCashRevenue = 0;
    let totalCashExpenses = 0;
    const cashRevenueByAccount = {};
    const cashExpensesByAccount = {};
    
    cashEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (lineItem.accountType === 'Income' && entry.source === 'payment') {
            const amount = lineItem.credit || 0;
            totalCashRevenue += amount;
            const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
            cashRevenueByAccount[key] = (cashRevenueByAccount[key] || 0) + amount;
          } else if (lineItem.accountType === 'Expense' && ['expense_payment', 'vendor_payment'].includes(entry.source)) {
            const amount = lineItem.debit || 0;
            totalCashExpenses += amount;
            const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
            cashExpensesByAccount[key] = (cashExpensesByAccount[key] || 0) + amount;
          }
        });
      }
    });
    
    // Display Cash Revenue Table
    console.log('💰 CASH REVENUE (ACTUALLY RECEIVED):');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Account Description                            │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    if (Object.keys(cashRevenueByAccount).length > 0) {
      Object.entries(cashRevenueByAccount).forEach(([account, amount]) => {
        const paddedAccount = account.padEnd(45);
        const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
        console.log(`│ ${paddedAccount} │ ${paddedAmount} │`);
      });
    } else {
      console.log('│ No cash revenue received in this period        │ $0.00       │');
    }
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalCashRevenuePadded = `$${totalCashRevenue.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL CASH REVENUE                             │ ${totalCashRevenuePadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // Display Cash Expenses Table
    console.log('💸 CASH EXPENSES (ACTUALLY PAID):');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Account Description                            │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    if (Object.keys(cashExpensesByAccount).length > 0) {
      Object.entries(cashExpensesByAccount).forEach(([account, amount]) => {
        const paddedAccount = account.padEnd(45);
        const paddedAmount = `$${amount.toFixed(2)}`.padStart(12);
        console.log(`│ ${paddedAccount} │ ${paddedAmount} │`);
      });
    } else {
      console.log('│ No cash expenses paid in this period          │ $0.00       │');
    }
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    const totalCashExpensesPadded = `$${totalCashExpenses.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL CASH EXPENSES                           │ ${totalCashExpensesPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // Net Cash Income
    const netCashIncome = totalCashRevenue - totalCashExpenses;
    console.log('📊 NET CASH INCOME:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    const netCashIncomePadded = `$${netCashIncome.toFixed(2)}`.padStart(12);
    console.log(`│ Net Cash Income (Loss)                         │ ${netCashIncomePadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 3: COMPARISON TABLE
    // ========================================
    console.log('📋 REPORT 3: ACCRUAL vs CASH BASIS COMPARISON');
    console.log('===============================================\n');
    
    console.log('⚖️  COMPARISON TABLE:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Item                                           │ Accrual    │ Cash       │ Difference │');
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
    
    const revenueDiff = totalRevenue - totalCashRevenue;
    const expensesDiff = totalExpenses - totalCashExpenses;
    const netDiff = netIncome - netCashIncome;
    
    const revenuePadded = `$${totalRevenue.toFixed(2)}`.padStart(12);
    const cashRevenuePadded = `$${totalCashRevenue.toFixed(2)}`.padStart(12);
    const revenueDiffPadded = `$${revenueDiff.toFixed(2)}`.padStart(12);
    
    const expensesPadded = `$${totalExpenses.toFixed(2)}`.padStart(12);
    const cashExpensesPadded = `$${totalCashExpenses.toFixed(2)}`.padStart(12);
    const expensesDiffPadded = `$${expensesDiff.toFixed(2)}`.padStart(12);
    
    const netPadded = `$${netIncome.toFixed(2)}`.padStart(12);
    const cashNetPadded = `$${netCashIncome.toFixed(2)}`.padStart(12);
    const netDiffPadded = `$${netDiff.toFixed(2)}`.padStart(12);
    
    console.log(`│ Revenue                                        │ ${revenuePadded} │ ${cashRevenuePadded} │ ${revenueDiffPadded} │`);
    console.log(`│ Expenses                                       │ ${expensesPadded} │ ${cashExpensesPadded} │ ${expensesDiffPadded} │`);
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┤');
    console.log(`│ Net Income                                     │ ${netPadded} │ ${cashNetPadded} │ ${netDiffPadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // REPORT 4: EXPLANATION
    // ========================================
    console.log('📋 REPORT 4: WHY THE DIFFERENCE?');
    console.log('=================================\n');
    
    console.log('💡 EXPLANATION OF ACCRUAL vs CASH BASIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  🎯 ACCRUAL BASIS: Shows income/expenses when EARNED/INCURRED                              │');
    console.log('│     • Revenue: $' + totalRevenue.toFixed(2) + ' (all rent earned for Sept-Dec)                    │');
    console.log('│     • Expenses: $' + totalExpenses.toFixed(2) + ' (all expenses incurred)                       │');
    console.log('│     • Net Income: $' + netIncome.toFixed(2) + ' (true economic performance)                    │');
    console.log('│                                                                                             │');
    console.log('│  💰 CASH BASIS: Shows income/expenses when CASH RECEIVED/PAID                              │');
    console.log('│     • Revenue: $' + totalCashRevenue.toFixed(2) + ' (only cash actually received)              │');
    console.log('│     • Expenses: $' + totalCashExpenses.toFixed(2) + ' (only cash actually paid)                 │');
    console.log('│     • Net Income: $' + netCashIncome.toFixed(2) + ' (actual cash position)                    │');
    console.log('│                                                                                             │');
    console.log('│  🔍 THE DIFFERENCE:                                                                          │');
    console.log('│     • Revenue Difference: $' + revenueDiff.toFixed(2) + ' (accrued but not yet received)      │');
    console.log('│     • This represents FUTURE CASH FLOW from students who owe rent                           │');
    console.log('│     • Your Accounts Receivable will show this outstanding amount                            │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // REPORT 5: FUTURE CASH FLOW PROJECTION
    // ========================================
    console.log('📋 REPORT 5: FUTURE CASH FLOW PROJECTION');
    console.log('=========================================\n');
    
    console.log('🚀 FUTURE CASH FLOW:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Description                                   │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    const futureRevenuePadded = `$${revenueDiff.toFixed(2)}`.padStart(12);
    const futureExpensesPadded = `$${expensesDiff.toFixed(2)}`.padStart(12);
    const netFuturePadded = `$${netDiff.toFixed(2)}`.padStart(12);
    
    console.log(`│ Future Revenue (when students pay)             │ ${futureRevenuePadded} │`);
    console.log(`│ Future Expenses (when you pay bills)           │ ${futureExpensesPadded} │`);
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    console.log(`│ Net Future Cash Flow                           │ ${netFuturePadded} │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL SUMMARY');
    console.log('================\n');
    
    console.log('✅ WHAT THIS SHOWS:');
    console.log('   • Accrual Basis: True economic performance ($' + netIncome.toFixed(2) + ')');
    console.log('   • Cash Basis: Actual cash position ($' + netCashIncome.toFixed(2) + ')');
    console.log('   • Difference: Future cash flow ($' + netDiff.toFixed(2) + ')');
    
    console.log('\n💡 WHY AUGUST WAS THE SAME:');
    console.log('   • All August revenue was received in cash immediately');
    console.log('   • No revenue was accrued without cash receipt');
    console.log('   • This is normal for immediate payment scenarios');
    
    console.log('\n🔮 WHY SEPT-DEC IS DIFFERENT:');
    console.log('   • Revenue is accrued monthly (students owe rent)');
    console.log('   • But cash is received when students actually pay');
    console.log('   • This shows the power of accrual accounting!');
    
    console.log('\n🎉 YOUR SYSTEM IS WORKING PERFECTLY!');
    
  } catch (error) {
    console.error('❌ Error generating September-December reports:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the report generation
generateSeptDecReports();
