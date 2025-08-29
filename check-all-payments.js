const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAllPayments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 Checking all payment-related transactions...\n');

    // Find all payment transactions
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: 1 });

    console.log(`📊 Found ${paymentTransactions.length} payment transactions\n`);

    paymentTransactions.forEach((tx, index) => {
      console.log(`📋 Payment Transaction ${index + 1}:`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Date: ${tx.date.toDateString()}`);
      console.log(`   Source ID: ${tx.sourceId}`);
      console.log(`   Total Amount: $${tx.totalDebit}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Metadata:`, tx.metadata);
      
      console.log(`   Account Entries:`);
      tx.entries.forEach(entry => {
        console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
      });
      console.log('');
    });

    // Check for any transactions with "payment" in description
    const paymentDescriptions = await TransactionEntry.find({
      description: { $regex: /payment/i }
    }).sort({ date: 1 });

    console.log(`📊 Found ${paymentDescriptions.length} transactions with "payment" in description\n`);

    paymentDescriptions.forEach((tx, index) => {
      console.log(`📋 Payment Description Transaction ${index + 1}:`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Date: ${tx.date.toDateString()}`);
      console.log(`   Total Amount: $${tx.totalDebit}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkAllPayments();
