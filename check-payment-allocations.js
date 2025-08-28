const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkPaymentAllocations() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 Checking all payment allocation transactions...\n');

    // Find all payment allocation transactions
    const paymentAllocations = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /Payment allocation/ }
    }).sort({ date: 1 });

    console.log(`📊 Found ${paymentAllocations.length} payment allocation transactions\n`);

    let totalAllocated = 0;
    let totalPaymentAmount = 0;

    paymentAllocations.forEach((tx, index) => {
      console.log(`📋 Payment Allocation ${index + 1}:`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Date: ${tx.date.toDateString()}`);
      console.log(`   Source ID: ${tx.sourceId}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Total Amount: $${tx.totalDebit}`);
      
      // Find the corresponding payment
      const paymentAmount = tx.totalDebit;
      totalAllocated += paymentAmount;
      
      console.log(`   Account Codes:`);
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100')) {
          console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
        }
      });
      console.log('');

      // Get the original payment amount
      if (tx.sourceId) {
        // This would need to be looked up in the Payment collection
        console.log(`   Original Payment ID: ${tx.sourceId}`);
      }
    });

    console.log(`💰 Total Allocated: $${totalAllocated}`);
    console.log(`🎯 Expected Total Payment: $380`);
    console.log(`📊 Difference: $${380 - totalAllocated}`);

    // Check if there are any advance payment transactions
    const advancePayments = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /advance payment/i }
    });

    console.log(`\n💳 Found ${advancePayments.length} advance payment transactions`);
    advancePayments.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.description} - $${tx.totalDebit}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkPaymentAllocations();
