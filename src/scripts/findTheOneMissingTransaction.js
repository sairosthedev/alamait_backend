/**
 * Find the one missing transaction entry by checking all existing transaction entries
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

async function findTheOneMissingTransaction() {
  try {
    console.log('🔍 Finding the one missing transaction entry...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    // Get ALL transaction entries for August 2025 (not just cash flow ones)
    const allTransactionEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd }
    }).sort({ date: 1 });
    
    console.log(`💳 Found ${allTransactionEntries.length} total transaction entries for August 2025`);
    
    // Get cash flow relevant transaction entries
    const cashFlowEntries = await TransactionEntry.find({
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
    
    console.log(`💳 Found ${cashFlowEntries.length} cash flow relevant transaction entries for August 2025`);
    
    // Show all transaction entries by source
    const sources = new Map();
    allTransactionEntries.forEach(entry => {
      const source = entry.source || 'unknown';
      if (!sources.has(source)) {
        sources.set(source, []);
      }
      sources.get(source).push(entry);
    });
    
    console.log(`\n📋 All transaction entries by source:`);
    for (const [source, entries] of sources) {
      const totalAmount = entries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
      console.log(`   ${source}: ${entries.length} entries, total: $${totalAmount.toFixed(2)}`);
      
      // Show first few entries for each source
      entries.slice(0, 2).forEach(entry => {
        console.log(`      - ${entry.transactionId}: $${entry.totalDebit || 0} - ${entry.description}`);
      });
      if (entries.length > 2) {
        console.log(`      ... and ${entries.length - 2} more`);
      }
    }
    
    // Count admin fees from cash flow transactions
    let adminFeeTransactions = 0;
    const adminFeeTransactionDetails = [];
    
    cashFlowEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(line => {
          if (line.accountCode === '4002' || 
              (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
            const amount = line.credit || 0;
            if (amount > 0) {
              adminFeeTransactions += amount;
              adminFeeTransactionDetails.push({
                transactionId: entry.transactionId,
                amount: amount,
                date: entry.date,
                description: entry.description,
                source: entry.source,
                reference: entry.reference
              });
            }
          }
        });
      }
    });
    
    console.log(`\n📊 Admin fees from cash flow transactions: $${adminFeeTransactions}`);
    console.log(`📋 Found ${adminFeeTransactionDetails.length} admin fee transactions:`);
    
    adminFeeTransactionDetails.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.transactionId} - $${tx.amount} - ${tx.date.toISOString().split('T')[0]} - ${tx.source}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Reference: ${tx.reference}`);
    });
    
    // Count admin fees from payments
    let adminFeePayments = 0;
    const adminFeePaymentDetails = [];
    
    payments.forEach(payment => {
      let adminFee = 0;
      if (payment.adminFee && payment.adminFee > 0) {
        adminFee = payment.adminFee;
      } else if (payment.payments && Array.isArray(payment.payments)) {
        const adminPayment = payment.payments.find(p => p.type === 'admin');
        if (adminPayment && adminPayment.amount > 0) {
          adminFee = adminPayment.amount;
        }
      } else if (payment.totalAmount === 20) {
        adminFee = 20;
      }
      
      if (adminFee > 0) {
        adminFeePayments += adminFee;
        adminFeePaymentDetails.push({
          paymentId: payment.paymentId,
          amount: adminFee,
          date: payment.date,
          student: payment.student || payment.user
        });
      }
    });
    
    console.log(`\n📊 Admin fees from payments: $${adminFeePayments}`);
    console.log(`📋 Found ${adminFeePaymentDetails.length} payments with admin fees`);
    
    const difference = adminFeePayments - adminFeeTransactions;
    console.log(`\n🔍 Difference: $${difference}`);
    
    if (difference === 20) {
      console.log(`✅ Found the missing $20!`);
      
      // Try to find which payment doesn't have a corresponding transaction
      console.log(`\n🔍 Checking which payment is missing its transaction...`);
      
      for (const paymentDetail of adminFeePaymentDetails) {
        // Look for transaction entries that might reference this payment
        const relatedTransactions = await TransactionEntry.find({
          $or: [
            { reference: paymentDetail.paymentId },
            { description: { $regex: paymentDetail.paymentId, $options: 'i' } },
            { 'metadata.paymentId': paymentDetail.paymentId }
          ]
        });
        
        if (relatedTransactions.length === 0) {
          console.log(`❌ Payment ${paymentDetail.paymentId} - $${paymentDetail.amount} has no transaction entries`);
          console.log(`   Date: ${paymentDetail.date.toISOString().split('T')[0]}`);
          console.log(`   Student: ${paymentDetail.student}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding the one missing transaction:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findTheOneMissingTransaction();


