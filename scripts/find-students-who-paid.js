const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Debtor = require('../src/models/Debtor');

/**
 * FIND STUDENTS WHO PAID $5,240
 * 
 * This script will show exactly which students made payments
 * and break down the $5,240 total
 */

async function findStudentsWhoPaid() {
  try {
    console.log('\n🔍 FINDING STUDENTS WHO PAID $5,240');
    console.log('======================================\n');
    
    // ========================================
    // METHOD 1: FROM TRANSACTION ENTRIES
    // ========================================
    console.log('📋 METHOD 1: FROM TRANSACTION ENTRIES (DOUBLE-ENTRY)');
    console.log('=====================================================\n');
    
    // Find all payment transactions that affected cash accounts
    const paymentEntries = await TransactionEntry.find({
      source: 'payment',
      'entries.accountCode': { $in: ['1001', '1002', '1011'] }, // Cash accounts
      status: 'posted'
    });
    
    console.log('💰 PAYMENT TRANSACTIONS AFFECTING CASH:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Transaction ID                                 │ Date        │ Student     │ Amount      │ Cash Account│');
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalFromEntries = 0;
    const paymentsByStudent = {};
    
    paymentEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(lineItem => {
          if (['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0) {
            const amount = lineItem.debit;
            totalFromEntries += amount;
            
            // Try to find student info from metadata or sourceId
            const studentId = entry.metadata?.studentId || entry.sourceId || 'Unknown';
            const studentName = entry.metadata?.studentName || 'Unknown Student';
            
            if (!paymentsByStudent[studentId]) {
              paymentsByStudent[studentId] = {
                name: studentName,
                total: 0,
                payments: []
              };
            }
            
            paymentsByStudent[studentId].total += amount;
            paymentsByStudent[studentId].payments.push({
              transactionId: entry.transactionId,
              date: entry.date,
              amount: amount,
              cashAccount: lineItem.accountCode
            });
            
            const transactionId = entry.transactionId.padEnd(35);
            const date = entry.date.toLocaleDateString().padEnd(12);
            const student = studentName.padEnd(15);
            const amountPadded = `$${amount.toFixed(2)}`.padStart(12);
            const cashAccount = lineItem.accountCode.padEnd(12);
            
            console.log(`│ ${transactionId} │ ${date} │ ${student} │ ${amountPadded} │ ${cashAccount} │`);
          }
        });
      }
    });
    
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalFromEntriesPadded = `$${totalFromEntries.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL FROM ENTRIES                              │             │             │ ${totalFromEntriesPadded} │             │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // METHOD 2: FROM PAYMENT COLLECTION
    // ========================================
    console.log('📋 METHOD 2: FROM PAYMENT COLLECTION');
    console.log('=====================================\n');
    
    const payments = await Payment.find({}).populate('user', 'firstName lastName email');
    
    console.log('💳 PAYMENTS FROM PAYMENT COLLECTION:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Payment ID                                     │ Date        │ Student     │ Amount      │ Status      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalFromPayments = 0;
    
    payments.forEach(payment => {
      const amount = payment.amount || 0;
      totalFromPayments += amount;
      
      const studentName = payment.user ? 
        `${payment.user.firstName} ${payment.user.lastName}` : 
        'Unknown Student';
      
      const paymentId = payment._id.toString().padEnd(35);
      const date = new Date(payment.createdAt).toLocaleDateString().padEnd(12);
      const student = studentName.padEnd(15);
      const amountPadded = `$${amount.toFixed(2)}`.padStart(12);
      const status = (payment.status || 'pending').padEnd(12);
      
      console.log(`│ ${paymentId} │ ${date} │ ${student} │ ${amountPadded} │ ${status} │`);
    });
    
    console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalFromPaymentsPadded = `$${totalFromPayments.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL FROM PAYMENTS                             │             │             │ ${totalFromPaymentsPadded} │             │`);
    console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // METHOD 3: FROM DEBTOR PAYMENTS
    // ========================================
    console.log('📋 METHOD 3: FROM DEBTOR PAYMENT HISTORY');
    console.log('=========================================\n');
    
    const debtors = await Debtor.find({}).populate('user', 'firstName lastName email');
    
    console.log('👥 DEBTOR PAYMENT HISTORY:');
    console.log('┌─────────────┬──────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code│ Student  │ Total Owed  │ Total Paid  │ Balance     │ Last Payment│');
    console.log('├─────────────┼──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalFromDebtors = 0;
    
    debtors.forEach(debtor => {
      const totalPaid = debtor.totalPaid || 0;
      totalFromDebtors += totalPaid;
      
      const studentName = debtor.user ? 
        `${debtor.user.firstName} ${debtor.user.lastName}` : 
        'Unknown Student';
      
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      const student = studentName.padEnd(9);
      const owed = `$${(debtor.totalOwed || 0).toFixed(2)}`.padStart(12);
      const paid = `$${totalPaid.toFixed(2)}`.padStart(12);
      const balance = `$${(debtor.currentBalance || 0).toFixed(2)}`.padStart(12);
      const lastPayment = debtor.lastPaymentDate ? 
        new Date(debtor.lastPaymentDate).toLocaleDateString().padEnd(12) : 
        'Never'.padEnd(12);
      
      console.log(`│ ${code} │ ${student} │ ${owed} │ ${paid} │ ${balance} │ ${lastPayment} │`);
    });
    
    console.log('├─────────────┼──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalFromDebtorsPadded = `$${totalFromDebtors.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │          │             │ ${totalFromDebtorsPadded} │             │             │`);
    console.log('└─────────────┴──────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // SUMMARY AND RECONCILIATION
    // ========================================
    console.log('📋 SUMMARY AND RECONCILIATION');
    console.log('==============================\n');
    
    console.log('🔍 PAYMENT RECONCILIATION:');
    console.log('┌─────────────────────────────────────────────────┬─────────────┐');
    console.log('│ Source                                         │ Amount      │');
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    const entriesPadded = `$${totalFromEntries.toFixed(2)}`.padStart(12);
    const paymentsPadded = `$${totalFromPayments.toFixed(2)}`.padStart(12);
    const debtorsPadded = `$${totalFromDebtors.toFixed(2)}`.padStart(12);
    
    console.log(`│ Transaction Entries (Cash Basis)                │ ${entriesPadded} │`);
    console.log(`│ Payment Collection                              │ ${paymentsPadded} │`);
    console.log(`│ Debtor Payment History                          │ ${debtorsPadded} │`);
    
    console.log('├─────────────────────────────────────────────────┼─────────────┤');
    
    // Find the difference
    const difference = totalFromEntries - totalFromPayments;
    const differencePadded = `$${Math.abs(difference).toFixed(2)}`.padStart(12);
    
    if (difference === 0) {
      console.log(`│ ✅ PERFECT MATCH!                              │ $0.00       │`);
    } else if (difference > 0) {
      console.log(`│ ⚠️  DIFFERENCE (Entries > Payments)            │ +${differencePadded} │`);
    } else {
      console.log(`│ ⚠️  DIFFERENCE (Payments > Entries)            │ -${differencePadded} │`);
    }
    
    console.log('└─────────────────────────────────────────────────┴─────────────┘\n');
    
    // ========================================
    // STUDENT BREAKDOWN
    // ========================================
    console.log('📋 STUDENT PAYMENT BREAKDOWN');
    console.log('============================\n');
    
    if (Object.keys(paymentsByStudent).length > 0) {
      console.log('👥 PAYMENTS BY STUDENT:');
      console.log('┌─────────────────────────────────────────────────┬─────────────┬─────────────┐');
      console.log('│ Student                                        │ Total Paid  │ Payment Count│');
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┤');
      
      Object.entries(paymentsByStudent).forEach(([studentId, data]) => {
        const studentPadded = data.name.padEnd(45);
        const totalPadded = `$${data.total.toFixed(2)}`.padStart(12);
        const countPadded = data.payments.length.toString().padStart(12);
        
        console.log(`│ ${studentPadded} │ ${totalPadded} │ ${countPadded} │`);
      });
      
      console.log('├─────────────────────────────────────────────────┼─────────────┼─────────────┤');
      const totalStudentsPadded = `$${totalFromEntries.toFixed(2)}`.padStart(12);
      const totalCountPadded = Object.values(paymentsByStudent).reduce((sum, data) => sum + data.payments.length, 0).toString().padStart(12);
      console.log(`│ TOTAL                                          │ ${totalStudentsPadded} │ ${totalCountPadded} │`);
      console.log('└─────────────────────────────────────────────────┴─────────────┴─────────────┘\n');
    }
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('🎯 FINAL SUMMARY');
    console.log('================\n');
    
    console.log('✅ WHAT WE FOUND:');
    console.log('   • Total Cash Received (from entries): $' + totalFromEntries.toFixed(2));
    console.log('   • Total Payments (from Payment collection): $' + totalFromPayments.toFixed(2));
    console.log('   • Total Paid (from Debtor history): $' + totalFromDebtors.toFixed(2));
    
    if (difference !== 0) {
      console.log('\n⚠️  RECONCILIATION ISSUES:');
      console.log('   • There is a $' + Math.abs(difference).toFixed(2) + ' difference between sources');
      console.log('   • This could be due to:');
      console.log('     - Pending payments not yet posted');
      console.log('     - Manual adjustments or transfers');
      console.log('     - Different posting dates');
    } else {
      console.log('\n✅ PERFECT RECONCILIATION:');
      console.log('   • All payment sources match perfectly!');
    }
    
    console.log('\n🎉 STUDENT PAYMENT ANALYSIS COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error finding students who paid:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
findStudentsWhoPaid();
