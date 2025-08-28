const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');

async function testPaymentAllocation() {
  try {
    console.log('🔍 Testing payment allocation with student verification...\n');

    // Test data for Student 1
    const paymentData = {
      paymentId: 'TEST-PAYMENT-001',
      studentId: '68aeaf7a8d70befd6ad29b18', // Student 1
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      residence: '67d723cf20f89c4ae69804f3',
      method: 'Cash',
      date: new Date()
    };

    console.log('📊 Testing payment allocation for Student 1...');
    console.log(`Student ID: ${paymentData.studentId}`);
    console.log(`Total Amount: $${paymentData.totalAmount}`);

    const result = await EnhancedPaymentAllocationService.smartFIFOAllocation(paymentData);

    console.log('\n📋 Allocation Result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

testPaymentAllocation();
