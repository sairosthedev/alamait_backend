const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Test script for the new Smart FIFO Payment Creation System
 */

async function testSmartPaymentCreation() {
  try {
    console.log('🚀 Testing Smart FIFO Payment Creation...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait');
    console.log('✅ Connected to database');
    
    // Import the payment service
    const PaymentService = require('./src/services/paymentService');
    
    // Test payment data (similar to what admin would input)
    const testPaymentData = {
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      student: '68adf1dc088169424e25c8ab', // Cindy's student ID
      residence: '67d723cf20f89c4ae69804f3', // Residence ID
      method: 'Cash',
      date: new Date()
    };
    
    console.log('💰 Test Payment Data:');
    console.log(JSON.stringify(testPaymentData, null, 2));
    
    // Create payment using the new Smart FIFO system
    console.log('\n🎯 Creating payment with Smart FIFO allocation...');
    const payment = await PaymentService.createPaymentWithSmartAllocation(
      testPaymentData, 
      '67c023adae5e27657502e887' // Admin user ID
    );
    
    console.log('\n✅ Payment created successfully!');
    console.log('📊 Payment Details:');
    console.log(`   Payment ID: ${payment.paymentId}`);
    console.log(`   Total Amount: $${payment.totalAmount}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Allocation: ${payment.allocation ? 'Completed' : 'Pending'}`);
    
    if (payment.allocation) {
      console.log('\n🎯 Allocation Results:');
      console.log(`   Months Settled: ${payment.allocation.summary.monthsSettled}`);
      console.log(`   Advance Amount: $${payment.allocation.summary.advancePaymentAmount}`);
      console.log(`   Oldest Month: ${payment.allocation.summary.oldestMonthSettled}`);
      console.log(`   Newest Month: ${payment.allocation.summary.newestMonthSettled}`);
    }
    
    console.log('\n🎉 Smart FIFO Payment Creation Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the test
testSmartPaymentCreation();
