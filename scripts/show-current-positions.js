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

async function showCurrentPositions() {
  try {
    console.log('\n📊 CURRENT FINANCIAL POSITIONS');
    console.log('===============================\n');
    
    const now = new Date();
    
    // ========================================
    // ACTUAL (CASH BASIS) POSITION
    // ========================================
    console.log('💰 ACTUAL (CASH BASIS) POSITION');
    console.log('================================');
    
    // Money actually received
    const actualCashIn = await Payment.find({
      date: { $lte: now },
      status: { $in: ['confirmed', 'completed', 'paid'] }
    });
    const totalCashIn = actualCashIn.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    // Money actually paid out
    const actualCashOut = await Expense.find({
      expenseDate: { $lte: now },
      paymentStatus: 'Paid'
    });
    const totalCashOut = actualCashOut.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const actualCashPosition = totalCashIn - totalCashOut;
    
    console.log(`📥 Cash Received:     $${totalCashIn.toFixed(2)}`);
    console.log(`📤 Cash Paid Out:     $${totalCashOut.toFixed(2)}`);
    console.log(`💵 CASH POSITION:     $${actualCashPosition.toFixed(2)}`);
    
    // ========================================
    // ACCRUAL POSITION
    // ========================================
    console.log('\n📈 ACCRUAL POSITION');
    console.log('===================');
    
    // Get all transactions for accrual basis
    const allTransactions = await Transaction.find({
      date: { $lte: now },
      status: 'posted'
    }).populate('entries.account');
    
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
    
    // Outstanding amounts
    const debtors = await Debtor.find({ status: 'active' });
    const totalReceivables = debtors.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
    
    const outstandingExpenses = await Expense.find({
      paymentStatus: { $ne: 'Paid' }
    });
    const totalPayables = outstandingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const accrualNetIncome = accrualIncome - accrualExpenses;
    
    console.log(`📊 Income Earned:     $${accrualIncome.toFixed(2)}`);
    console.log(`💸 Expenses Incurred: $${accrualExpenses.toFixed(2)}`);
    console.log(`📈 NET INCOME:        $${accrualNetIncome.toFixed(2)}`);
    console.log(`📋 Receivables:       $${totalReceivables.toFixed(2)}`);
    console.log(`📋 Payables:          $${totalPayables.toFixed(2)}`);
    
    // ========================================
    // SUMMARY COMPARISON
    // ========================================
    console.log('\n🔄 POSITION COMPARISON');
    console.log('=======================');
    
    const difference = actualCashPosition - accrualNetIncome;
    
    console.log(`💰 Cash Basis:        $${actualCashPosition.toFixed(2)}`);
    console.log(`📈 Accrual Basis:     $${accrualNetIncome.toFixed(2)}`);
    console.log(`📊 Difference:        $${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 1000) {
      console.log('\n⚠️  Significant timing difference detected!');
    }
    
    console.log('\n✅ Current positions displayed successfully!');
    
  } catch (error) {
    console.error('❌ Error showing positions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
showCurrentPositions();
