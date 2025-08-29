const mongoose = require('mongoose');
require('dotenv').config();

async function checkPaymentEntries() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 CHECKING PAYMENT ACCOUNTING ENTRIES');
    console.log('========================================');
    
    // Check all payment-related transactions
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n📋 FOUND ${paymentTransactions.length} PAYMENT TRANSACTIONS:`);
    
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      console.log(`   Total Debit: $${tx.totalDebit}`);
      console.log(`   Total Credit: $${tx.totalCredit}`);
      
      console.log('   Entries:');
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    });
    
    // Check what should happen for a $460 payment
    console.log('\n🔍 EXPECTED ACCOUNTING ENTRIES FOR $460 PAYMENT:');
    console.log('================================================');
    console.log('Payment Breakdown: $220 rent + $20 admin + $220 deposit');
    console.log('');
    console.log('Expected Transactions:');
    console.log('======================');
    console.log('');
    console.log('1. RENT PAYMENT ($220):');
    console.log('   - Cash (1000) Debit: $220');
    console.log('   - AR (1100-*) Credit: $220');
    console.log('   - Income (4001) Credit: $220');
    console.log('');
    console.log('2. ADMIN FEE PAYMENT ($20):');
    console.log('   - Cash (1000) Debit: $20');
    console.log('   - AR (1100-*) Credit: $20');
    console.log('   - Income (4002) Credit: $20');
    console.log('');
    console.log('3. DEPOSIT PAYMENT ($220):');
    console.log('   - Cash (1000) Debit: $220');
    console.log('   - AR (1100-*) Credit: $220');
    console.log('   - Deposits (2020) Credit: $220');
    console.log('');
    console.log('Total Cash: $460');
    console.log('Total AR Reduction: $460');
    console.log('Total Income: $240 (rent + admin)');
    console.log('Total Deposits: $220');
    
    // Check what's missing
    console.log('\n🔍 WHAT\'S MISSING:');
    console.log('===================');
    console.log('❌ Missing Income entries (4001, 4002)');
    console.log('❌ Missing Deposit liability entry (2020)');
    console.log('❌ Only rent portion is being allocated');
    console.log('❌ Admin fee and deposit portions are not being processed');
    
    // Check if there are separate transactions for admin and deposit
    console.log('\n🔍 CHECKING FOR SEPARATE ADMIN/DEPOSIT TRANSACTIONS:');
    console.log('===================================================');
    
    const allTransactions = await TransactionEntry.find({
      $or: [
        { 'entries.accountCode': '4002' }, // Admin fee income
        { 'entries.accountCode': '2020' }  // Deposits
      ],
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n📋 FOUND ${allTransactions.length} ADMIN/DEPOSIT TRANSACTIONS:`);
    
    allTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Total Debit: $${tx.totalDebit}`);
      console.log(`   Total Credit: $${tx.totalCredit}`);
      
      console.log('   Entries:');
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    });
    
    console.log('\n💡 SOLUTION:');
    console.log('============');
    console.log('The payment allocation service needs to create additional accounting entries for:');
    console.log('1. Admin fee income (4002) when admin fee is paid');
    console.log('2. Deposit liability (2020) when deposit is paid');
    console.log('3. Proper income recognition for rent and admin fees');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkPaymentEntries();
