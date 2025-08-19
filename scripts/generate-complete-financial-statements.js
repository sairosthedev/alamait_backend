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
 * GENERATE COMPLETE FINANCIAL STATEMENTS
 * 
 * This script will generate:
 * 1. Income Statement (Accrual Basis)
 * 2. Income Statement (Cash Basis) - including the $500 expense paid
 * 3. Balance Sheet
 * 4. Cash Flow Statement
 */

async function generateCompleteFinancialStatements() {
  try {
    console.log('\n📊 GENERATING COMPLETE FINANCIAL STATEMENTS');
    console.log('============================================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: INCOME STATEMENT (ACCRUAL BASIS)
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
    
    console.log('💰 INCOME STATEMENT (ACCRUAL BASIS)');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 REVENUES:                                                                               │');
    console.log(`│     • Rental Income (Accrued): $${totalAccrualRevenue.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  📉 EXPENSES:                                                                               │');
    console.log(`│     • Operating Expenses: $${totalAccrualExpenses.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET INCOME (ACCRUAL):                                                                  │');
    console.log(`│     • Net Income: $${accrualNetIncome.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 2: INCOME STATEMENT (CASH BASIS)
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
    
    // Get only cash payments (actual money spent) - including the $500 expense
    const cashPayments = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
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
    
    console.log('💰 INCOME STATEMENT (CASH BASIS)');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📈 REVENUES:                                                                               │');
    console.log(`│     • Cash Received: $${totalCashReceived.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  📉 EXPENSES:                                                                               │');
    console.log(`│     • Cash Paid: $${totalCashPaid.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET INCOME (CASH):                                                                      │');
    console.log(`│     • Net Cash Flow: $${cashNetIncome.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 3: BALANCE SHEET
    // ========================================
    console.log('📋 STEP 3: BALANCE SHEET');
    console.log('=========================\n');
    
    // Get all current balances
    const allEntries = await TransactionEntry.find({
      status: 'posted'
    });
    
    let assets = {
      cash: 0,
      accountsReceivable: 0,
      deposits: 0
    };
    
    let liabilities = {
      accountsPayable: 0,
      depositsHeld: 0
    };
    
    let equity = {
      retainedEarnings: 0,
      currentPeriod: accrualNetIncome
    };
    
    // Calculate asset balances
    allEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          // Cash accounts
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              assets.cash += lineItem.debit;
            } else if (lineItem.credit > 0) {
              assets.cash -= lineItem.credit;
            }
          }
          
          // Accounts Receivable
          if (['1100', '1101'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              assets.accountsReceivable += lineItem.debit;
            } else if (lineItem.credit > 0) {
              assets.accountsReceivable -= lineItem.credit;
            }
          }
          
          // Deposits
          if (['2020'].includes(lineItem.accountCode)) {
            if (lineItem.credit > 0) {
              assets.deposits += lineItem.credit;
            } else if (lineItem.debit > 0) {
              assets.deposits -= lineItem.debit;
            }
          }
          
          // Accounts Payable
          if (['2000'].includes(lineItem.accountCode)) {
            if (lineItem.credit > 0) {
              liabilities.accountsPayable += lineItem.credit;
            } else if (lineItem.debit > 0) {
              liabilities.accountsPayable -= lineItem.debit;
            }
          }
        });
      }
    });
    
    // Calculate total assets, liabilities, and equity
    const totalAssets = assets.cash + assets.accountsReceivable + assets.deposits;
    const totalLiabilities = liabilities.accountsPayable + liabilities.depositsHeld;
    const totalEquity = equity.retainedEarnings + equity.currentPeriod;
    
    console.log('💰 BALANCE SHEET');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  💰 ASSETS:                                                                                 │');
    console.log(`│     • Cash & Cash Equivalents: $${assets.cash.toFixed(2)}                                        │`);
    console.log(`│     • Accounts Receivable: $${assets.accountsReceivable.toFixed(2)}                                        │`);
    console.log(`│     • Deposits: $${assets.deposits.toFixed(2)}                                        │`);
    console.log(`│     • Total Assets: $${totalAssets.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💸 LIABILITIES:                                                                           │');
    console.log(`│     • Accounts Payable: $${liabilities.accountsPayable.toFixed(2)}                                        │`);
    console.log(`│     • Deposits Held: $${liabilities.depositsHeld.toFixed(2)}                                        │`);
    console.log(`│     • Total Liabilities: $${totalLiabilities.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 EQUITY:                                                                                 │');
    console.log(`│     • Retained Earnings: $${equity.retainedEarnings.toFixed(2)}                                        │`);
    console.log(`│     • Current Period: $${equity.currentPeriod.toFixed(2)}                                        │`);
    console.log(`│     • Total Equity: $${totalEquity.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🔍 BALANCE CHECK:                                                                          │');
    console.log(`│     • Assets = Liabilities + Equity: $${totalAssets.toFixed(2)} = $${totalLiabilities.toFixed(2)} + $${totalEquity.toFixed(2)} │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 4: CASH FLOW STATEMENT
    // ========================================
    console.log('📋 STEP 4: CASH FLOW STATEMENT');
    console.log('===============================\n');
    
    // Get all cash movements
    const allCashMovements = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      status: 'posted'
    });
    
    let operatingActivities = {
      cashInflows: 0,
      cashOutflows: 0
    };
    
    let investingActivities = {
      cashInflows: 0,
      cashOutflows: 0
    };
    
    let financingActivities = {
      cashInflows: 0,
      cashOutflows: 0
    };
    
    // Categorize cash flows
    allCashMovements.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode)) {
            if (lineItem.debit > 0) {
              // Cash inflow
              if (entry.source === 'payment') {
                operatingActivities.cashInflows += lineItem.debit;
              } else {
                operatingActivities.cashInflows += lineItem.debit;
              }
            } else if (lineItem.credit > 0) {
              // Cash outflow
              if (entry.source === 'expense_payment' || entry.source === 'vendor_payment') {
                operatingActivities.cashOutflows += lineItem.credit;
              } else {
                operatingActivities.cashOutflows += lineItem.credit;
              }
            }
          }
        });
      }
    });
    
    const netOperatingCashFlow = operatingActivities.cashInflows - operatingActivities.cashOutflows;
    const netCashFlow = netOperatingCashFlow + (investingActivities.cashInflows - investingActivities.cashOutflows) + (financingActivities.cashInflows - financingActivities.cashOutflows);
    
    console.log('💰 CASH FLOW STATEMENT');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  💰 OPERATING ACTIVITIES:                                                                   │');
    console.log(`│     • Cash Inflows: $${operatingActivities.cashInflows.toFixed(2)}                                        │`);
    console.log(`│     • Cash Outflows: $${operatingActivities.cashOutflows.toFixed(2)}                                        │`);
    console.log(`│     • Net Operating Cash Flow: $${netOperatingCashFlow.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💰 INVESTING ACTIVITIES:                                                                   │');
    console.log(`│     • Cash Inflows: $${investingActivities.cashInflows.toFixed(2)}                                        │`);
    console.log(`│     • Cash Outflows: $${investingActivities.cashOutflows.toFixed(2)}                                        │`);
    console.log(`│     • Net Investing Cash Flow: $${(investingActivities.cashInflows - investingActivities.cashOutflows).toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💰 FINANCING ACTIVITIES:                                                                   │');
    console.log(`│     • Cash Inflows: $${financingActivities.cashInflows.toFixed(2)}                                        │`);
    console.log(`│     • Cash Outflows: $${financingActivities.cashOutflows.toFixed(2)}                                        │`);
    console.log(`│     • Net Financing Cash Flow: $${(financingActivities.cashInflows - financingActivities.cashOutflows).toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  🎯 NET CASH FLOW:                                                                          │');
    console.log(`│     • Net Change in Cash: $${netCashFlow.toFixed(2)}                                        │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: CASH BASIS EXPENSE DETAIL
    // ========================================
    console.log('📋 STEP 5: CASH BASIS EXPENSE DETAIL');
    console.log('=====================================\n');
    
    // Find the specific $500 expense that was paid
    const paidExpenses = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      'entries.credit': { $gt: 0 },
      status: 'posted'
    });
    
    console.log('💰 EXPENSES INCLUDED IN CASH BASIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📉 CASH EXPENSES (Money Actually Left Your Bank):                                          │');
    
    if (paidExpenses.length > 0) {
      paidExpenses.forEach(expense => {
        if (expense.entries && Array.isArray(expense.entries)) {
          expense.entries.forEach(lineItem => {
            if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.credit > 0) {
              console.log(`│     • ${expense.description || 'Unknown'}: $${lineItem.credit.toFixed(2)}                                        │`);
            }
          });
        }
      });
    } else {
      console.log('│     • No cash expenses found                                                              │');
    }
    
    console.log(`│     • Total Cash Expenses: $${totalCashPaid.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💡 WHY THIS MATTERS:                                                                       │');
    console.log('│     • Accrual basis shows ALL expenses incurred ($${totalAccrualExpenses.toFixed(2)})                    │');
    console.log('│     • Cash basis shows ONLY expenses paid ($${totalCashPaid.toFixed(2)})                              │');
    console.log('│     • The difference is your accounts payable                                                │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 6: FINAL SUMMARY
    // ========================================
    console.log('📋 STEP 6: FINAL SUMMARY');
    console.log('=========================\n');
    
    console.log('🎯 FINANCIAL STATEMENTS SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 INCOME STATEMENTS:                                                                      │');
    console.log(`│     • Accrual Basis Net Income: $${accrualNetIncome.toFixed(2)}                                      │`);
    console.log(`│     • Cash Basis Net Income: $${cashNetIncome.toFixed(2)}                                           │`);
    console.log(`│     • Difference: $${(accrualNetIncome - cashNetIncome).toFixed(2)} (Accounts Receivable - Payable) │`);
    console.log('│                                                                                             │');
    console.log('│  💰 BALANCE SHEET:                                                                          │');
    console.log(`│     • Total Assets: $${totalAssets.toFixed(2)}                                        │`);
    console.log(`│     • Total Liabilities: $${totalLiabilities.toFixed(2)}                                        │`);
    console.log(`│     • Total Equity: $${totalEquity.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💰 CASH FLOW:                                                                              │');
    console.log(`│     • Net Operating Cash Flow: $${netOperatingCashFlow.toFixed(2)}                                        │`);
    console.log(`│     • Net Change in Cash: $${netCashFlow.toFixed(2)}                                        │`);
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error generating financial statements:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the financial statement generation
generateCompleteFinancialStatements();
