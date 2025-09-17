/**
 * Debug script to find missing $40 payment for August
 * 
 * This script compares payments vs cash flow entries to identify
 * which payment is not being included in the cash flow statement.
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

async function debugMissingPayment() {
  try {
    console.log('🔍 Debugging missing $40 payment for August...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    console.log(`📅 Checking period: ${augustStart.toISOString().split('T')[0]} to ${augustEnd.toISOString().split('T')[0]}`);
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`\n💰 Found ${payments.length} payments for August 2025:`);
    let totalPaymentAmount = 0;
    
    payments.forEach((payment, index) => {
      const amount = payment.totalAmount || payment.amount || 0;
      totalPaymentAmount += amount;
      console.log(`   ${index + 1}. ${payment.paymentId} - $${amount} - ${payment.date.toISOString().split('T')[0]} - ${payment.status}`);
    });
    
    console.log(`\n📊 Total payment amount: $${totalPaymentAmount}`);
    
    // Get all transaction entries for August 2025 that should be in cash flow
    const transactionEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd },
      source: {
        $in: [
          'rental_payment',
          'expense_payment', 
          'manual',
          'payment_collection',
          'bank_transfer',
          'payment'
        ]
      },
      // Exclude forfeiture transactions
      'metadata.isForfeiture': { $ne: true }
    }).sort({ date: 1 });
    
    console.log(`\n💳 Found ${transactionEntries.length} transaction entries for August 2025:`);
    let totalTransactionAmount = 0;
    
    transactionEntries.forEach((entry, index) => {
      const amount = entry.totalDebit || 0;
      totalTransactionAmount += amount;
      console.log(`   ${index + 1}. ${entry.transactionId} - $${amount} - ${entry.date.toISOString().split('T')[0]} - ${entry.source}`);
      console.log(`      Description: ${entry.description}`);
    });
    
    console.log(`\n📊 Total transaction amount: $${totalTransactionAmount}`);
    
    // Calculate the difference
    const difference = totalPaymentAmount - totalTransactionAmount;
    console.log(`\n🔍 Difference: $${difference}`);
    
    if (Math.abs(difference - 40) < 0.01) {
      console.log(`✅ Found the missing $40! Difference is exactly $${difference}`);
    } else if (difference > 0) {
      console.log(`⚠️ Payments are $${difference} higher than transactions`);
    } else if (difference < 0) {
      console.log(`⚠️ Transactions are $${Math.abs(difference)} higher than payments`);
    }
    
    // Look for payments that don't have corresponding transaction entries
    console.log(`\n🔍 Checking for payments without transaction entries...`);
    
    for (const payment of payments) {
      // Look for transaction entries that reference this payment
      const relatedTransactions = await TransactionEntry.find({
        $or: [
          { sourceId: payment._id },
          { reference: payment._id.toString() },
          { 'metadata.paymentId': payment.paymentId },
          { description: { $regex: payment.paymentId, $options: 'i' } }
        ]
      });
      
      if (relatedTransactions.length === 0) {
        console.log(`❌ Payment ${payment.paymentId} ($${payment.totalAmount || payment.amount}) has no transaction entries`);
        console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Student: ${payment.student || payment.user}`);
      }
    }
    
    // Look for transaction entries that don't have corresponding payments
    console.log(`\n🔍 Checking for transaction entries without payments...`);
    
    for (const entry of transactionEntries) {
      // Try to find corresponding payment
      let correspondingPayment = null;
      
      if (entry.sourceId) {
        correspondingPayment = await Payment.findById(entry.sourceId);
      }
      
      if (!correspondingPayment && entry.reference) {
        correspondingPayment = await Payment.findById(entry.reference);
      }
      
      if (!correspondingPayment) {
        console.log(`❌ Transaction ${entry.transactionId} ($${entry.totalDebit}) has no corresponding payment`);
        console.log(`   Date: ${entry.date.toISOString().split('T')[0]}`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   Description: ${entry.description}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging missing payment:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the debug
debugMissingPayment();


