/**
 * Check every payment against its corresponding transaction entries
 * to find which payment is missing transaction entries (causing $20 admin fee discrepancy)
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

async function checkPaymentTransactionMapping() {
  try {
    console.log('🔍 Checking every payment against its corresponding transaction entries...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).populate('student').sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    let totalAdminFeesFromPayments = 0;
    let totalAdminFeesFromTransactions = 0;
    const paymentAnalysis = [];
    
    // Check each payment individually
    for (const payment of payments) {
      const studentName = payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown Student';
      
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
        
        // Find transaction entries using multiple methods
        const transactionEntries = await TransactionEntry.find({
          $or: [
            // Method 1: Direct reference to payment ID
            { reference: payment._id.toString() },
            // Method 2: Source ID matches payment ID
            { sourceId: payment._id },
            // Method 3: Payment ID in metadata
            { 'metadata.paymentId': payment.paymentId },
            // Method 4: Payment ID in description
            { description: { $regex: payment.paymentId, $options: 'i' } },
            // Method 5: Student ID in account codes
            { 'entries.accountCode': { $regex: payment.student?.toString() || payment.user?.toString(), $options: 'i' } }
          ]
        });
        
        // Calculate admin fee from transactions
        let adminFeeFromTransactions = 0;
        transactionEntries.forEach(entry => {
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
        
        const analysis = {
          paymentId: payment.paymentId,
          studentName: studentName,
          paymentDate: payment.date,
          totalAmount: payment.totalAmount || payment.amount,
          adminFeeFromPayment: adminFeeFromPayment,
          adminFeeFromTransactions: adminFeeFromTransactions,
          transactionCount: transactionEntries.length,
          isMissing: adminFeeFromPayment > 0 && adminFeeFromTransactions === 0,
          difference: adminFeeFromPayment - adminFeeFromTransactions,
          transactions: transactionEntries.map(tx => ({
            transactionId: tx.transactionId,
            source: tx.source,
            amount: tx.totalDebit || 0,
            description: tx.description
          }))
        };
        
        paymentAnalysis.push(analysis);
        
        // Log details for each payment
        console.log(`\n💰 Payment: ${payment.paymentId} - ${studentName}`);
        console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
        console.log(`   Total Amount: $${payment.totalAmount || payment.amount}`);
        console.log(`   Admin Fee (Payment): $${adminFeeFromPayment}`);
        console.log(`   Admin Fee (Transactions): $${adminFeeFromTransactions}`);
        console.log(`   Transaction Count: ${transactionEntries.length}`);
        
        if (transactionEntries.length > 0) {
          console.log(`   Related Transactions:`);
          transactionEntries.forEach((tx, index) => {
            console.log(`      ${index + 1}. ${tx.transactionId} - $${tx.totalDebit || 0} - ${tx.source}`);
            console.log(`         Description: ${tx.description}`);
            console.log(`         Reference: ${tx.reference}`);
            console.log(`         Source ID: ${tx.sourceId}`);
          });
        } else {
          console.log(`   ❌ NO TRANSACTION ENTRIES FOUND!`);
        }
        
        if (analysis.isMissing) {
          console.log(`   ❌ MISSING: Admin fee transaction not found!`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Admin Fees from Payments: $${totalAdminFeesFromPayments}`);
    console.log(`   Total Admin Fees from Transactions: $${totalAdminFeesFromTransactions}`);
    console.log(`   Difference: $${totalAdminFeesFromPayments - totalAdminFeesFromTransactions}`);
    
    // Find payments with missing admin fee transactions
    const missingPayments = paymentAnalysis.filter(p => p.isMissing);
    console.log(`\n❌ Found ${missingPayments.length} payments with missing admin fee transactions:`);
    
    missingPayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.paymentId} - ${payment.studentName}`);
      console.log(`      Date: ${payment.paymentDate.toISOString().split('T')[0]}`);
      console.log(`      Missing Admin Fee: $${payment.adminFeeFromPayment}`);
      console.log(`      Transaction Count: ${payment.transactionCount}`);
    });
    
    // Also check for payments with partial admin fees
    const partialPayments = paymentAnalysis.filter(p => p.difference > 0 && !p.isMissing);
    if (partialPayments.length > 0) {
      console.log(`\n⚠️ Found ${partialPayments.length} payments with partial admin fee transactions:`);
      partialPayments.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.paymentId} - ${payment.studentName}`);
        console.log(`      Expected: $${payment.adminFeeFromPayment}, Found: $${payment.adminFeeFromTransactions}, Missing: $${payment.difference}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking payment transaction mapping:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
checkPaymentTransactionMapping();


