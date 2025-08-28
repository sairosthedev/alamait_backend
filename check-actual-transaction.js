const mongoose = require('mongoose');

async function checkActualTransaction() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Check the specific transaction mentioned by the user
    console.log('\n=== Checking actual transaction ===');
    const transactionId = '68af051f9d9dc4a0c67cf30b';
    
    const transaction = await TransactionEntry.findById(transactionId);
    if (transaction) {
      console.log(`Transaction ID: ${transaction._id}`);
      console.log(`Description: ${transaction.description}`);
      console.log(`Source: ${transaction.source}`);
      console.log(`Source ID: ${transaction.sourceId}`);
      console.log(`Total Debit: $${transaction.totalDebit}`);
      console.log(`Total Credit: $${transaction.totalCredit}`);
      console.log(`Created By: ${transaction.createdBy}`);
      console.log(`Status: ${transaction.status}`);
      console.log(`Metadata:`, transaction.metadata);
      console.log(`Has metadata: ${!!transaction.metadata}`);
      console.log(`Metadata keys:`, transaction.metadata ? Object.keys(transaction.metadata) : 'None');
      console.log(`monthSettled: ${transaction.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`paymentType: ${transaction.metadata?.paymentType || 'NOT SET'}`);
    } else {
      console.log('Transaction not found');
    }
    
    // Also check with lean() to see if metadata is included
    console.log('\n=== Checking with lean() ===');
    const leanTransaction = await TransactionEntry.findById(transactionId).lean();
    if (leanTransaction) {
      console.log(`Lean metadata:`, leanTransaction.metadata);
      console.log(`Lean monthSettled: ${leanTransaction.metadata?.monthSettled || 'NOT SET'}`);
    }
    
    // Check all recent payment transactions
    console.log('\n=== Checking all recent payment transactions ===');
    const recentPayments = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${recentPayments.length} recent payment transactions:`);
    recentPayments.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   ID: ${tx._id}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Has metadata: ${!!tx.metadata}`);
      console.log(`   Metadata:`, tx.metadata);
      console.log(`   monthSettled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkActualTransaction();
