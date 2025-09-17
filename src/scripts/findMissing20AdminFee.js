/**
 * Find the specific $20 admin fee payment missing from cash flow
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

async function findMissing20AdminFee() {
  try {
    console.log('🔍 Finding the specific $20 admin fee missing from cash flow...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025 with admin fees
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).populate('student').sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    // Get all cash flow relevant transaction entries for August 2025
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
          studentName: payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown',
          amount: adminFee,
          date: payment.date
        });
      }
    });
    
    console.log(`\n📊 Admin fees from payments: $${adminFeePayments} (${adminFeePaymentDetails.length} payments)`);
    
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
                source: entry.source
              });
            }
          }
        });
      }
    });
    
    console.log(`📊 Admin fees from cash flow transactions: $${adminFeeTransactions} (${adminFeeTransactionDetails.length} transactions)`);
    
    const difference = adminFeePayments - adminFeeTransactions;
    console.log(`\n🔍 Difference: $${difference}`);
    
    if (difference === 20) {
      console.log(`✅ Found the missing $20!`);
      
      // Find which payment doesn't have a corresponding transaction
      console.log(`\n🔍 Checking which payment is missing from transactions...`);
      
      for (const paymentDetail of adminFeePaymentDetails) {
        // Look for transaction entries that reference this payment
        const relatedTransactions = await TransactionEntry.find({
          $or: [
            { description: { $regex: paymentDetail.paymentId, $options: 'i' } },
            { 'metadata.paymentId': paymentDetail.paymentId }
          ]
        });
        
        if (relatedTransactions.length === 0) {
          console.log(`❌ Payment ${paymentDetail.paymentId} (${paymentDetail.studentName}) - $${paymentDetail.amount} has no transaction entries`);
          console.log(`   Date: ${paymentDetail.date.toISOString().split('T')[0]}`);
        }
      }
    }
    
    // Show all admin fee transactions for comparison
    console.log(`\n📋 All admin fee transactions in cash flow:`);
    adminFeeTransactionDetails.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.transactionId} - $${tx.amount} - ${tx.date.toISOString().split('T')[0]} - ${tx.source}`);
      console.log(`      Description: ${tx.description}`);
    });
    
    // Show all admin fee payments for comparison
    console.log(`\n📋 All admin fee payments:`);
    adminFeePaymentDetails.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.paymentId} - ${payment.studentName} - $${payment.amount} - ${payment.date.toISOString().split('T')[0]}`);
    });
    
  } catch (error) {
    console.error('❌ Error finding missing $20 admin fee:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findMissing20AdminFee();


