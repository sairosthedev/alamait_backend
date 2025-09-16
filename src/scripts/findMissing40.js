/**
 * Find the specific $40 payment missing from cash flow
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

async function findMissing40() {
  try {
    console.log('🔍 Finding the missing $40 payment for August...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
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
      'metadata.isForfeiture': { $ne: true }
    }).sort({ date: 1 });
    
    console.log(`💳 Found ${transactionEntries.length} transaction entries for August 2025`);
    
    // Create a map of payment amounts to payments
    const paymentAmounts = new Map();
    payments.forEach(payment => {
      const amount = payment.totalAmount || payment.amount || 0;
      if (!paymentAmounts.has(amount)) {
        paymentAmounts.set(amount, []);
      }
      paymentAmounts.get(amount).push(payment);
    });
    
    // Create a map of transaction amounts to transactions
    const transactionAmounts = new Map();
    transactionEntries.forEach(entry => {
      const amount = entry.totalDebit || 0;
      if (!transactionAmounts.has(amount)) {
        transactionAmounts.set(amount, []);
      }
      transactionAmounts.get(amount).push(entry);
    });
    
    // Check for $40 specifically
    const payments40 = paymentAmounts.get(40) || [];
    const transactions40 = transactionAmounts.get(40) || [];
    
    console.log(`\n🔍 $40 Analysis:`);
    console.log(`   Payments with $40: ${payments40.length}`);
    console.log(`   Transactions with $40: ${transactions40.length}`);
    
    if (payments40.length > 0) {
      console.log(`\n💰 $40 Payments:`);
      payments40.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.paymentId} - ${payment.date.toISOString().split('T')[0]} - ${payment.status}`);
        console.log(`      Student: ${payment.student || payment.user}`);
        console.log(`      Method: ${payment.method}`);
      });
    }
    
    if (transactions40.length > 0) {
      console.log(`\n💳 $40 Transactions:`);
      transactions40.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.transactionId} - ${entry.date.toISOString().split('T')[0]} - ${entry.source}`);
        console.log(`      Description: ${entry.description}`);
      });
    }
    
    // Check if any $40 payments don't have corresponding transactions
    if (payments40.length > transactions40.length) {
      console.log(`\n❌ Found ${payments40.length - transactions40.length} $40 payment(s) without transaction entries:`);
      
      for (const payment of payments40) {
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
          console.log(`   ❌ Payment ${payment.paymentId} ($${payment.totalAmount || payment.amount}) has no transaction entries`);
          console.log(`      Date: ${payment.date.toISOString().split('T')[0]}`);
          console.log(`      Status: ${payment.status}`);
          console.log(`      Student: ${payment.student || payment.user}`);
          console.log(`      Method: ${payment.method}`);
        }
      }
    }
    
    // Also check for other amounts that might be missing
    console.log(`\n🔍 Checking for other missing amounts...`);
    for (const [amount, paymentList] of paymentAmounts) {
      const transactionList = transactionAmounts.get(amount) || [];
      if (paymentList.length > transactionList.length) {
        console.log(`   ⚠️ Amount $${amount}: ${paymentList.length} payments vs ${transactionList.length} transactions (${paymentList.length - transactionList.length} missing)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding missing $40:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findMissing40();

