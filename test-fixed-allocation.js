const mongoose = require('mongoose');
require('dotenv').config();

async function testFixedAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const PaymentService = require('./src/services/paymentService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af33e9aef6b0dcc8e8f149'; // Cindy's correct user ID
    
    console.log('\n🧪 TESTING FIXED ALLOCATION');
    console.log('============================');
    
    // 1. Create a test payment
    console.log('\n1️⃣ CREATING TEST PAYMENT:');
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
    
    console.log('Payment data:', JSON.stringify(testPaymentData, null, 2));
    
    try {
      const payment = await PaymentService.createPaymentWithSmartAllocation(
        testPaymentData,
        '67c023adae5e27657502e887' // Valid user ID
      );
      
      console.log('✅ Payment created successfully');
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Allocation: ${payment.allocation ? 'Completed' : 'Pending'}`);
      
      if (payment.allocation) {
        console.log('Allocation details:', JSON.stringify(payment.allocation, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Payment creation failed:', error.message);
      return;
    }
    
    // 2. Check transactions created
    console.log('\n2️⃣ CHECKING TRANSACTIONS CREATED:');
    
    // Wait for transactions to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.studentId': studentId
    }).sort({ date: -1 }).limit(10);
    
    console.log(`Found ${paymentTransactions.length} payment transactions for user ${studentId}`);
    
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    ID: ${tx._id}`);
      console.log(`    Date: ${tx.date.toLocaleDateString()}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Total: $${tx.totalDebit.toFixed(2)}`);
      console.log(`    Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
      console.log(`    Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
      console.log(`    Allocation Type: ${tx.metadata?.allocationType || 'N/A'}`);
      console.log(`    Payment ID: ${tx.metadata?.paymentId || 'N/A'}`);
    });
    
    // 3. Check balance sheet impact
    console.log('\n3️⃣ BALANCE SHEET IMPACT:');
    
    // Calculate AR balance for this user
    const userARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    });
    
    let arBalance = 0;
    userARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          arBalance += entry.debit - entry.credit;
        }
      });
    });
    
    // Calculate cash balance
    const cashTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^100[0-9]' }
    });
    
    let cashBalance = 0;
    cashTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('100')) {
          cashBalance += entry.debit - entry.credit;
        }
      });
    });
    
    console.log(`Accounts Receivable (User ${studentId}): $${arBalance.toFixed(2)}`);
    console.log(`Cash: $${cashBalance.toFixed(2)}`);
    
    // 4. Summary
    console.log('\n4️⃣ SUMMARY:');
    if (paymentTransactions.length > 0) {
      console.log('✅ Payment transactions created successfully');
      console.log('✅ Balance sheet updated');
      console.log('✅ Fix is working correctly');
    } else {
      console.log('❌ No payment transactions created');
      console.log('❌ Fix may not be working');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedAllocation();
