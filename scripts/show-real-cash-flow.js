const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');
const TransactionEntry = require('../src/models/TransactionEntry');

async function showRealCashFlow() {
  try {
    console.log('\n💰 REAL CASH FLOW ANALYSIS (ACTUAL MONEY MOVEMENTS ONLY)');
    console.log('==========================================================\n');
    
    const now = new Date();
    
    // ========================================
    // REAL CASH INFLOWS (Money Actually Received)
    // ========================================
    console.log('📥 REAL CASH INFLOWS (Money Actually Received)');
    console.log('==============================================');
    
    // 1. From Payment collection (confirmed payments)
    const actualPayments = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    const totalCashInFromPayments = actualPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    console.log(`   💳 Confirmed Payments: $${totalCashInFromPayments.toFixed(2)} (${actualPayments.length} payments)`);
    
    // 2. From TransactionEntry - ONLY real cash inflows (exclude accruals, reversals, etc.)
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    let realCashInflows = 0;
    let realCashOutflows = 0;
    let cashInflowDetails = [];
    let cashOutflowDetails = [];
    
    console.log('\n🔍 ANALYZING TRANSACTION ENTRIES FOR REAL CASH MOVEMENTS:');
    
    transactionEntries.forEach((tx, idx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          // ========================================
          // FILTER FOR REAL CASH MOVEMENTS ONLY
          // ========================================
          
          // REAL CASH INFLOWS (money actually received)
          if (credit > 0 && isRealCashInflow(accountCode, accountName, tx.source)) {
            realCashInflows += credit;
            cashInflowDetails.push({
              accountCode,
              accountName,
              amount: credit,
              source: tx.source,
              date: tx.date,
              description: tx.description
            });
          }
          
          // REAL CASH OUTFLOWS (money actually spent)
          if (debit > 0 && isRealCashOutflow(accountCode, accountName, tx.source)) {
            realCashOutflows += debit;
            cashOutflowDetails.push({
              accountCode,
              accountName,
              amount: debit,
              source: tx.source,
              date: tx.date,
              description: tx.description
            });
          }
        });
      }
    });
    
    console.log(`   💰 REAL Cash Inflows from Transactions: $${realCashInflows.toFixed(2)}`);
    console.log(`   💸 REAL Cash Outflows from Transactions: $${realCashOutflows.toFixed(2)}`);
    
    // ========================================
    // REAL CASH OUTFLOWS (Money Actually Spent)
    // ========================================
    console.log('\n📤 REAL CASH OUTFLOWS (Money Actually Spent)');
    console.log('==============================================');
    
    // From Expense collection (paid expenses)
    const paidExpenses = await Expense.find({
      expenseDate: { $lte: now },
      paymentStatus: 'Paid'
    });
    const totalCashOutFromExpenses = paidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log(`   📋 Paid Expenses: $${totalCashOutFromExpenses.toFixed(2)} (${paidExpenses.length} expenses)`);
    
    // ========================================
    // FINAL REAL CASH FLOW CALCULATION
    // ========================================
    const totalRealCashIn = totalCashInFromPayments + realCashInflows;
    const totalRealCashOut = totalCashOutFromExpenses + realCashOutflows;
    const netRealCashFlow = totalRealCashIn - totalRealCashOut;
    
    console.log('\n💰 FINAL REAL CASH FLOW CALCULATION');
    console.log('====================================');
    console.log(`   📥 TOTAL REAL CASH INFLOWS:  $${totalRealCashIn.toFixed(2)}`);
    console.log(`      ├─ Confirmed Payments:     $${totalCashInFromPayments.toFixed(2)}`);
    console.log(`      └─ Real Cash Inflows:     $${realCashInflows.toFixed(2)}`);
    console.log(`   📤 TOTAL REAL CASH OUTFLOWS: $${totalRealCashOut.toFixed(2)}`);
    console.log(`      ├─ Paid Expenses:         $${totalCashOutFromExpenses.toFixed(2)}`);
    console.log(`      └─ Real Cash Outflows:    $${realCashOutflows.toFixed(2)}`);
    console.log(`   💵 NET REAL CASH FLOW:       $${netRealCashFlow.toFixed(2)}`);
    
    // ========================================
    // DETAILED BREAKDOWN
    // ========================================
    console.log('\n📊 DETAILED REAL CASH INFLOWS:');
    cashInflowDetails
      .sort((a, b) => b.amount - a.amount)
      .forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
        console.log(`      Source: ${item.source} | Date: ${item.date.toDateString()}`);
      });
    
    console.log('\n💸 DETAILED REAL CASH OUTFLOWS:');
    cashOutflowDetails
      .sort((a, b) => b.amount - a.amount)
      .forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
        console.log(`      Source: ${item.source} | Date: ${item.date.toDateString()}`);
      });
    
    // ========================================
    // SUMMARY & ASSESSMENT
    // ========================================
    console.log('\n📋 REAL CASH FLOW SUMMARY:');
    console.log('============================');
    
    if (netRealCashFlow > 0) {
      console.log(`✅ POSITIVE CASH FLOW: You have $${netRealCashFlow.toFixed(2)} more cash than you started with`);
    } else if (netRealCashFlow < 0) {
      console.log(`❌ NEGATIVE CASH FLOW: You have $${Math.abs(netRealCashFlow).toFixed(2)} less cash than you started with`);
    } else {
      console.log(`⚖️  BALANCED CASH FLOW: Cash in equals cash out`);
    }
    
    const cashFlowRatio = totalRealCashOut > 0 ? totalRealCashIn / totalRealCashOut : 0;
    console.log(`📊 Cash Flow Ratio: ${cashFlowRatio.toFixed(2)} (${cashFlowRatio > 1 ? 'Good' : 'Needs attention'})`);
    
    console.log('\n✅ Real cash flow analysis complete!');
    console.log('   This shows ONLY actual money movements, excluding accounting entries and accruals');
    
  } catch (error) {
    console.error('❌ Error showing real cash flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper function to identify REAL cash inflows
function isRealCashInflow(accountCode, accountName, source) {
  // Real cash inflows are typically:
  // - Bank deposits
  // - Cash receipts
  // - Money actually received
  
  // Exclude accounting entries like:
  // - Accounts receivable (money owed but not received)
  // - Accruals
  // - Reversals
  // - Internal transfers
  
  const realCashAccounts = [
    '1001', // Bank Account
    '1002', // Cash on Hand
    '1011'  // Admin Petty Cash
  ];
  
  const excludeSources = [
    'rental_accrual',
    'rental_accrual_reversal', 
    'expense_accrual',
    'expense_accrual_reversal',
    'adjustment'
  ];
  
  return realCashAccounts.includes(accountCode) && !excludeSources.includes(source);
}

// Helper function to identify REAL cash outflows  
function isRealCashOutflow(accountCode, accountName, source) {
  // Real cash outflows are typically:
  // - Bank withdrawals
  // - Cash payments
  // - Money actually spent
  
  // Exclude accounting entries like:
  // - Accounts payable (money owed but not paid)
  // - Accruals
  // - Reversals
  // - Internal transfers
  
  const realCashAccounts = [
    '1001', // Bank Account
    '1002', // Cash on Hand
    '1011'  // Admin Petty Cash
  ];
  
  const excludeSources = [
    'rental_accrual',
    'rental_accrual_reversal',
    'expense_accrual', 
    'expense_accrual_reversal',
    'adjustment'
  ];
  
  return realCashAccounts.includes(accountCode) && !excludeSources.includes(source);
}

// Run the real cash flow analysis
showRealCashFlow();
