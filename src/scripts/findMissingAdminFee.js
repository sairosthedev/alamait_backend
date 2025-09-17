/**
 * Compare payments against transaction entries to find missing $20 admin fee
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

async function findMissingAdminFee() {
  try {
    console.log('🔍 Finding missing $20 admin fee by comparing payments vs transaction entries...');
    
    // Define August 2025 date range
    const augustStart = new Date('2025-08-01');
    const augustEnd = new Date('2025-08-31');
    
    // Get all payments for August 2025
    const payments = await Payment.find({
      date: { $gte: augustStart, $lte: augustEnd },
      status: { $in: ['Confirmed', 'confirmed', 'Paid', 'paid'] }
    }).populate('student').sort({ date: 1 });
    
    console.log(`💰 Found ${payments.length} payments for August 2025`);
    
    // Get all transaction entries for August 2025
    const transactionEntries = await TransactionEntry.find({
      date: { $gte: augustStart, $lte: augustEnd }
    }).sort({ date: 1 });
    
    console.log(`💳 Found ${transactionEntries.length} transaction entries for August 2025`);
    
    // Analyze each payment to see if it has corresponding transaction entries
    const paymentAnalysis = [];
    let totalAdminFeesFromPayments = 0;
    let totalAdminFeesFromTransactions = 0;
    
    for (const payment of payments) {
      const student = payment.student;
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
      const studentId = student ? student._id.toString() : payment.student?.toString() || 'Unknown';
      
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
        // Assume $20 payments are admin fees
        adminFeeFromPayment = 20;
      }
      
      totalAdminFeesFromPayments += adminFeeFromPayment;
      
      // Look for corresponding transaction entries
      const relatedTransactions = await TransactionEntry.find({
        $or: [
          { sourceId: payment._id },
          { reference: payment._id.toString() },
          { 'metadata.paymentId': payment.paymentId },
          { description: { $regex: payment.paymentId, $options: 'i' } },
          { 'entries.accountCode': { $regex: studentId } }
        ]
      });
      
      // Calculate admin fee from transactions
      let adminFeeFromTransactions = 0;
      relatedTransactions.forEach(entry => {
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(line => {
            // Look for admin fee accounts (usually 4002)
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
        studentId: studentId,
        paymentDate: payment.date,
        paymentAmount: payment.totalAmount || payment.amount,
        adminFeeFromPayment: adminFeeFromPayment,
        adminFeeFromTransactions: adminFeeFromTransactions,
        hasTransactionEntries: relatedTransactions.length > 0,
        transactionCount: relatedTransactions.length,
        isMissing: adminFeeFromPayment > 0 && adminFeeFromTransactions === 0,
        difference: adminFeeFromPayment - adminFeeFromTransactions
      };
      
      paymentAnalysis.push(analysis);
      
      // Log details for payments with admin fees
      if (adminFeeFromPayment > 0) {
        console.log(`\n💰 Payment: ${payment.paymentId} - ${studentName}`);
        console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
        console.log(`   Total Amount: $${payment.totalAmount || payment.amount}`);
        console.log(`   Admin Fee (Payment): $${adminFeeFromPayment}`);
        console.log(`   Admin Fee (Transactions): $${adminFeeFromTransactions}`);
        console.log(`   Has Transaction Entries: ${relatedTransactions.length > 0}`);
        console.log(`   Transaction Count: ${relatedTransactions.length}`);
        
        if (relatedTransactions.length > 0) {
          console.log(`   Related Transactions:`);
          relatedTransactions.forEach((tx, index) => {
            console.log(`      ${index + 1}. ${tx.transactionId} - $${tx.totalDebit || 0} - ${tx.source}`);
            console.log(`         Description: ${tx.description}`);
          });
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
      console.log(`      Student ID: ${payment.studentId}`);
    });
    
    // Also check for any admin fee transactions that don't have corresponding payments
    console.log(`\n🔍 Checking for orphaned admin fee transactions...`);
    const adminFeeTransactions = [];
    
    transactionEntries.forEach(entry => {
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
                accountCode: line.accountCode,
                accountName: line.accountName
              });
            }
          }
        });
      }
    });
    
    console.log(`   Found ${adminFeeTransactions.length} admin fee transactions in August:`);
    adminFeeTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.transactionId} - $${tx.amount} - ${tx.date.toISOString().split('T')[0]}`);
      console.log(`      Description: ${tx.description}`);
    });
    
  } catch (error) {
    console.error('❌ Error finding missing admin fee:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
findMissingAdminFee();


