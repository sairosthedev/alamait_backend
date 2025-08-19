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
const BalanceSheet = require('../src/models/finance/BalanceSheet');
const Asset = require('../src/models/finance/Asset');
const Liability = require('../src/models/finance/Liability');
const Equity = require('../src/models/finance/Equity');

async function analyzeCurrentFinancialPositions() {
  try {
    console.log('\n📊 ANALYZING CURRENT FINANCIAL POSITIONS');
    console.log('==========================================\n');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log(`📅 Analysis Date: ${now.toLocaleDateString()}`);
    console.log(`📅 Current Period: ${currentYear} (Month ${currentMonth})\n`);
    
    // ========================================
    // 1. ACTUAL (CASH BASIS) POSITION
    // ========================================
    console.log('💰 ACTUAL (CASH BASIS) POSITION');
    console.log('================================');
    console.log('This shows what is actually in the bank/on hand right now\n');
    
    // Get actual cash receipts (money actually received)
    const actualCashIn = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    
    const totalActualCashIn = actualCashIn.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
    
    // Get actual cash payments (money actually paid out)
    const actualCashOut = await Expense.find({
      date: { $lte: now },
      status: { $in: ['approved', 'paid', 'completed'] }
    });
    
    const totalActualCashOut = actualCashOut.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    
    // Calculate actual cash position
    const actualCashPosition = totalActualCashIn - totalActualCashOut;
    
    console.log(`📥 ACTUAL CASH RECEIVED (Total):     $${totalActualCashIn.toFixed(2)}`);
    console.log(`📤 ACTUAL CASH PAID OUT (Total):     $${totalActualCashOut.toFixed(2)}`);
    console.log(`💵 ACTUAL CASH POSITION:             $${actualCashPosition.toFixed(2)}`);
    
    // Break down actual cash by category
    console.log('\n📊 ACTUAL CASH BREAKDOWN:');
    
    // Cash receipts breakdown
    const cashReceiptsByType = {};
    actualCashIn.forEach(payment => {
      const type = payment.paymentType || 'Rent';
      cashReceiptsByType[type] = (cashReceiptsByType[type] || 0) + (payment.totalAmount || 0);
    });
    
    Object.entries(cashReceiptsByType).forEach(([type, amount]) => {
      console.log(`   ${type}: ${' '.repeat(20 - type.length)}$${amount.toFixed(2)}`);
    });
    
    // Cash payments breakdown
    const cashPaymentsByCategory = {};
    actualCashOut.forEach(expense => {
      const category = expense.category?.name || 'Uncategorized';
      cashPaymentsByCategory[category] = (cashPaymentsByCategory[category] || 0) + (expense.amount || 0);
    });
    
    console.log('\n💸 ACTUAL CASH PAYMENTS BY CATEGORY:');
    Object.entries(cashPaymentsByCategory).forEach(([category, amount]) => {
      console.log(`   ${category}: ${' '.repeat(25 - category.length)}$${amount.toFixed(2)}`);
    });
    
    // ========================================
    // 2. ACCRUAL POSITION
    // ========================================
    console.log('\n\n📈 ACCRUAL POSITION');
    console.log('===================');
    console.log('This shows what is earned/owed regardless of cash flow\n');
    
    // Get all transactions for accrual basis
    const allTransactions = await Transaction.find({
      date: { $lte: now },
      status: 'posted'
    }).populate('entries.account');
    
    // Calculate accrual income (earned but not necessarily received)
    let accrualIncome = 0;
    let accrualExpenses = 0;
    
    allTransactions.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          const accountType = entry.account?.type;
          const amount = entry.debit || entry.credit || 0;
          
          if (accountType === 'Income' && entry.credit > 0) {
            accrualIncome += amount;
          } else if (accountType === 'Expense' && entry.debit > 0) {
            accrualExpenses += amount;
          }
        });
      }
    });
    
    // Get outstanding receivables (money owed to us)
    const outstandingReceivables = await Debtor.find({ status: 'active' });
    const totalReceivables = outstandingReceivables.reduce((sum, debtor) => sum + (debtor.currentBalance || 0), 0);
    
    // Get outstanding payables (money we owe)
    const outstandingPayables = await Expense.find({
      status: { $in: ['pending', 'approved'] },
      paymentStatus: { $ne: 'paid' }
    });
    const totalPayables = outstandingPayables.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    
    console.log(`📊 ACCRUAL INCOME (Earned):           $${accrualIncome.toFixed(2)}`);
    console.log(`💸 ACCRUAL EXPENSES (Incurred):       $${accrualExpenses.toFixed(2)}`);
    console.log(`📈 ACCRUAL NET INCOME:                $${(accrualIncome - accrualExpenses).toFixed(2)}`);
    
    console.log('\n📋 OUTSTANDING AMOUNTS:');
    console.log(`   Accounts Receivable (Owed to us):  $${totalReceivables.toFixed(2)}`);
    console.log(`   Accounts Payable (We owe):         $${totalPayables.toFixed(2)}`);
    
    // ========================================
    // 3. BALANCE SHEET POSITION
    // ========================================
    console.log('\n\n⚖️  BALANCE SHEET POSITION');
    console.log('===========================');
    
    // Get current balance sheet data
    const currentBalanceSheet = await BalanceSheet.findOne({
      status: 'Published'
    }).sort({ asOf: -1 });
    
    if (currentBalanceSheet) {
      console.log(`📅 Balance Sheet Date: ${currentBalanceSheet.asOf.toLocaleDateString()}`);
      console.log(`💼 Total Assets: $${currentBalanceSheet.totalAssets.toFixed(2)}`);
      console.log(`📋 Total Liabilities: $${currentBalanceSheet.totalLiabilities.toFixed(2)}`);
      console.log(`🏛️  Total Equity: $${currentBalanceSheet.totalEquity.toFixed(2)}`);
      console.log(`💰 Net Worth: $${currentBalanceSheet.netWorth.toFixed(2)}`);
    } else {
      console.log('⚠️  No published balance sheet found');
      
      // Calculate estimated balance sheet from current data
      const estimatedAssets = actualCashPosition + totalReceivables;
      const estimatedLiabilities = totalPayables;
      const estimatedEquity = estimatedAssets - estimatedLiabilities;
      
      console.log('\n📊 ESTIMATED BALANCE SHEET (from current data):');
      console.log(`   Estimated Assets:     $${estimatedAssets.toFixed(2)}`);
      console.log(`   Estimated Liabilities: $${estimatedLiabilities.toFixed(2)}`);
      console.log(`   Estimated Equity:      $${estimatedEquity.toFixed(2)}`);
    }
    
    // ========================================
    // 4. POSITION COMPARISON
    // ========================================
    console.log('\n\n🔄 POSITION COMPARISON');
    console.log('=======================');
    
    const cashVsAccrualDifference = actualCashPosition - (accrualIncome - accrualExpenses);
    
    console.log(`💰 Cash Basis Net Position:     $${actualCashPosition.toFixed(2)}`);
    console.log(`📈 Accrual Basis Net Position:  $${(accrualIncome - accrualExpenses).toFixed(2)}`);
    console.log(`📊 Difference:                   $${cashVsAccrualDifference.toFixed(2)}`);
    
    if (Math.abs(cashVsAccrualDifference) > 1000) {
      console.log('\n⚠️  SIGNIFICANT DIFFERENCE DETECTED!');
      console.log('This suggests timing differences between when income/expenses are:');
      console.log('   • RECOGNIZED (accrual) vs');
      console.log('   • RECEIVED/PAID (cash)');
    }
    
    // ========================================
    // 5. KEY INSIGHTS
    // ========================================
    console.log('\n\n💡 KEY INSIGHTS');
    console.log('================');
    
    if (actualCashPosition > 0) {
      console.log('✅ POSITIVE CASH POSITION: You have money available');
    } else {
      console.log('❌ NEGATIVE CASH POSITION: You may need to manage cash flow');
    }
    
    if (totalReceivables > totalPayables) {
      console.log('✅ POSITIVE NET RECEIVABLES: More money owed to you than you owe');
    } else {
      console.log('⚠️  NEGATIVE NET RECEIVABLES: You owe more than is owed to you');
    }
    
    const cashFlowRatio = totalActualCashOut > 0 ? totalActualCashIn / totalActualCashOut : 0;
    console.log(`📊 Cash Flow Ratio: ${cashFlowRatio.toFixed(2)} (${cashFlowRatio > 1 ? 'Good' : 'Needs attention'})`);
    
    // ========================================
    // 6. RECOMMENDATIONS
    // ========================================
    console.log('\n\n🎯 RECOMMENDATIONS');
    console.log('===================');
    
    if (actualCashPosition < 0) {
      console.log('💡 Consider:');
      console.log('   • Accelerating collections from debtors');
      console.log('   • Delaying non-essential payments');
      console.log('   • Reviewing expense categories');
    }
    
    if (totalReceivables > totalActualCashIn * 0.3) {
      console.log('💡 Consider:');
      console.log('   • Implementing stricter payment terms');
      console.log('   • Following up on overdue accounts');
      console.log('   • Offering early payment discounts');
    }
    
    if (totalPayables > totalActualCashOut * 0.5) {
      console.log('💡 Consider:');
      console.log('   • Negotiating payment terms with vendors');
      console.log('   • Prioritizing essential payments');
      console.log('   • Managing cash flow more tightly');
    }
    
    console.log('\n✅ Financial Position Analysis Complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing financial positions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
analyzeCurrentFinancialPositions();
