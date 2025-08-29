const mongoose = require('mongoose');
require('dotenv').config();

async function fixMissingTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const PaymentService = require('./src/services/paymentService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Payment = require('./src/models/Payment');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🔧 FIXING MISSING TRANSACTIONS');
    console.log('==============================');
    
    // 1. Find payments with missing transactions
    console.log('\n1️⃣ FINDING PAYMENTS WITH MISSING TRANSACTIONS:');
    const payments = await Payment.find({
      student: studentId
    }).sort({ createdAt: -1 });
    
    const paymentsWithMissingTransactions = [];
    
    for (const payment of payments) {
      const paymentTransactions = await TransactionEntry.find({
        source: 'payment',
        'metadata.paymentId': payment._id.toString()
      });
      
      const paymentComponents = payment.payments || [];
      const transactionTypes = paymentTransactions.map(tx => tx.metadata?.paymentType).filter(Boolean);
      
      const missingComponents = paymentComponents.filter(comp => 
        !transactionTypes.includes(comp.type) && comp.amount > 0
      );
      
      if (missingComponents.length > 0) {
        paymentsWithMissingTransactions.push({
          payment,
          missingComponents,
          existingTransactions: paymentTransactions.length
        });
      }
    }
    
    console.log(`Found ${paymentsWithMissingTransactions.length} payments with missing transactions`);
    
    paymentsWithMissingTransactions.forEach((item, index) => {
      console.log(`\n  Payment ${index + 1}: ${item.payment.paymentId}`);
      console.log(`    Missing: ${item.missingComponents.map(c => `${c.type} ($${c.amount})`).join(', ')}`);
      console.log(`    Existing transactions: ${item.existingTransactions}`);
    });
    
    // 2. Reprocess payments with missing transactions
    console.log('\n2️⃣ REPROCESSING PAYMENTS WITH MISSING TRANSACTIONS:');
    
    for (const item of paymentsWithMissingTransactions) {
      const payment = item.payment;
      console.log(`\n🔧 Reprocessing payment: ${payment.paymentId}`);
      
      // Create payment data from existing payment
      const paymentData = {
        totalAmount: payment.totalAmount,
        payments: payment.payments,
        student: payment.student,
        residence: payment.residence,
        method: payment.method,
        date: payment.date
      };
      
      console.log('Payment data:', JSON.stringify(paymentData, null, 2));
      
      try {
        // Use a valid ObjectId for createdBy
        const validUserId = '67c023adae5e27657502e887'; // Use a real user ID
        
        console.log('Creating payment using PaymentService.createPaymentWithSmartAllocation...');
        const newPayment = await PaymentService.createPaymentWithSmartAllocation(
          paymentData,
          validUserId
        );
        
        console.log('✅ Payment reprocessed successfully');
        console.log(`New Payment ID: ${newPayment.paymentId}`);
        console.log(`Allocation: ${newPayment.allocation ? 'Completed' : 'Pending'}`);
        
        if (newPayment.allocation) {
          console.log('Allocation breakdown:');
          newPayment.allocation.monthlyBreakdown.forEach((allocation, index) => {
            console.log(`  ${index + 1}. ${allocation.paymentType}: $${allocation.amountAllocated} to ${allocation.month}`);
          });
        }
        
        // Wait for transactions to be created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check transactions created
        const newTransactions = await TransactionEntry.find({
          source: 'payment',
          'metadata.paymentId': newPayment._id.toString()
        }).sort({ date: 1 });
        
        console.log(`Created ${newTransactions.length} transactions for this payment`);
        
        newTransactions.forEach((tx, index) => {
          console.log(`  Transaction ${index + 1}:`);
          console.log(`    Description: ${tx.description}`);
          console.log(`    Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
          console.log(`    Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
          console.log(`    Amount: $${tx.totalDebit.toFixed(2)}`);
        });
        
        // Mark original payment as reprocessed
        payment.reprocessed = true;
        payment.reprocessedAt = new Date();
        payment.reprocessedTo = newPayment._id;
        await payment.save();
        
        console.log(`✅ Original payment ${payment.paymentId} marked as reprocessed`);
        
      } catch (error) {
        console.error(`❌ Failed to reprocess payment ${payment.paymentId}:`, error.message);
      }
    }
    
    // 3. Summary
    console.log('\n3️⃣ SUMMARY:');
    console.log(`Processed ${paymentsWithMissingTransactions.length} payments with missing transactions`);
    
    // Check final state
    const finalPayments = await Payment.find({
      student: studentId
    }).sort({ createdAt: -1 });
    
    let totalTransactions = 0;
    for (const payment of finalPayments) {
      const paymentTransactions = await TransactionEntry.find({
        source: 'payment',
        'metadata.paymentId': payment._id.toString()
      });
      totalTransactions += paymentTransactions.length;
    }
    
    console.log(`Total payments: ${finalPayments.length}`);
    console.log(`Total transactions: ${totalTransactions}`);
    
    if (totalTransactions > 0) {
      console.log('✅ All payments now have proper double-entry transactions');
    } else {
      console.log('❌ Some payments still missing transactions');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixMissingTransactions();
