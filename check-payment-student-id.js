const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Payment = require('./src/models/Payment');

async function checkPaymentStudentId() {
  try {
    console.log('🔍 Checking studentId in payment records...\n');

    // Get recent payments
    const payments = await Payment.find().sort({ createdAt: -1 }).limit(5).lean();

    console.log(`Found ${payments.length} recent payments:\n`);

    payments.forEach((payment, index) => {
      console.log(`Payment ${index + 1}:`);
      console.log(`  Payment ID: ${payment.paymentId}`);
      console.log(`  Student ID: ${payment.student}`);
      console.log(`  Total Amount: $${payment.totalAmount}`);
      console.log(`  Date: ${payment.date}`);
      console.log(`  Allocation: ${JSON.stringify(payment.allocation, null, 2)}`);
      console.log('');
    });

    // Check the specific payment from your transaction data
    const specificPayment = await Payment.findOne({ 
      paymentId: 'PAY-1756300574989' 
    }).lean();

    if (specificPayment) {
      console.log('🎯 Specific Payment Found:');
      console.log(`  Payment ID: ${specificPayment.paymentId}`);
      console.log(`  Student ID: ${specificPayment.student}`);
      console.log(`  Total Amount: $${specificPayment.totalAmount}`);
      console.log(`  Date: ${specificPayment.date}`);
      console.log(`  Allocation: ${JSON.stringify(specificPayment.allocation, null, 2)}`);
    } else {
      console.log('❌ Specific payment not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkPaymentStudentId();
