const mongoose = require('mongoose');
require('dotenv').config();

async function checkOriginalPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Payment = require('./src/models/Payment');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 CHECKING ORIGINAL PAYMENT ALLOCATION');
    console.log('========================================');
    
    // Find the original payment
    const payments = await Payment.find().sort({ createdAt: -1 });
    
    console.log(`\n📋 FOUND ${payments.length} PAYMENTS:`);
    
    payments.forEach((payment, index) => {
      console.log(`\n${index + 1}. Payment ID: ${payment.paymentId}`);
      console.log(`   Student: ${payment.student}`);
      console.log(`   Total Amount: $${payment.totalAmount}`);
      console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
      console.log(`   Description: ${payment.description}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Allocation: ${payment.allocation}`);
    });
    
    // Check what should have been allocated
    console.log('\n🔍 EXPECTED ALLOCATION FOR $460 PAYMENT:');
    console.log('=========================================');
    console.log('Payment: $220 rent + $20 admin + $220 deposit');
    console.log('');
    console.log('Expected Accounting Entries:');
    console.log('============================');
    console.log('1. Cash (1001) Debit: $460 (payment received)');
    console.log('2. AR (1100-*) Credit: $220 (rent payment)');
    console.log('3. AR (1100-*) Credit: $20 (admin fee payment)');
    console.log('4. AR (1100-*) Credit: $220 (deposit payment)');
    console.log('5. Income (4001) Credit: $220 (rent income)');
    console.log('6. Income (4002) Credit: $20 (admin fee income)');
    console.log('7. Deposits (2020) Credit: $220 (deposit liability)');
    console.log('');
    console.log('Expected AR Reduction:');
    console.log('======================');
    console.log('Original AR: $276.67 (rent $36.67 + admin $20 + deposit $220)');
    console.log('Payment: $460');
    console.log('AR After Payment: $0 (fully settled)');
    console.log('');
    console.log('Expected Cash: $460');
    console.log('Expected Deposits: $220');
    
    // Check what actually happened
    console.log('\n🔍 ACTUAL TRANSACTION ENTRIES:');
    console.log('==============================');
    
    const transactionEntries = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    transactionEntries.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Total Debit: $${tx.totalDebit}`);
      console.log(`   Total Credit: $${tx.totalCredit}`);
      
      console.log('   Entries:');
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    });
    
    // Check the issue with cash account codes
    console.log('\n🔍 CASH ACCOUNT CODE ISSUE:');
    console.log('===========================');
    console.log('Payment transactions use account code: 1000 (Cash)');
    console.log('Balance sheet looks for account codes: 1001, 1002, 1003, etc.');
    console.log('This is why cash shows as $0 in the balance sheet!');
    console.log('');
    console.log('SOLUTION:');
    console.log('=========');
    console.log('1. Update payment allocation to use correct cash account (1001)');
    console.log('2. Ensure admin fee and deposit payments are created');
    console.log('3. Fix the deposit transaction to properly credit AR');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkOriginalPayment();
