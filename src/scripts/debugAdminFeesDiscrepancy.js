/**
 * Debug script to find the $20 discrepancy in admin fees
 * Cash flow shows $560 but payments show $580
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const TransactionEntry = require('../models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function debugAdminFeesDiscrepancy() {
  try {
    console.log('🔍 Debugging admin fees discrepancy: Cash flow $560 vs Payments $580');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    console.log(`📅 Checking period: ${augustStart.toISOString().split('T')[0]} to ${augustEnd.toISOString().split('T')[0]}`);
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`\n💰 Analyzing ${payments.length} payments for admin fees...`);
    
    let totalAdminFeesFromPayments = 0;
    const adminFeePayments = [];
    
    payments.forEach((payment, index) => {
      // Check if payment has admin fee
      let adminFee = 0;
      
      // Method 1: Check adminFee field
      if (payment.adminFee && payment.adminFee > 0) {
        adminFee = payment.adminFee;
      }
      
      // Method 2: Check payments array for admin type
      if (payment.payments && Array.isArray(payment.payments)) {
        const adminPayment = payment.payments.find(p => p.type === 'admin');
        if (adminPayment && adminPayment.amount > 0) {
          adminFee = adminPayment.amount;
        }
      }
      
      // Method 3: Check if total amount matches typical admin fee (usually $20)
      if (adminFee === 0 && payment.totalAmount === 20) {
        adminFee = 20; // Assume it's an admin fee payment
      }
      
      if (adminFee > 0) {
        totalAdminFeesFromPayments += adminFee;
        adminFeePayments.push({
          paymentId: payment.paymentId,
          amount: adminFee,
          totalAmount: payment.totalAmount,
          date: payment.date,
          method: payment.method,
          student: payment.student || payment.user
        });
      }
    });
    
    console.log(`\n📊 Admin fees from payments: $${totalAdminFeesFromPayments}`);
    console.log(`📋 Found ${adminFeePayments.length} payments with admin fees:`);
    
    adminFeePayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.amount} - ${payment.date.toISOString().split('T')[0]} - ${payment.method}`);
    });
    
    // Now check transaction entries for admin fees
    const transactionEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd },
      source: {
        $in: [
          'rental_payment',
          'expense_payment', 
          'manual',
          'payment_collection',
          'bank_transfer',
          'payment',
          'advance_payment',
          'debt_settlement',
          'current_payment'
        ]
      },
      'metadata.isForfeiture': { $ne: true }
    }).sort({ date: 1 });
    
    console.log(`\n💳 Analyzing ${transactionEntries.length} transaction entries for admin fees...`);
    
    let totalAdminFeesFromTransactions = 0;
    const adminFeeTransactions = [];
    
    transactionEntries.forEach((entry) => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach((line) => {
          // Look for admin fee accounts (usually 4002)
          if (line.accountCode === '4002' || 
              (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
            const amount = line.credit || 0;
            if (amount > 0) {
              totalAdminFeesFromTransactions += amount;
              adminFeeTransactions.push({
                transactionId: entry.transactionId,
                amount: amount,
                date: entry.date,
                description: entry.description,
                accountCode: line.accountCode,
                accountName: line.accountName
              });
            }
          }
        });
      }
    });
    
    console.log(`\n📊 Admin fees from transactions: $${totalAdminFeesFromTransactions}`);
    console.log(`📋 Found ${adminFeeTransactions.length} transaction entries with admin fees:`);
    
    adminFeeTransactions.forEach((transaction, index) => {
      console.log(`   ${index + 1}. ${transaction.transactionId} - $${transaction.amount} - ${transaction.date.toISOString().split('T')[0]}`);
      console.log(`      Account: ${transaction.accountCode} - ${transaction.accountName}`);
      console.log(`      Description: ${transaction.description}`);
    });
    
    // Calculate the difference
    const difference = totalAdminFeesFromPayments - totalAdminFeesFromTransactions;
    console.log(`\n🔍 Analysis:`);
    console.log(`   Payments total: $${totalAdminFeesFromPayments}`);
    console.log(`   Transactions total: $${totalAdminFeesFromTransactions}`);
    console.log(`   Difference: $${difference}`);
    
    if (Math.abs(difference - 20) < 0.01) {
      console.log(`✅ Found the missing $20! Difference is exactly $${difference}`);
    } else if (difference > 0) {
      console.log(`⚠️ Payments are $${difference} higher than transactions`);
    } else if (difference < 0) {
      console.log(`⚠️ Transactions are $${Math.abs(difference)} higher than payments`);
    }
    
    // Check for payments that don't have corresponding transaction entries
    console.log(`\n🔍 Checking for admin fee payments without transaction entries...`);
    
    for (const payment of adminFeePayments) {
      // Look for transaction entries that reference this payment
      const relatedTransactions = await TransactionEntry.find({
        $or: [
          { sourceId: payment.paymentId },
          { reference: payment.paymentId },
          { 'metadata.paymentId': payment.paymentId },
          { description: { $regex: payment.paymentId, $options: 'i' } }
        ]
      });
      
      if (relatedTransactions.length === 0) {
        console.log(`❌ Admin fee payment ${payment.paymentId} ($${payment.amount}) has no transaction entries`);
        console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
        console.log(`   Method: ${payment.method}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging admin fees discrepancy:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
debugAdminFeesDiscrepancy();


