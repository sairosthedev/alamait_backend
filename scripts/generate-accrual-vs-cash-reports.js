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
 * GENERATE ACCRUAL VS CASH REPORTS
 * 
 * This script will generate comprehensive financial reports showing:
 * 1. Income Statement (Accrual Basis) - All revenues earned and expenses incurred
 * 2. Income Statement (Cash Basis) - Only cash received and paid
 * 3. Cash Flow Statement - Actual cash movements
 * 4. Detailed breakdown of what belongs in accrual vs cash
 */

async function generateAccrualVsCashReports() {
  try {
    console.log('\n📊 GENERATING ACCRUAL VS CASH REPORTS');
    console.log('========================================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: ACCRUAL BASIS INCOME STATEMENT
    // ========================================
    console.log('📋 STEP 1: INCOME STATEMENT (ACCRUAL BASIS)');
    console.log('============================================\n');
    
    // Get all rental accruals (revenue earned regardless of cash)
    const rentalAccruals = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'rental_accrual',
      status: 'posted'
    });
    
    // Get all expenses incurred (regardless of cash payment)
    const expenseAccruals = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['expense_payment', 'vendor_payment', 'manual'] },
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
    
    console.log('💰 ACCRUAL BASIS INCOME STATEMENT');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 REVENUES (EARNED REGARDLESS OF CASH):                                                   │');
    console.log(`│     • Rental Income (Accrued): $${totalAccrualRevenue.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  📉 EXPENSES (INCURRED REGARDLESS OF CASH):                                                 │');
    console.log(`│     • Operating Expenses: $${totalAccrualExpenses.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET INCOME (ACCRUAL):                                                                  │');
    console.log(`│     • Net Income: $${accrualNetIncome.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 2: CASH BASIS INCOME STATEMENT
    // ========================================
    console.log('📋 STEP 2: INCOME STATEMENT (CASH BASIS)');
    console.log('=========================================\n');
    
    // Get only cash receipts (actual money received)
    const cashReceipts = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    // Get only cash payments (actual money spent)
    const cashPayments = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: { $in: ['expense_payment', 'vendor_payment'] },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    // Calculate cash totals
    let totalCashReceived = 0;
    let totalCashPaid = 0;
    
    cashReceipts.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            totalCashReceived += lineItem.debit;
          }
        });
      }
    });
    
    cashPayments.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.credit > 0) {
            totalCashPaid += lineItem.credit;
          }
        });
      }
    });
    
    const cashNetIncome = totalCashReceived - totalCashPaid;
    
    console.log('💰 CASH BASIS INCOME STATEMENT');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 REVENUES (CASH ACTUALLY RECEIVED):                                                      │');
    console.log(`│     • Cash Received: $${totalCashReceived.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  📉 EXPENSES (CASH ACTUALLY PAID):                                                          │');
    console.log(`│     • Cash Paid: $${totalCashPaid.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET INCOME (CASH):                                                                      │');
    console.log(`│     • Net Cash Flow: $${cashNetIncome.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 3: CASH FLOW STATEMENT
    // ========================================
    console.log('📋 STEP 3: CASH FLOW STATEMENT');
    console.log('===============================\n');
    
    // Get all cash movements
    const allCashMovements = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    let totalCashInflows = 0;
    let totalCashOutflows = 0;
    
    allCashMovements.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              totalCashInflows += lineItem.debit;
            } else if (lineItem.credit > 0) {
              totalCashOutflows += lineItem.credit;
            }
          }
        });
      }
    });
    
    const netCashFlow = totalCashInflows - totalCashOutflows;
    
    console.log('💰 CASH FLOW STATEMENT');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  💰 CASH INFLOWS:                                                                           │');
    console.log(`│     • Total Cash Received: $${totalCashInflows.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💸 CASH OUTFLOWS:                                                                         │');
    console.log(`│     • Total Cash Paid: $${totalCashOutflows.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET CASH FLOW:                                                                          │');
    console.log(`│     • Net Change in Cash: $${netCashFlow.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 4: ACCRUAL VS CASH COMPARISON
    // ========================================
    console.log('📋 STEP 4: ACCRUAL VS CASH COMPARISON');
    console.log('======================================\n');
    
    console.log('🔍 KEY DIFFERENCES: ACCRUAL VS CASH');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 REVENUE DIFFERENCE:                                                                     │');
    console.log(`│     • Accrual Revenue: $${totalAccrualRevenue.toFixed(2)} (EARNED)                              │`);
    console.log(`│     • Cash Revenue: $${totalCashReceived.toFixed(2)} (RECEIVED)                               │`);
    console.log(`│     • Difference: $${(totalAccrualRevenue - totalCashReceived).toFixed(2)} (ACCOUNTS RECEIVABLE) │`);
    console.log('│                                                                                             │');
    console.log('│  📊 EXPENSE DIFFERENCE:                                                                     │');
    console.log(`│     • Accrual Expenses: $${totalAccrualExpenses.toFixed(2)} (INCURRED)                         │`);
    console.log(`│     • Cash Expenses: $${totalCashPaid.toFixed(2)} (PAID)                                      │`);
    console.log(`│     • Difference: $${(totalAccrualExpenses - totalCashPaid).toFixed(2)} (ACCOUNTS PAYABLE)     │`);
    console.log('│                                                                                             │');
    console.log('│  📊 NET INCOME DIFFERENCE:                                                                  │');
    console.log(`│     • Accrual Net Income: $${accrualNetIncome.toFixed(2)}                                      │`);
    console.log(`│     • Cash Net Income: $${cashNetIncome.toFixed(2)}                                           │`);
    console.log(`│     • Difference: $${(accrualNetIncome - cashNetIncome).toFixed(2)}                           │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: DETAILED BREAKDOWN BY SOURCE
    // ========================================
    console.log('📋 STEP 5: DETAILED BREAKDOWN BY SOURCE');
    console.log('========================================\n');
    
    // Group cash movements by source
    const cashBySource = {};
    
    allCashMovements.forEach(entry => {
      const source = entry.source || 'unknown';
      if (!cashBySource[source]) {
        cashBySource[source] = { inflows: 0, outflows: 0 };
      }
      
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              cashBySource[source].inflows += lineItem.debit;
            } else if (lineItem.credit > 0) {
              cashBySource[source].outflows += lineItem.credit;
            }
          }
        });
      }
    });
    
    console.log('💰 CASH MOVEMENTS BY SOURCE');
    console.log('┌─────────────────────────┬─────────────────┬─────────────────┬─────────────────┐');
    console.log('│ Source                  │ Cash Inflows    │ Cash Outflows   │ Net Cash Flow   │');
    console.log('├─────────────────────────┼─────────────────┼─────────────────┼─────────────────┤');
    
    Object.keys(cashBySource).forEach(source => {
      const data = cashBySource[source];
      const netFlow = data.inflows - data.outflows;
      const sourcePadded = source.padEnd(23);
      const inflowsPadded = `$${data.inflows.toFixed(2)}`.padStart(15);
      const outflowsPadded = `$${data.outflows.toFixed(2)}`.padStart(15);
      const netFlowPadded = `$${netFlow.toFixed(2)}`.padStart(15);
      
      console.log(`│ ${sourcePadded} │ ${inflowsPadded} │ ${outflowsPadded} │ ${netFlowPadded} │`);
    });
    
    console.log('├─────────────────────────┼─────────────────┼─────────────────┼─────────────────┤');
    const totalInflowsPadded = `$${totalCashInflows.toFixed(2)}`.padStart(15);
    const totalOutflowsPadded = `$${totalCashOutflows.toFixed(2)}`.padStart(15);
    const totalNetPadded = `$${netCashFlow.toFixed(2)}`.padStart(15);
    console.log(`│ TOTAL                   │ ${totalInflowsPadded} │ ${totalOutflowsPadded} │ ${totalNetPadded} │`);
    console.log('└─────────────────────────┴─────────────────┴─────────────────┴─────────────────┘\n');
    
    // ========================================
    // STEP 6: STUDENT PAYMENT SUMMARY
    // ========================================
    console.log('📋 STEP 6: STUDENT PAYMENT SUMMARY');
    console.log('===================================\n');
    
    const debtors = await Debtor.find({});
    
    console.log('👥 STUDENT PAYMENT STATUS');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code │ Total Owed  │ Total Paid  │ Balance     │ Status      │ Cash Basis  │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalOwed = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    
    debtors.forEach(debtor => {
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      const totalOwedAmount = debtor.totalOwed || 0;
      const totalPaidAmount = debtor.totalPaid || 0;
      const balance = debtor.currentBalance || 0;
      
      totalOwed += totalOwedAmount;
      totalPaid += totalPaidAmount;
      totalBalance += balance;
      
      const totalOwedPadded = `$${totalOwedAmount.toFixed(2)}`.padStart(12);
      const totalPaidPadded = `$${totalPaidAmount.toFixed(2)}`.padStart(12);
      const balancePadded = `$${balance.toFixed(2)}`.padStart(12);
      
      let status = 'Unknown';
      if (balance === 0) {
        status = '✅ PAID IN FULL'.padEnd(12);
      } else if (balance > 0) {
        status = '⚠️  OUTSTANDING'.padEnd(12);
      } else {
        status = '❌ OVERPAID'.padEnd(12);
      }
      
      let cashBasis = 'N/A';
      if (totalPaidAmount > 0) {
        cashBasis = '💰 CASH RECEIVED'.padEnd(12);
      } else {
        cashBasis = '📊 ACCRUAL ONLY'.padEnd(12);
      }
      
      console.log(`│ ${code} │ ${totalOwedPadded} │ ${totalPaidPadded} │ ${balancePadded} │ ${status} │ ${cashBasis} │`);
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalOwedPadded = `$${totalOwed.toFixed(2)}`.padStart(12);
    const totalPaidPadded = `$${totalPaid.toFixed(2)}`.padStart(12);
    const totalBalancePadded = `$${totalBalance.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │ ${totalOwedPadded} │ ${totalPaidPadded} │ ${totalBalancePadded} │             │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // STEP 7: FINAL SUMMARY
    // ========================================
    console.log('📋 STEP 7: FINAL SUMMARY');
    console.log('=========================\n');
    
    console.log('🎯 ACCOUNTING BASIS SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 ACCRUAL BASIS (What Should Be):                                                        │');
    console.log('│     • Records revenues when EARNED (rental accruals)                                        │');
    console.log('│     • Records expenses when INCURRED (WiFi, utilities, etc.)                                │');
    console.log('│     • Shows true profitability regardless of cash timing                                    │');
    console.log('│     • Includes accounts receivable and payable                                               │');
    console.log('│                                                                                             │');
    console.log('│  💰 CASH BASIS (What Actually Happened):                                                   │');
    console.log('│     • Records revenues when CASH RECEIVED (student payments)                                │');
    console.log('│     • Records expenses when CASH PAID (vendor payments)                                     │');
    console.log('│     • Shows actual cash position                                                            │');
    console.log('│     • No accounts receivable or payable                                                     │');
    console.log('│                                                                                             │');
    console.log('│  🔍 KEY INSIGHT:                                                                             │');
    console.log('│     • Accrual shows you earned $' + totalAccrualRevenue.toFixed(2) + ' but only received $' + totalCashReceived.toFixed(2) + ' in cash │');
    console.log('│     • The difference ($' + (totalAccrualRevenue - totalCashReceived).toFixed(2) + ') is what students still owe you (accounts receivable) │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error generating reports:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the report generation
generateAccrualVsCashReports();
