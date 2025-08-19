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

async function finalCorrectedCashFlow() {
  try {
    console.log('\n💰 FINAL CORRECTED CASH FLOW ANALYSIS');
    console.log('========================================\n');
    
    const now = new Date();
    
    // ========================================
    // CASH INFLOWS (Money Actually Received)
    // ========================================
    console.log('📥 CASH INFLOWS (Money Actually Received)');
    console.log('==========================================');
    
    // 1. From Payment collection (confirmed payments)
    const actualPayments = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    const totalCashInFromPayments = actualPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    console.log(`   💳 Confirmed Payments: $${totalCashInFromPayments.toFixed(2)} (${actualPayments.length} payments)`);
    
    // 2. From TransactionEntry - Analyze each transaction properly
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    let cashInflows = 0;
    let cashOutflows = 0;
    let cashInflowDetails = [];
    let cashOutflowDetails = [];
    
    console.log('\n🔍 ANALYZING TRANSACTION ENTRIES FOR CASH MOVEMENTS:\n');
    
    transactionEntries.forEach((tx, txIdx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        // ========================================
        // PROPER DOUBLE-ENTRY ANALYSIS
        // ========================================
        
        // Find cash account entries in this transaction
        const cashEntries = tx.entries.filter(entry => isCashAccount(entry.accountCode));
        const nonCashEntries = tx.entries.filter(entry => !isCashAccount(entry.accountCode));
        
        if (cashEntries.length > 0) {
          cashEntries.forEach(cashEntry => {
            const accountCode = cashEntry.accountCode;
            const accountName = cashEntry.accountName;
            const debit = cashEntry.debit || 0;
            const credit = cashEntry.credit || 0;
            
            // ========================================
            // CASH INFLOW: Credit to cash account (money received)
            // ========================================
            if (credit > 0) {
              // This is money coming INTO cash
              cashInflows += credit;
              cashInflowDetails.push({
                transactionId: tx.transactionId,
                accountCode,
                accountName,
                amount: credit,
                source: tx.source,
                date: tx.date,
                description: tx.description,
                type: 'INFLOW',
                relatedAccount: findRelatedAccount(nonCashEntries, 'debit')
              });
              
              console.log(`📥 CASH INFLOW: ${accountCode} - ${accountName}`);
              console.log(`   Amount: $${credit.toFixed(2)} | Source: ${tx.source}`);
              console.log(`   Description: ${tx.description}`);
              console.log(`   Related Account: ${findRelatedAccount(nonCashEntries, 'debit')}`);
              console.log(`   Running Total: $${cashInflows.toFixed(2)}\n`);
            }
            
            // ========================================
            // CASH OUTFLOW: Debit to cash account (money spent)
            // ========================================
            if (debit > 0) {
              // This is money going OUT of cash
              cashOutflows += debit;
              cashOutflowDetails.push({
                transactionId: tx.transactionId,
                accountCode,
                accountName,
                amount: debit,
                source: tx.source,
                date: tx.date,
                description: tx.description,
                type: 'OUTFLOW',
                relatedAccount: findRelatedAccount(nonCashEntries, 'credit')
              });
              
              console.log(`📤 CASH OUTFLOW: ${accountCode} - ${accountName}`);
              console.log(`   Amount: $${debit.toFixed(2)} | Source: ${tx.source}`);
              console.log(`   Description: ${tx.description}`);
              console.log(`   Related Account: ${findRelatedAccount(nonCashEntries, 'credit')}`);
              console.log(`   Running Total: $${cashOutflows.toFixed(2)}\n`);
            }
          });
        }
      }
    });
    
    // ========================================
    // REAL CASH OUTFLOWS (Money Actually Spent)
    // ========================================
    console.log('📤 REAL CASH OUTFLOWS (Money Actually Spent)');
    console.log('=============================================');
    
    // From Expense collection (paid expenses)
    const paidExpenses = await Expense.find({
      expenseDate: { $lte: now },
      paymentStatus: 'Paid'
    });
    const totalCashOutFromExpenses = paidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log(`   📋 Paid Expenses: $${totalCashOutFromExpenses.toFixed(2)} (${paidExpenses.length} expenses)`);
    
    // ========================================
    // FINAL CASH FLOW CALCULATION
    // ========================================
    const totalCashIn = totalCashInFromPayments + cashInflows;
    const totalCashOut = totalCashOutFromExpenses + cashOutflows;
    const netCashFlow = totalCashIn - totalCashOut;
    
    console.log('\n💰 FINAL CASH FLOW CALCULATION');
    console.log('================================');
    console.log(`   📥 TOTAL CASH INFLOWS:  $${totalCashIn.toFixed(2)}`);
    console.log(`      ├─ Confirmed Payments:     $${totalCashInFromPayments.toFixed(2)}`);
    console.log(`      └─ Transaction Inflows:    $${cashInflows.toFixed(2)}`);
    console.log(`   📤 TOTAL CASH OUTFLOWS: $${totalCashOut.toFixed(2)}`);
    console.log(`      ├─ Paid Expenses:         $${totalCashOutFromExpenses.toFixed(2)}`);
    console.log(`      └─ Transaction Outflows:  $${cashOutflows.toFixed(2)}`);
    console.log(`   💵 NET CASH FLOW:       $${netCashFlow.toFixed(2)}`);
    
    // ========================================
    // DETAILED BREAKDOWN
    // ========================================
    console.log('\n📊 DETAILED CASH INFLOWS (Student Payments, etc.):');
    cashInflowDetails
      .sort((a, b) => b.amount - a.amount)
      .forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
        console.log(`      Source: ${item.source} | Date: ${item.date.toDateString()}`);
        console.log(`      Description: ${item.description}`);
        console.log(`      Related: ${item.relatedAccount}`);
      });
    
    console.log('\n💸 DETAILED CASH OUTFLOWS (Expenses, Petty Cash, etc.):');
    cashOutflowDetails
      .sort((a, b) => b.amount - a.amount)
      .forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.accountCode} - ${item.accountName}: $${item.amount.toFixed(2)}`);
        console.log(`      Source: ${item.source} | Date: ${item.date.toDateString()}`);
        console.log(`      Description: ${item.description}`);
        console.log(`      Related: ${item.relatedAccount}`);
      });
    
    // ========================================
    // SUMMARY & ASSESSMENT
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
    
    const cashFlowRatio = totalCashOut > 0 ? totalCashIn / totalCashOut : 0;
    console.log(`📊 Cash Flow Ratio: ${cashFlowRatio.toFixed(2)} (${cashFlowRatio > 1 ? 'Good' : 'Needs attention'})`);
    
    console.log('\n✅ Final corrected cash flow analysis complete!');
    console.log('   Now properly shows student payments as inflows and expenses as outflows');
    
  } catch (error) {
    console.error('❌ Error in final corrected cash flow analysis:', error);
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

// Helper function to find related account in the same transaction
function findRelatedAccount(entries, type) {
  const entry = entries.find(e => e[type] > 0);
  if (entry) {
    return `${entry.accountCode} - ${entry.accountName}`;
  }
  return 'Unknown';
}

// Run the final corrected analysis
finalCorrectedCashFlow();
