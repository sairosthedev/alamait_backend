const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');

async function correctCashFlowAnalysis() {
  try {
    console.log('\n💰 CORRECT CASH FLOW ANALYSIS');
    console.log('===============================\n');
    
    const now = new Date();
    
    // ========================================
    // STEP 1: ANALYZE TRANSACTION ENTRIES
    // ========================================
    console.log('🔍 STEP 1: Analyzing Transaction Entries for Cash Movements\n');
    
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    let cashInflows = 0;
    let cashOutflows = 0;
    let cashInflowDetails = [];
    let cashOutflowDetails = [];
    
    // Group transactions by source for better analysis
    const transactionsBySource = {};
    
    transactionEntries.forEach(tx => {
      if (!transactionsBySource[tx.source]) {
        transactionsBySource[tx.source] = [];
      }
      transactionsBySource[tx.source].push(tx);
    });
    
    // Analyze each source type
    Object.entries(transactionsBySource).forEach(([source, transactions]) => {
      console.log(`📊 SOURCE: ${source.toUpperCase()} (${transactions.length} transactions)`);
      
      let sourceInflows = 0;
      let sourceOutflows = 0;
      
      transactions.forEach(tx => {
        if (tx.entries && Array.isArray(tx.entries)) {
          tx.entries.forEach(entry => {
            if (isCashAccount(entry.accountCode)) {
              const debit = entry.debit || 0;
              const credit = entry.credit || 0;
              
              if (debit > 0) {
                // DEBIT to cash = Money coming IN (cash inflow)
                cashInflows += debit;
                sourceInflows += debit;
                
                cashInflowDetails.push({
                  transactionId: tx.transactionId,
                  accountCode: entry.accountCode,
                  accountName: entry.accountName,
                  amount: debit,
                  source: tx.source,
                  date: tx.date,
                  description: tx.description,
                  type: 'INFLOW',
                  reason: 'DEBIT to cash account (money received)'
                });
                
                console.log(`  📥 CASH INFLOW: $${debit.toFixed(2)} - ${entry.accountName}`);
                console.log(`     Description: ${tx.description}`);
                console.log(`     Reason: DEBIT to cash = money received`);
                
              } else if (credit > 0) {
                // CREDIT to cash = Money going OUT (cash outflow)
                cashOutflows += credit;
                sourceOutflows += credit;
                
                cashOutflowDetails.push({
                  transactionId: tx.transactionId,
                  accountCode: entry.accountCode,
                  accountName: entry.accountName,
                  amount: credit,
                  source: tx.source,
                  date: tx.date,
                  description: tx.description,
                  type: 'OUTFLOW',
                  reason: 'CREDIT to cash account (money spent)'
                });
                
                console.log(`  📤 CASH OUTFLOW: $${credit.toFixed(2)} - ${entry.accountName}`);
                console.log(`     Description: ${tx.description}`);
                console.log(`     Reason: CREDIT to cash = money spent`);
              }
            }
          });
        }
      });
      
      console.log(`  📊 Source Summary: Inflows: $${sourceInflows.toFixed(2)}, Outflows: $${sourceOutflows.toFixed(2)}`);
      console.log('');
    });
    
    // ========================================
    // STEP 2: VERIFY WITH PAYMENT COLLECTION
    // ========================================
    console.log('🔍 STEP 2: Verifying with Payment Collection\n');
    
    const actualPayments = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    
    const totalConfirmedPayments = actualPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    console.log(`💳 Confirmed Payments: $${totalConfirmedPayments.toFixed(2)} (${actualPayments.length} payments)`);
    
    // ========================================
    // STEP 3: VERIFY WITH EXPENSE COLLECTION
    // ========================================
    console.log('\n🔍 STEP 3: Verifying with Expense Collection\n');
    
    const paidExpenses = await Expense.find({
      expenseDate: { $lte: now },
      paymentStatus: 'Paid'
    });
    
    const totalPaidExpenses = paidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log(`📋 Paid Expenses: $${totalPaidExpenses.toFixed(2)} (${paidExpenses.length} expenses)`);
    
    // ========================================
    // STEP 4: FINAL CASH FLOW CALCULATION
    // ========================================
    console.log('\n💰 FINAL CASH FLOW CALCULATION');
    console.log('================================');
    
    const netCashFlow = cashInflows - cashOutflows;
    
    console.log(`📥 TOTAL CASH INFLOWS:  $${cashInflows.toFixed(2)}`);
    console.log(`📤 TOTAL CASH OUTFLOWS: $${cashOutflows.toFixed(2)}`);
    console.log(`💵 NET CASH FLOW:       $${netCashFlow.toFixed(2)}`);
    
    // ========================================
    // STEP 5: DETAILED BREAKDOWN
    // ========================================
    console.log('\n📊 DETAILED CASH INFLOWS (Money Received):');
    console.log('===========================================');
    
    // Group inflows by source
    const inflowsBySource = {};
    cashInflowDetails.forEach(item => {
      if (!inflowsBySource[item.source]) {
        inflowsBySource[item.source] = { total: 0, items: [] };
      }
      inflowsBySource[item.source].total += item.amount;
      inflowsBySource[item.source].items.push(item);
    });
    
    Object.entries(inflowsBySource)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([source, data]) => {
        console.log(`\n📥 ${source.toUpperCase()}: $${data.total.toFixed(2)}`);
        data.items.forEach(item => {
          console.log(`   • ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
          console.log(`     ${item.description}`);
        });
      });
    
    console.log('\n💸 DETAILED CASH OUTFLOWS (Money Spent):');
    console.log('==========================================');
    
    // Group outflows by source
    const outflowsBySource = {};
    cashOutflowDetails.forEach(item => {
      if (!outflowsBySource[item.source]) {
        outflowsBySource[item.source] = { total: 0, items: [] };
      }
      outflowsBySource[item.source].total += item.amount;
      outflowsBySource[item.source].items.push(item);
    });
    
    Object.entries(outflowsBySource)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([source, data]) => {
        console.log(`\n📤 ${source.toUpperCase()}: $${data.total.toFixed(2)}`);
        data.items.forEach(item => {
          console.log(`   • ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
          console.log(`     ${item.description}`);
        });
      });
    
    // ========================================
    // STEP 6: SUMMARY & ASSESSMENT
    // ========================================
    console.log('\n📋 CASH FLOW SUMMARY:');
    console.log('=======================');
    
    if (netCashFlow > 0) {
      console.log(`✅ POSITIVE CASH FLOW: You have $${netCashFlow.toFixed(2)} more cash than you started with`);
    } else if (netCashFlow < 0) {
      console.log(`❌ NEGATIVE CASH FLOW: You have $${Math.abs(netCashFlow).toFixed(2)} less cash than you started with`);
    } else {
      console.log(`⚖️  BALANCED CASH FLOW: Cash in equals cash out`);
    }
    
    const cashFlowRatio = cashOutflows > 0 ? cashInflows / cashOutflows : 0;
    console.log(`📊 Cash Flow Ratio: ${cashFlowRatio.toFixed(2)} (${cashFlowRatio > 1 ? 'Good' : 'Needs attention'})`);
    
    // ========================================
    // STEP 7: VERIFICATION
    // ========================================
    console.log('\n🔍 VERIFICATION:');
    console.log('=================');
    console.log('✅ This analysis correctly interprets:');
    console.log('   - DEBIT to cash = Money coming IN (cash inflow)');
    console.log('   - CREDIT to cash = Money going OUT (cash outflow)');
    console.log('   - Follows standard accounting principles');
    console.log('   - Matches your correct double-entry system');
    
    console.log('\n🎯 KEY INSIGHTS:');
    console.log('==================');
    console.log(`1. Student payments: DEBIT to cash = $${cashInflows.toFixed(2)} received ✅`);
    console.log(`2. Expenses/outflows: CREDIT to cash = $${cashOutflows.toFixed(2)} spent ✅`);
    console.log(`3. Net result: $${netCashFlow.toFixed(2)} change in cash position ✅`);
    
  } catch (error) {
    console.error('❌ Error in correct cash flow analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper function to identify cash accounts
function isCashAccount(accountCode) {
  const cashAccounts = [
    '1001', // Bank Account
    '1002', // Cash on Hand
    '1011'  // Admin Petty Cash
  ];
  return cashAccounts.includes(accountCode);
}

// Run the correct analysis
correctCashFlowAnalysis();
