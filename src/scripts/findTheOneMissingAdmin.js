/**
 * Find the one missing admin fee transaction
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

async function findTheOneMissingAdmin() {
  try {
    console.log('🔍 Finding the one missing admin fee transaction...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    // Get all transaction entries (no date filter to catch September transactions)
    const allTransactionEntries = await TransactionEntry.find({
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
    
    console.log(`💳 Found ${allTransactionEntries.length} total cash flow relevant transaction entries`);
    
    // Create a map of payment IDs to payments
    const paymentMap = new Map();
    payments.forEach(payment => {
      paymentMap.set(payment._id.toString(), payment);
    });
    
    // Check each payment to see if it has admin fee transactions
    let paymentsWithAdminTransactions = 0;
    let paymentsWithoutAdminTransactions = 0;
    let totalAdminFeesFromPayments = 0;
    let totalAdminFeesFromTransactions = 0;
    
    const missingPayments = [];
    
    for (const payment of payments) {
      const paymentId = payment._id.toString();
      
      // Calculate admin fee from payment
      let adminFeeFromPayment = 0;
      if (payment.adminFee && payment.adminFee > 0) {
        adminFeeFromPayment = payment.adminFee;
      } else if (payment.payments && Array.isArray(payment.payments)) {
        const adminPayment = payment.payments.find(p => p.type === 'admin');
        if (adminPayment && adminPayment.amount > 0) {
          adminFeeFromPayment = adminPayment.amount;
        }
      } else if (payment.totalAmount === 20) {
        adminFeeFromPayment = 20;
      }
      
      if (adminFeeFromPayment > 0) {
        totalAdminFeesFromPayments += adminFeeFromPayment;
        
        // Look for transaction entries that reference this payment
        const relatedTransactions = await TransactionEntry.find({
          $or: [
            { reference: paymentId },
            { sourceId: paymentId },
            { 'metadata.paymentId': payment.paymentId },
            { description: { $regex: payment.paymentId, $options: 'i' } }
          ]
        });
        
        // Calculate admin fee from transactions
        let adminFeeFromTransactions = 0;
        relatedTransactions.forEach(entry => {
          if (entry.entries && Array.isArray(entry.entries)) {
            entry.entries.forEach(line => {
              if (line.accountCode === '4002' || 
                  (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
                adminFeeFromTransactions += line.credit || 0;
              }
            });
          }
        });
        
        if (adminFeeFromTransactions > 0) {
          paymentsWithAdminTransactions++;
          totalAdminFeesFromTransactions += adminFeeFromTransactions;
          console.log(`✅ ${payment.paymentId} - $${adminFeeFromPayment} admin fee - Found $${adminFeeFromTransactions} in transactions`);
        } else {
          paymentsWithoutAdminTransactions++;
          missingPayments.push({
            paymentId: payment.paymentId,
            paymentAmount: payment.totalAmount || payment.amount,
            adminFee: adminFeeFromPayment,
            date: payment.date,
            student: payment.student || payment.user
          });
          console.log(`❌ ${payment.paymentId} - $${adminFeeFromPayment} admin fee - NO ADMIN TRANSACTIONS FOUND`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Payments with admin transactions: ${paymentsWithAdminTransactions}`);
    console.log(`   Payments without admin transactions: ${paymentsWithoutAdminTransactions}`);
    console.log(`   Total Admin Fees from Payments: $${totalAdminFeesFromPayments}`);
    console.log(`   Total Admin Fees from Transactions: $${totalAdminFeesFromTransactions}`);
    console.log(`   Difference: $${totalAdminFeesFromPayments - totalAdminFeesFromTransactions}`);
    
    if (missingPayments.length > 0) {
      console.log(`\n❌ Missing admin fee transactions:`);
      missingPayments.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.adminFee} admin fee - ${payment.date.toISOString().split('T')[0]}`);
        console.log(`      Student: ${payment.student}`);
        console.log(`      Total Amount: $${payment.paymentAmount}`);
      });
    }
    
    // Also check for any admin fee transactions that don't have corresponding payments
    console.log(`\n🔍 Checking for orphaned admin fee transactions...`);
    const adminFeeTransactions = [];
    
    allTransactionEntries.forEach(entry => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach(line => {
          if (line.accountCode === '4002' || 
              (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
            const amount = line.credit || 0;
            if (amount > 0) {
              adminFeeTransactions.push({
                transactionId: entry.transactionId,
                amount: amount,
                date: entry.date,
                description: entry.description,
                reference: entry.reference,
                source: entry.source
              });
            }
          }
        });
      }
    });
    
    console.log(`   Found ${adminFeeTransactions.length} admin fee transactions total:`);
    adminFeeTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.transactionId} - $${tx.amount} - ${tx.date.toISOString().split('T')[0]} - ${tx.source}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Reference: ${tx.reference}`);
    });
    
  } catch (error) {
    console.error('❌ Error finding the one missing admin:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findTheOneMissingAdmin();


