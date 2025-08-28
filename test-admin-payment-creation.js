const mongoose = require('mongoose');
require('dotenv').config();

async function testAdminPaymentCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const PaymentService = require('./src/services/paymentService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Payment = require('./src/models/Payment');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🧪 TESTING ADMIN PAYMENT CREATION');
    console.log('==================================');
    
    // 1. Check existing payments in database
    console.log('\n1️⃣ CHECKING EXISTING PAYMENTS:');
    const existingPayments = await Payment.find({
      student: studentId
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${existingPayments.length} existing payments for student ${studentId}`);
    
    existingPayments.forEach((payment, index) => {
      console.log(`\n  Payment ${index + 1}:`);
      console.log(`    Payment ID: ${payment.paymentId}`);
      console.log(`    Total Amount: $${payment.totalAmount}`);
      console.log(`    Method: ${payment.method}`);
      console.log(`    Status: ${payment.status}`);
      console.log(`    Date: ${payment.date.toLocaleDateString()}`);
      console.log(`    Rent Amount: $${payment.rentAmount || 0}`);
      console.log(`    Admin Fee: $${payment.adminFee || 0}`);
      console.log(`    Deposit: $${payment.deposit || 0}`);
      console.log(`    Payments Array:`, payment.payments);
      console.log(`    Allocation: ${payment.allocation ? 'Completed' : 'Pending'}`);
    });
    
    // 2. Check what transactions were created for these payments
    console.log('\n2️⃣ CHECKING TRANSACTIONS FOR PAYMENTS:');
    
    for (const payment of existingPayments) {
      console.log(`\n  Checking transactions for payment: ${payment.paymentId}`);
      
      const paymentTransactions = await TransactionEntry.find({
        source: 'payment',
        'metadata.paymentId': payment._id.toString()
      }).sort({ date: 1 });
      
      console.log(`    Found ${paymentTransactions.length} transactions for this payment`);
      
      paymentTransactions.forEach((tx, index) => {
        console.log(`    Transaction ${index + 1}:`);
        console.log(`      ID: ${tx._id}`);
        console.log(`      Description: ${tx.description}`);
        console.log(`      Total: $${tx.totalDebit.toFixed(2)}`);
        console.log(`      Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
        console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
        console.log(`      Allocation Type: ${tx.metadata?.allocationType || 'N/A'}`);
      });
      
      // Check if all payment components have transactions
      const paymentComponents = payment.payments || [];
      const transactionTypes = paymentTransactions.map(tx => tx.metadata?.paymentType).filter(Boolean);
      
      console.log(`    Payment Components: ${paymentComponents.map(p => p.type).join(', ')}`);
      console.log(`    Transaction Types: ${transactionTypes.join(', ')}`);
      
      // Find missing components
      const missingComponents = paymentComponents.filter(comp => 
        !transactionTypes.includes(comp.type) && comp.amount > 0
      );
      
      if (missingComponents.length > 0) {
        console.log(`    ❌ MISSING TRANSACTIONS FOR: ${missingComponents.map(c => `${c.type} ($${c.amount})`).join(', ')}`);
      } else {
        console.log(`    ✅ All payment components have transactions`);
      }
    }
    
    // 3. Check if the payment creation is using the right service
    console.log('\n3️⃣ CHECKING PAYMENT CREATION FLOW:');
    
    // Simulate what happens when admin creates a payment
    const testPaymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      student: studentId,
      residence: '67d723cf20f89c4ae69804f3',
      method: 'Cash',
      date: new Date()
    };
    
    console.log('Test payment data:', JSON.stringify(testPaymentData, null, 2));
    
    try {
      console.log('\nCreating payment using PaymentService.createPaymentWithSmartAllocation...');
      const payment = await PaymentService.createPaymentWithSmartAllocation(
        testPaymentData,
        'test-admin-user'
      );
      
      console.log('✅ Payment created successfully');
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Allocation: ${payment.allocation ? 'Completed' : 'Pending'}`);
      
      if (payment.allocation) {
        console.log('Allocation breakdown:');
        payment.allocation.monthlyBreakdown.forEach((allocation, index) => {
          console.log(`  ${index + 1}. ${allocation.paymentType}: $${allocation.amountAllocated} to ${allocation.month}`);
        });
      }
      
      // Wait for transactions to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check transactions created
      const newTransactions = await TransactionEntry.find({
        source: 'payment',
        'metadata.paymentId': payment._id.toString()
      }).sort({ date: 1 });
      
      console.log(`\nCreated ${newTransactions.length} transactions for this payment`);
      
      newTransactions.forEach((tx, index) => {
        console.log(`  Transaction ${index + 1}:`);
        console.log(`    Description: ${tx.description}`);
        console.log(`    Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
        console.log(`    Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
        console.log(`    Amount: $${tx.totalDebit.toFixed(2)}`);
      });
      
    } catch (error) {
      console.error('❌ Payment creation failed:', error.message);
    }
    
    // 4. Check if there's a difference between admin interface and direct service call
    console.log('\n4️⃣ COMPARING ADMIN INTERFACE VS DIRECT SERVICE:');
    
    // Check if admin routes are using the right service
    const adminRoutes = require('./src/routes/admin/paymentRoutes');
    console.log('Admin payment routes are configured to use PaymentService.createPaymentWithSmartAllocation');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testAdminPaymentCreation();
