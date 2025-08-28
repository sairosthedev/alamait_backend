const mongoose = require('mongoose');
require('dotenv').config();

async function debugLeaseStartDetails() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68adf1dc088169424e25c8a9'; // Cindy's ID
    
    // Find the lease start transaction
    const leaseStartTransaction = await TransactionEntry.findOne({
      'entries.accountCode': { $regex: `^1100-${studentId}` },
      source: 'lease_start'
    });
    
    if (leaseStartTransaction) {
      console.log('\n🔍 Lease Start Transaction Details:');
      console.log(`Transaction ID: ${leaseStartTransaction._id}`);
      console.log(`Date: ${leaseStartTransaction.date}`);
      console.log(`Description: ${leaseStartTransaction.description}`);
      console.log(`Source: ${leaseStartTransaction.source}`);
      
      if (leaseStartTransaction.metadata) {
        console.log('\n📋 Metadata:');
        console.log(JSON.stringify(leaseStartTransaction.metadata, null, 2));
      }
      
      console.log('\n📊 Entries:');
      leaseStartTransaction.entries.forEach((entry, index) => {
        console.log(`\n  Entry ${index + 1}:`);
        console.log(`    Account Code: ${entry.accountCode}`);
        console.log(`    Account Name: ${entry.accountName}`);
        console.log(`    Account Type: ${entry.accountType}`);
        console.log(`    Debit: $${entry.debit}`);
        console.log(`    Credit: $${entry.credit}`);
        console.log(`    Description: ${entry.description}`);
      });
      
      // Check what month this transaction is assigned to
      const accrualDate = new Date(leaseStartTransaction.date);
      const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
      console.log(`\n📅 This transaction is assigned to month: ${monthKey}`);
      
      // Check if there are any existing payments that might be affecting the balance
      const existingPayments = await TransactionEntry.find({
        source: 'payment',
        'metadata.studentId': studentId
      });
      
      if (existingPayments.length > 0) {
        console.log(`\n💳 Found ${existingPayments.length} existing payments:`);
        existingPayments.forEach((payment, index) => {
          console.log(`\n  Payment ${index + 1}:`);
          console.log(`    ID: ${payment._id}`);
          console.log(`    Date: ${payment.date}`);
          console.log(`    Description: ${payment.description}`);
          console.log(`    Amount: $${payment.totalDebit}`);
          if (payment.metadata) {
            console.log(`    Month Settled: ${payment.metadata.monthSettled || 'NOT SET'}`);
            console.log(`    Payment Type: ${payment.metadata.paymentType || 'NOT SET'}`);
          }
        });
      }
      
    } else {
      console.log('❌ No lease start transaction found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugLeaseStartDetails();
