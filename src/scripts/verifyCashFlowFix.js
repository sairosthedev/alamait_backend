/**
 * Verify that the cash flow fix is working by checking transaction date mapping
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

async function verifyCashFlowFix() {
  try {
    console.log('🔍 Verifying cash flow fix by checking transaction date mapping...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all transaction entries that should be in cash flow (including those with September dates)
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
    
    // Simulate the cash flow service logic
    let adminFeeTransactions = 0;
    let transactionsWithUpdatedDates = 0;
    let transactionsWithoutPayments = 0;
    
    for (const entry of allTransactionEntries) {
      let payment = null;
      let originalDate = entry.date;
      let updatedDate = entry.date;
      
      // Try to find payment by sourceId first
      if (entry.sourceId) {
        try {
          payment = await Payment.findById(entry.sourceId);
        } catch (error) {
          // Ignore error
        }
      }
      
      // If not found by sourceId, try to find by reference (payment ID)
      if (!payment && entry.reference) {
        try {
          payment = await Payment.findById(entry.reference);
        } catch (error) {
          // Ignore error
        }
      }
      
      // If not found by reference, try to find by metadata.paymentId
      if (!payment && entry.metadata && entry.metadata.paymentId) {
        try {
          payment = await Payment.findById(entry.metadata.paymentId);
        } catch (error) {
          // Ignore error
        }
      }
      
      // If payment found, update the entry date to use the actual payment date
      if (payment && payment.date) {
        updatedDate = new Date(payment.date);
        transactionsWithUpdatedDates++;
        
        // Check if this transaction would now be included in August cash flow
        if (updatedDate >= augustStart && updatedDate <= augustEnd) {
          // Count admin fees from this transaction
          if (entry.entries && Array.isArray(entry.entries)) {
            entry.entries.forEach(line => {
              if (line.accountCode === '4002' || 
                  (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
                const amount = line.credit || 0;
                if (amount > 0) {
                  adminFeeTransactions += amount;
                  console.log(`✅ Found admin fee: $${amount} from ${entry.transactionId} (${originalDate.toISOString().split('T')[0]} -> ${updatedDate.toISOString().split('T')[0]})`);
                }
              }
            });
          }
        }
      } else {
        transactionsWithoutPayments++;
        console.log(`⚠️ Transaction ${entry.transactionId} has no corresponding payment`);
        console.log(`   Reference: ${entry.reference}`);
        console.log(`   SourceId: ${entry.sourceId}`);
        console.log(`   Metadata: ${JSON.stringify(entry.metadata)}`);
      }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`   Total transactions processed: ${allTransactionEntries.length}`);
    console.log(`   Transactions with updated dates: ${transactionsWithUpdatedDates}`);
    console.log(`   Transactions without payments: ${transactionsWithoutPayments}`);
    console.log(`   Admin fees found: $${adminFeeTransactions}`);
    
    // Also check payments directly
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    });
    
    let adminFeePayments = 0;
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
      }
    });
    
    console.log(`   Admin fees from payments: $${adminFeePayments}`);
    console.log(`   Difference: $${adminFeePayments - adminFeeTransactions}`);
    
    if (adminFeePayments === adminFeeTransactions) {
      console.log(`✅ Perfect match! The fix is working.`);
    } else {
      console.log(`❌ Still a discrepancy. Need to investigate further.`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying cash flow fix:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
verifyCashFlowFix();


