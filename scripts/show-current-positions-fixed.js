const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');
const Debtor = require('../src/models/Debtor');
const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');

async function showCurrentPositionsFixed() {
  try {
    console.log('\n📊 CURRENT FINANCIAL POSITIONS (FIXED - INCLUDES ALL TRANSACTION ENTRIES)');
    console.log('==========================================================================\n');
    
    const now = new Date();
    
    // ========================================
    // ACTUAL (CASH BASIS) POSITION - FIXED
    // ========================================
    console.log('💰 ACTUAL (CASH BASIS) POSITION (INCLUDES ALL TRANSACTION ENTRIES)');
    console.log('==================================================================');
    
    // ========================================
    // CASH INFLOWS - FIXED: Include both Payment collection AND TransactionEntry
    // ========================================
    console.log('\n🔍 ANALYZING CASH INFLOWS FROM MULTIPLE SOURCES:');
    
    // 1. From Payment collection (traditional payments)
    const actualCashInFromPayments = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    const totalCashInFromPayments = actualCashInFromPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    console.log(`   📥 Payment Collection (Confirmed/Paid): $${totalCashInFromPayments.toFixed(2)}`);
    
    // 2. From TransactionEntry (this is where your actual inflows are!)
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    let totalExpensesFromTransactions = 0;
    let totalIncomeFromTransactions = 0;
    let expensesByAccount = {};
    let incomeByAccount = {};
    
    console.log('\n📊 TRANSACTION ENTRIES ANALYSIS (INFLOWS & OUTFLOWS):');
    transactionEntries.forEach((tx, idx) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          if (debit > 0) {
            // This is an expense (debit) - CASH OUTFLOW
            totalExpensesFromTransactions += debit;
            
            // Group by account for detailed analysis
            const key = `${accountCode} - ${accountName}`;
            if (!expensesByAccount[key]) {
              expensesByAccount[key] = {
                accountCode,
                accountName,
                total: 0,
                count: 0
              };
            }
            expensesByAccount[key].total += debit;
            expensesByAccount[key].count += 1;
            
            // Highlight the specific $901.12 expense
            if (debit === 901.12) {
              console.log(`   💡 FOUND YOUR MISSING EXPENSE: ${accountCode} - ${accountName} = $${debit}`);
            }
          }
          
          if (credit > 0) {
            // This is income (credit) - CASH INFLOW
            totalIncomeFromTransactions += credit;
            
            // Group by account for detailed analysis
            const key = `${accountCode} - ${accountName}`;
            if (!incomeByAccount[key]) {
              incomeByAccount[key] = {
                accountCode,
                accountName,
                total: 0,
                count: 0
              };
            }
            incomeByAccount[key].total += credit;
            incomeByAccount[key].count += 1;
          }
        });
      }
    });
    
    console.log(`   📊 Total Income from TransactionEntries: $${totalIncomeFromTransactions.toFixed(2)}`);
    console.log(`   💸 Total Expenses from TransactionEntries: $${totalExpensesFromTransactions.toFixed(2)}`);
    
    // Show detailed breakdown of income by account
    console.log('\n📈 INCOME BY ACCOUNT (FROM TRANSACTION ENTRIES):');
    Object.entries(incomeByAccount)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([key, data]) => {
        console.log(`   ${data.accountCode} - ${data.accountName}: $${data.total.toFixed(2)} (${data.count} entries)`);
      });
    
    // Show detailed breakdown of expenses by account
    console.log('\n💸 EXPENSES BY ACCOUNT (FROM TRANSACTION ENTRIES):');
    Object.entries(expensesByAccount)
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([key, data]) => {
        console.log(`   ${data.accountCode} - ${data.accountName}: $${data.total.toFixed(2)} (${data.count} entries)`);
      });
    
    // ========================================
    // CASH OUTFLOWS - FIXED: Include both Expense collection AND TransactionEntry
    // ========================================
    console.log('\n🔍 ANALYZING CASH OUTFLOWS FROM MULTIPLE SOURCES:');
    
    // 1. From Expense collection
    const expensesFromCollection = await Expense.find({
      expenseDate: { $lte: now },
      paymentStatus: 'Paid'
    });
    const totalExpensesFromCollection = expensesFromCollection.reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log(`   📋 Expense Collection (Paid): $${totalExpensesFromCollection.toFixed(2)}`);
    
    // 2. From TransactionEntry (already calculated above)
    console.log(`   📊 TransactionEntries (Debits): $${totalExpensesFromTransactions.toFixed(2)}`);
    
    // ========================================
    // FINAL CASH POSITION CALCULATION - COMPLETE
    // ========================================
    // Total cash inflows from ALL sources
    const totalActualCashIn = totalCashInFromPayments + totalIncomeFromTransactions;
    
    // Total cash outflows from ALL sources
    const totalActualCashOut = totalExpensesFromCollection + totalExpensesFromTransactions;
    
    // Final cash position
    const actualCashPosition = totalActualCashIn - totalActualCashOut;
    
    console.log('\n💰 FINAL CASH POSITION CALCULATION (COMPLETE):');
    console.log('================================================');
    console.log(`   📥 TOTAL CASH INFLOWS:     $${totalActualCashIn.toFixed(2)}`);
    console.log(`      ├─ From Payments:       $${totalCashInFromPayments.toFixed(2)}`);
    console.log(`      └─ From Transactions:   $${totalIncomeFromTransactions.toFixed(2)}`);
    console.log(`   📤 TOTAL CASH OUTFLOWS:    $${totalActualCashOut.toFixed(2)}`);
    console.log(`      ├─ From Expenses:       $${totalExpensesFromCollection.toFixed(2)}`);
    console.log(`      └─ From Transactions:   $${totalExpensesFromTransactions.toFixed(2)}`);
    console.log(`   💵 FINAL CASH POSITION:    $${actualCashPosition.toFixed(2)}`);
    
    // ========================================
    // ACCRUAL POSITION - FIXED
    // ========================================
    console.log('\n📈 ACCRUAL POSITION (FROM TRANSACTION ENTRIES)');
    console.log('================================================');
    
    // Outstanding amounts
    const debtors = await Debtor.find({ status: 'active' });
    const totalReceivables = debtors.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
    
    const outstandingExpenses = await Expense.find({
      paymentStatus: { $ne: 'Paid' }
    });
    const totalPayables = outstandingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const accrualNetIncome = totalIncomeFromTransactions - totalExpensesFromTransactions;
    
    console.log(`📊 Income Earned:     $${totalIncomeFromTransactions.toFixed(2)}`);
    console.log(`💸 Expenses Incurred: $${totalExpensesFromTransactions.toFixed(2)}`);
    console.log(`📈 NET INCOME:        $${accrualNetIncome.toFixed(2)}`);
    console.log(`📋 Receivables:       $${totalReceivables.toFixed(2)}`);
    console.log(`📋 Payables:          $${totalPayables.toFixed(2)}`);
    
    // ========================================
    // SUMMARY COMPARISON - FIXED
    // ========================================
    console.log('\n🔄 POSITION COMPARISON (FIXED)');
    console.log('=================================');
    
    const difference = actualCashPosition - accrualNetIncome;
    
    console.log(`💰 Cash Basis:        $${actualCashPosition.toFixed(2)}`);
    console.log(`📈 Accrual Basis:     $${accrualNetIncome.toFixed(2)}`);
    console.log(`📊 Difference:        $${difference.toFixed(2)}`);
    
    // ========================================
    // KEY FINDINGS - COMPLETE ANALYSIS
    // ========================================
    console.log('\n🔍 KEY FINDINGS (COMPLETE ANALYSIS):');
    console.log('=====================================');
    
    // Check income sources
    if (totalIncomeFromTransactions > totalCashInFromPayments) {
      console.log(`✅ TransactionEntries contain MORE income than Payment collection:`);
      console.log(`   TransactionEntries: $${totalIncomeFromTransactions.toFixed(2)}`);
      console.log(`   Payment Collection: $${totalCashInFromPayments.toFixed(2)}`);
      console.log(`   Additional Income: $${(totalIncomeFromTransactions - totalCashInFromPayments).toFixed(2)}`);
    }
    
    // Check expense sources
    if (totalExpensesFromTransactions > totalExpensesFromCollection) {
      console.log(`✅ TransactionEntries contain MORE expenses than Expense collection:`);
      console.log(`   TransactionEntries: $${totalExpensesFromTransactions.toFixed(2)}`);
      console.log(`   Expense Collection: $${totalExpensesFromCollection.toFixed(2)}`);
      console.log(`   Additional Expenses: $${(totalExpensesFromTransactions - totalExpensesFromCollection).toFixed(2)}`);
      console.log(`   This explains why your $901.12 expense was missing from cash flow!`);
    }
    
    // Check if we found the specific $901.12 expense
    const found90112 = Object.values(expensesByAccount).some(acc => acc.total === 901.12);
    if (found90112) {
      console.log(`✅ SUCCESS: Found the $901.12 expense in TransactionEntries!`);
    } else {
      console.log(`❌ Still missing: The $901.12 expense was not found in TransactionEntries`);
    }
    
    // Overall assessment
    console.log('\n📊 OVERALL ASSESSMENT:');
    console.log('=======================');
    if (actualCashPosition > 0) {
      console.log(`✅ POSITIVE CASH POSITION: You have $${actualCashPosition.toFixed(2)} available`);
    } else {
      console.log(`❌ NEGATIVE CASH POSITION: You are $${Math.abs(actualCashPosition).toFixed(2)} short`);
    }
    
    const cashFlowRatio = totalActualCashOut > 0 ? totalActualCashIn / totalActualCashOut : 0;
    console.log(`📊 Cash Flow Ratio: ${cashFlowRatio.toFixed(2)} (${cashFlowRatio > 1 ? 'Good' : 'Needs attention'})`);
    
    console.log('\n✅ Complete cash flow analysis finished!');
    console.log('   Now includes ALL financial data from TransactionEntries (both inflows and outflows)');
    
  } catch (error) {
    console.error('❌ Error showing positions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fixed script
showCurrentPositionsFixed();