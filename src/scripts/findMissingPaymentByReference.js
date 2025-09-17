/**
 * Find missing payment by checking reference field in transaction entries
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const TransactionEntry = require('../models/TransactionEntry');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function findMissingPaymentByReference() {
  try {
    console.log('🔍 Finding missing payment by checking reference field...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    // Get all transaction entries for August 2025
    const transactionEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd }
    }).sort({ date: 1 });
    
    console.log(`💳 Found ${transactionEntries.length} transaction entries for August 2025`);
    
    // Create a map of payment IDs to payments
    const paymentMap = new Map();
    payments.forEach(payment => {
      paymentMap.set(payment._id.toString(), payment);
    });
    
    // Create a map of references to transaction entries
    const referenceMap = new Map();
    transactionEntries.forEach(entry => {
      if (entry.reference) {
        if (!referenceMap.has(entry.reference)) {
          referenceMap.set(entry.reference, []);
        }
        referenceMap.get(entry.reference).push(entry);
      }
    });
    
    console.log(`\n🔍 Checking which payments have transaction entries by reference...`);
    
    let paymentsWithTransactions = 0;
    let paymentsWithoutTransactions = 0;
    let totalAdminFeesFromPayments = 0;
    let totalAdminFeesFromTransactions = 0;
    
    const missingPayments = [];
    
    for (const payment of payments) {
      const paymentId = payment._id.toString();
      const hasTransactions = referenceMap.has(paymentId);
      
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
        
        if (hasTransactions) {
          paymentsWithTransactions++;
          const transactions = referenceMap.get(paymentId);
          
          // Calculate admin fee from transactions
          let adminFeeFromTransactions = 0;
          transactions.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
              entry.entries.forEach(line => {
                if (line.accountCode === '4002' || 
                    (line.accountName && line.accountName.toLowerCase().includes('admin'))) {
                  adminFeeFromTransactions += line.credit || 0;
                }
              });
            }
          });
          
          totalAdminFeesFromTransactions += adminFeeFromTransactions;
          
          console.log(`✅ ${payment.paymentId} - $${adminFeeFromPayment} admin fee - ${transactions.length} transactions - $${adminFeeFromTransactions} from transactions`);
        } else {
          paymentsWithoutTransactions++;
          missingPayments.push({
            paymentId: payment.paymentId,
            paymentAmount: payment.totalAmount || payment.amount,
            adminFee: adminFeeFromPayment,
            date: payment.date,
            student: payment.student || payment.user
          });
          
          console.log(`❌ ${payment.paymentId} - $${adminFeeFromPayment} admin fee - NO TRANSACTIONS FOUND`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Payments with transactions: ${paymentsWithTransactions}`);
    console.log(`   Payments without transactions: ${paymentsWithoutTransactions}`);
    console.log(`   Total Admin Fees from Payments: $${totalAdminFeesFromPayments}`);
    console.log(`   Total Admin Fees from Transactions: $${totalAdminFeesFromTransactions}`);
    console.log(`   Difference: $${totalAdminFeesFromPayments - totalAdminFeesFromTransactions}`);
    
    if (missingPayments.length > 0) {
      console.log(`\n❌ Missing payments (no transaction entries found):`);
      missingPayments.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.paymentId} - $${payment.adminFee} admin fee - ${payment.date.toISOString().split('T')[0]}`);
        console.log(`      Student: ${payment.student}`);
        console.log(`      Total Amount: $${payment.paymentAmount}`);
      });
    }
    
    // Also check for transaction entries that don't have corresponding payments
    console.log(`\n🔍 Checking for transaction entries without corresponding payments...`);
    const orphanedTransactions = [];
    
    for (const [reference, transactions] of referenceMap) {
      if (!paymentMap.has(reference)) {
        orphanedTransactions.push({
          reference: reference,
          transactions: transactions
        });
      }
    }
    
    if (orphanedTransactions.length > 0) {
      console.log(`   Found ${orphanedTransactions.length} orphaned transaction entries:`);
      orphanedTransactions.forEach((orphan, index) => {
        console.log(`   ${index + 1}. Reference: ${orphan.reference}`);
        orphan.transactions.forEach(tx => {
          console.log(`      - ${tx.transactionId} - $${tx.totalDebit || 0} - ${tx.source}`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error finding missing payment by reference:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findMissingPaymentByReference();