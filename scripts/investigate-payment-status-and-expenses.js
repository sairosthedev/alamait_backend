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

async function investigatePaymentStatusAndExpenses() {
  try {
    console.log('\n🔍 INVESTIGATING PAYMENT STATUS & EXPENSES');
    console.log('==========================================\n');
    
    const now = new Date();
    
    // ========================================
    // STEP 1: CHECK PAYMENT COLLECTION STATUS
    // ========================================
    console.log('🔍 STEP 1: Checking Payment Collection Status\n');
    
    const allPayments = await Payment.find({
      date: { $lte: now }
    });
    
    console.log(`📊 Total Payments Found: ${allPayments.length}`);
    
    // Group by status
    const paymentsByStatus = {};
    allPayments.forEach(payment => {
      const status = payment.status || 'unknown';
      if (!paymentsByStatus[status]) {
        paymentsByStatus[status] = [];
      }
      paymentsByStatus[status].push(payment);
    });
    
    console.log('\n📋 PAYMENTS BY STATUS:');
    Object.entries(paymentsByStatus).forEach(([status, payments]) => {
      const totalAmount = payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
      console.log(`  ${status.toUpperCase()}: $${totalAmount.toFixed(2)} (${payments.length} payments)`);
      
      // Show first few examples
      payments.slice(0, 3).forEach(p => {
        console.log(`    • ${p.studentName || 'Unknown'}: $${p.totalAmount?.toFixed(2) || '0.00'} - ${p.date?.toDateString() || 'No date'}`);
      });
      if (payments.length > 3) {
        console.log(`    ... and ${payments.length - 3} more`);
      }
    });
    
    // ========================================
    // STEP 2: CHECK EXPENSE COLLECTION
    // ========================================
    console.log('\n🔍 STEP 2: Checking Expense Collection\n');
    
    const allExpenses = await Expense.find({
      expenseDate: { $lte: now }
    });
    
    console.log(`📊 Total Expenses Found: ${allExpenses.length}`);
    
    // Group by payment status
    const expensesByStatus = {};
    allExpenses.forEach(expense => {
      const status = expense.paymentStatus || 'unknown';
      if (!expensesByStatus[status]) {
        expensesByStatus[status] = [];
      }
      expensesByStatus[status].push(expense);
    });
    
    console.log('\n📋 EXPENSES BY PAYMENT STATUS:');
    Object.entries(expensesByStatus).forEach(([status, expenses]) => {
      const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      console.log(`  ${status.toUpperCase()}: $${totalAmount.toFixed(2)} (${expenses.length} expenses)`);
      
      // Show first few examples
      expenses.slice(0, 3).forEach(e => {
        console.log(`    • ${e.expenseId || 'No ID'}: $${e.amount?.toFixed(2) || '0.00'} - ${e.description || 'No description'} - ${e.expenseDate?.toDateString() || 'No date'}`);
      });
      if (expenses.length > 3) {
        console.log(`    ... and ${expenses.length - 3} more`);
      }
    });
    
    // ========================================
    // STEP 3: COMPARE TRANSACTION ENTRIES WITH PAYMENTS
    // ========================================
    console.log('\n🔍 STEP 3: Comparing Transaction Entries with Actual Payments\n');
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      'entries.debit': { $gt: 0 }
    });
    
    console.log(`📊 Payment Transactions in TransactionEntry: ${paymentTransactions.length}`);
    
    let totalTransactionAmount = 0;
    paymentTransactions.forEach(tx => {
      const cashEntry = tx.entries.find(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode) && entry.debit > 0
      );
      if (cashEntry) {
        totalTransactionAmount += cashEntry.debit;
      }
    });
    
    console.log(`💰 Total Amount in TransactionEntry: $${totalTransactionAmount.toFixed(2)}`);
    
    // ========================================
    // STEP 4: FIND MISSING EXPENSES
    // ========================================
    console.log('\n🔍 STEP 4: Finding Missing Expenses\n');
    
    // Look for expenses that might be recorded differently
    const expenseTransactions = await TransactionEntry.find({
      source: { $in: ['expense_payment', 'vendor_payment', 'manual'] },
      'entries.accountCode': { $in: ['1001', '1002', '1011'] },
      'entries.credit': { $gt: 0 }
    });
    
    console.log(`📊 Expense Transactions in TransactionEntry: ${expenseTransactions.length}`);
    
    let totalExpenseAmount = 0;
    expenseTransactions.forEach(tx => {
      const cashEntry = tx.entries.find(entry => 
        ['1001', '1002', '1011'].includes(entry.accountCode) && entry.credit > 0
      );
      if (cashEntry) {
        totalExpenseAmount += cashEntry.credit;
      }
    });
    
    console.log(`💰 Total Expense Amount in TransactionEntry: $${totalExpenseAmount.toFixed(2)}`);
    
    // ========================================
    // STEP 5: ANALYSIS & RECOMMENDATIONS
    // ========================================
    console.log('\n📋 ANALYSIS & RECOMMENDATIONS');
    console.log('===============================');
    
    const confirmedPayments = paymentsByStatus['confirmed'] || [];
    const completedPayments = paymentsByStatus['completed'] || [];
    const paidPayments = paymentsByStatus['paid'] || [];
    
    const totalConfirmedAmount = confirmedPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalCompletedAmount = completedPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPaidAmount = paidPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    const totalActualPayments = totalConfirmedAmount + totalCompletedAmount + totalPaidAmount;
    
    console.log(`1. 💳 ACTUAL CONFIRMED/PAID PAYMENTS: $${totalActualPayments.toFixed(2)}`);
    console.log(`   - Confirmed: $${totalConfirmedAmount.toFixed(2)}`);
    console.log(`   - Completed: $${totalCompletedAmount.toFixed(2)}`);
    console.log(`   - Paid: $${totalPaidAmount.toFixed(2)}`);
    
    console.log(`\n2. 📊 TRANSACTION ENTRIES SHOW: $${totalTransactionAmount.toFixed(2)}`);
    console.log(`   - This includes ALL payment transactions, regardless of status`);
    console.log(`   - May include pending, cancelled, or failed payments`);
    
    console.log(`\n3. 📋 EXPENSES FOUND: $${totalExpenseAmount.toFixed(2)}`);
    console.log(`   - From TransactionEntry records`);
    console.log(`   - This is the actual money spent`);
    
    console.log(`\n4. 🚨 DISCREPANCY IDENTIFIED:`);
    if (totalTransactionAmount > totalActualPayments) {
      console.log(`   - TransactionEntry shows $${totalTransactionAmount.toFixed(2)} in payments`);
      console.log(`   - But only $${totalActualPayments.toFixed(2)} are actually confirmed/paid`);
      console.log(`   - Difference: $${(totalTransactionAmount - totalActualPayments).toFixed(2)} in pending/failed payments`);
    }
    
    console.log(`\n5. 🎯 RECOMMENDATIONS:`);
    console.log(`   - Only count CONFIRMED/COMPLETED/PAID payments as cash inflows`);
    console.log(`   - Include ALL expense transactions as cash outflows`);
    console.log(`   - Filter TransactionEntry by payment status, not just source`);
    
  } catch (error) {
    console.error('❌ Error investigating payment status and expenses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigatePaymentStatusAndExpenses();
