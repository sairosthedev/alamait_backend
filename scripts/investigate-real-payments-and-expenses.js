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

async function investigateRealPaymentsAndExpenses() {
  try {
    console.log('\n🔍 INVESTIGATING REAL PAYMENTS VS ACCRUALS & ALL EXPENSES');
    console.log('==========================================================\n');
    
    const now = new Date();
    
    // ========================================
    // 1. CHECK PAYMENT COLLECTION (Real Money)
    // ========================================
    console.log('💳 PAYMENT COLLECTION (Real Money Actually Received):');
    console.log('=====================================================');
    
    const allPayments = await Payment.find({
      date: { $lte: now }
    });
    
    console.log(`Total Payments Found: ${allPayments.length}`);
    
    const confirmedPayments = allPayments.filter(p => ['confirmed', 'completed', 'paid'].includes(p.status));
    const pendingPayments = allPayments.filter(p => !['confirmed', 'completed', 'paid'].includes(p.status));
    
    console.log(`Confirmed/Paid: ${confirmedPayments.length}`);
    console.log(`Pending/Other: ${pendingPayments.length}`);
    
    const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPending = pendingPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    console.log(`Total Confirmed Amount: $${totalConfirmed.toFixed(2)}`);
    console.log(`Total Pending Amount: $${totalPending.toFixed(2)}`);
    
    // Show sample payments
    if (confirmedPayments.length > 0) {
      console.log('\n📋 Sample Confirmed Payments:');
      confirmedPayments.slice(0, 3).forEach((p, idx) => {
        console.log(`   ${idx + 1}. $${p.totalAmount.toFixed(2)} - ${p.status} - ${p.date.toDateString()}`);
      });
    }
    
    // ========================================
    // 2. CHECK EXPENSE COLLECTION (All Expenses)
    // ========================================
    console.log('\n📋 EXPENSE COLLECTION (All Expenses):');
    console.log('=====================================');
    
    const allExpenses = await Expense.find({
      expenseDate: { $lte: now }
    });
    
    console.log(`Total Expenses Found: ${allExpenses.length}`);
    
    const paidExpenses = allExpenses.filter(e => e.paymentStatus === 'Paid');
    const unpaidExpenses = allExpenses.filter(e => e.paymentStatus !== 'Paid');
    
    console.log(`Paid: ${paidExpenses.length}`);
    console.log(`Unpaid: ${unpaidExpenses.length}`);
    
    const totalPaid = paidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalUnpaid = unpaidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    console.log(`Total Paid Amount: $${totalPaid.toFixed(2)}`);
    console.log(`Total Unpaid Amount: $${totalUnpaid.toFixed(2)}`);
    
    // Look for the $901.12 expense
    const expense90112 = allExpenses.find(e => e.amount === 901.12);
    if (expense90112) {
      console.log(`\n💰 FOUND YOUR $901.12 EXPENSE:`);
      console.log(`   Amount: $${expense90112.amount.toFixed(2)}`);
      console.log(`   Status: ${expense90112.paymentStatus}`);
      console.log(`   Date: ${expense90112.expenseDate.toDateString()}`);
      console.log(`   Description: ${expense90112.description || 'No description'}`);
    } else {
      console.log(`\n❌ $901.12 EXPENSE NOT FOUND in Expense collection`);
    }
    
    // Show sample expenses
    if (paidExpenses.length > 0) {
      console.log('\n📋 Sample Paid Expenses:');
      paidExpenses.slice(0, 5).forEach((e, idx) => {
        console.log(`   ${idx + 1}. $${e.amount.toFixed(2)} - ${e.paymentStatus} - ${e.expenseDate.toDateString()}`);
      });
    }
    
    // ========================================
    // 3. CHECK TRANSACTION ENTRIES (Accruals vs Real)
    // ========================================
    console.log('\n📊 TRANSACTION ENTRIES ANALYSIS (Accruals vs Real):');
    console.log('===================================================');
    
    const transactionEntries = await TransactionEntry.find({
      date: { $lte: now },
      status: 'posted'
    });
    
    console.log(`Total TransactionEntries: ${transactionEntries.length}`);
    
    // Group by source type
    const sourceAnalysis = {};
    transactionEntries.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          const source = tx.source;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          if (!sourceAnalysis[source]) {
            sourceAnalysis[source] = {
              count: 0,
              totalDebit: 0,
              totalCredit: 0,
              descriptions: []
            };
          }
          
          sourceAnalysis[source].count += 1;
          sourceAnalysis[source].totalDebit += debit;
          sourceAnalysis[source].totalCredit += credit;
          
          if (!sourceAnalysis[source].descriptions.includes(tx.description)) {
            sourceAnalysis[source].descriptions.push(tx.description);
          }
        });
      }
    });
    
    console.log('\n📋 SOURCE TYPE BREAKDOWN:');
    Object.entries(sourceAnalysis).forEach(([source, data]) => {
      console.log(`\n🔸 ${source.toUpperCase()}:`);
      console.log(`   Count: ${data.count} entries`);
      console.log(`   Total Debit: $${data.totalDebit.toFixed(2)}`);
      console.log(`   Total Credit: $${data.totalCredit.toFixed(2)}`);
      console.log(`   Sample Descriptions: ${data.descriptions.slice(0, 2).join(', ')}`);
    });
    
    // ========================================
    // 4. LOOK FOR THE MISSING $901.12 EXPENSE
    // ========================================
    console.log('\n🔍 SEARCHING FOR $901.12 EXPENSE IN TRANSACTION ENTRIES:');
    console.log('=========================================================');
    
    let found90112 = false;
    transactionEntries.forEach(tx => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach(entry => {
          if (entry.debit === 901.12 || entry.credit === 901.12) {
            found90112 = true;
            console.log(`💰 FOUND $901.12 in TransactionEntry:`);
            console.log(`   Transaction ID: ${tx.transactionId}`);
            console.log(`   Source: ${tx.source}`);
            console.log(`   Date: ${tx.date.toDateString()}`);
            console.log(`   Description: ${tx.description}`);
            console.log(`   Account: ${entry.accountCode} - ${entry.accountName}`);
            console.log(`   Debit: $${entry.debit.toFixed(2)}`);
            console.log(`   Credit: $${entry.credit.toFixed(2)}`);
          }
        });
      }
    });
    
    if (!found90112) {
      console.log(`❌ $901.12 NOT FOUND in TransactionEntry records`);
    }
    
    // ========================================
    // 5. SUMMARY & CONCLUSIONS
    // ========================================
    console.log('\n📋 INVESTIGATION SUMMARY:');
    console.log('==========================');
    
    console.log(`1. Real Money Received (Payments): $${totalConfirmed.toFixed(2)}`);
    console.log(`2. Expenses Paid (Expense Collection): $${totalPaid.toFixed(2)}`);
    console.log(`3. TransactionEntries Total: $${Object.values(sourceAnalysis).reduce((sum, data) => sum + data.totalDebit, 0).toFixed(2)}`);
    
    if (totalConfirmed > 0) {
      console.log(`\n✅ CONFIRMED: You have received real money from payments`);
    } else {
      console.log(`\n❌ CONFIRMED: No real money has been received from payments`);
    }
    
    if (expense90112) {
      console.log(`\n✅ CONFIRMED: Your $901.12 expense exists in Expense collection`);
    } else {
      console.log(`\n❌ CONFIRMED: Your $901.12 expense is missing from Expense collection`);
    }
    
    console.log('\n✅ Investigation complete!');
    
  } catch (error) {
    console.error('❌ Error in investigation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the investigation
investigateRealPaymentsAndExpenses();
