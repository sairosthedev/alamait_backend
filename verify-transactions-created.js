const mongoose = require('mongoose');
require('dotenv').config();

async function verifyTransactionsCreated() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 VERIFYING TRANSACTIONS CREATED');
    console.log('==================================');
    
    // Check all payment transactions created recently
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: -1 }).limit(10);
    
    console.log(`\n📋 FOUND ${paymentTransactions.length} PAYMENT TRANSACTIONS:`);
    
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Total Amount: $${tx.totalDebit}`);
      console.log(`   Transaction ID: ${tx._id}`);
      
      // Check if admin or deposit payments have proper monthSettled
      if (tx.metadata?.paymentType === 'admin' || tx.metadata?.paymentType === 'deposit') {
        if (tx.metadata?.monthSettled) {
          console.log(`   ✅ ${tx.metadata.paymentType} has monthSettled: ${tx.metadata.monthSettled}`);
        } else {
          console.log(`   ❌ ${tx.metadata.paymentType} has NO monthSettled!`);
        }
      }
    });
    
    // Check specifically for admin and deposit transactions
    console.log('\n🔍 SPECIFICALLY CHECKING ADMIN AND DEPOSIT TRANSACTIONS:');
    console.log('========================================================');
    
    const adminTransactions = paymentTransactions.filter(tx => tx.metadata?.paymentType === 'admin');
    const depositTransactions = paymentTransactions.filter(tx => tx.metadata?.paymentType === 'deposit');
    
    console.log(`\n📊 ADMIN TRANSACTIONS: ${adminTransactions.length}`);
    adminTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.description}`);
      console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`      Amount: $${tx.totalDebit}`);
      console.log(`      Date: ${tx.date.toISOString().split('T')[0]}`);
    });
    
    console.log(`\n📊 DEPOSIT TRANSACTIONS: ${depositTransactions.length}`);
    depositTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.description}`);
      console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`      Amount: $${tx.totalDebit}`);
      console.log(`      Date: ${tx.date.toISOString().split('T')[0]}`);
    });
    
    // Check for transactions with null monthSettled
    const nullMonthSettled = paymentTransactions.filter(tx => !tx.metadata?.monthSettled);
    
    if (nullMonthSettled.length > 0) {
      console.log('\n❌ FOUND TRANSACTIONS WITH NULL MONTHSETTLED:');
      console.log('==============================================');
      nullMonthSettled.forEach((tx, index) => {
        console.log(`${index + 1}. ${tx.description}`);
        console.log(`   Payment Type: ${tx.metadata?.paymentType}`);
        console.log(`   Amount: $${tx.totalDebit}`);
        console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      });
    } else {
      console.log('\n✅ ALL PAYMENT TRANSACTIONS HAVE PROPER MONTHSETTLED VALUES!');
    }
    
    // Check the most recent transactions (should be the ones we just created)
    console.log('\n🔍 MOST RECENT TRANSACTIONS (LAST 5):');
    console.log('=====================================');
    
    const recentTransactions = paymentTransactions.slice(0, 5);
    recentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Amount: $${tx.totalDebit}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      
      // Show the full metadata for debugging
      console.log(`   Full Metadata:`, JSON.stringify(tx.metadata, null, 2));
    });
    
    console.log('\n💡 SUMMARY:');
    console.log('============');
    console.log('Expected behavior:');
    console.log('1. Admin fee payments should have monthSettled = "2025-06"');
    console.log('2. Deposit payments should have monthSettled = "2025-06"');
    console.log('3. No payment should have monthSettled = null');
    console.log('4. All transactions should be created successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

verifyTransactionsCreated();
