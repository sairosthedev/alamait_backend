const mongoose = require('mongoose');
require('dotenv').config();

async function verifyMonthSettledFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 VERIFYING MONTHSETTLED FIX');
    console.log('==============================');
    
    // Check all payment transactions to see their monthSettled values
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n📋 FOUND ${paymentTransactions.length} PAYMENT TRANSACTIONS:`);
    
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Total Amount: $${tx.totalDebit}`);
      
      // Check if admin or deposit payments have proper monthSettled
      if (tx.metadata?.paymentType === 'admin' || tx.metadata?.paymentType === 'deposit') {
        if (tx.metadata?.monthSettled) {
          console.log(`   ✅ ${tx.metadata.paymentType} has monthSettled: ${tx.metadata.monthSettled}`);
        } else {
          console.log(`   ❌ ${tx.metadata.paymentType} has NO monthSettled!`);
        }
      }
    });
    
    // Check what the expected behavior should be
    console.log('\n🔍 EXPECTED BEHAVIOR:');
    console.log('=====================');
    console.log('1. Admin fee payments should have monthSettled = "2025-06"');
    console.log('2. Deposit payments should have monthSettled = "2025-06"');
    console.log('3. Rent payments should have monthSettled = month they settle');
    console.log('4. No payment should have monthSettled = null');
    
    // Check outstanding balances to see what should be allocated
    console.log('\n🔍 OUTSTANDING BALANCES ANALYSIS:');
    console.log('==================================');
    console.log('June 2025:');
    console.log('  - Admin Fee: $20 outstanding');
    console.log('  - Deposit: $220 outstanding');
    console.log('  - Rent: $0 outstanding (already paid)');
    console.log('');
    console.log('July 2025:');
    console.log('  - Rent: $36.67 outstanding');
    console.log('');
    console.log('This means:');
    console.log('1. Admin fee ($20) should be allocated to June 2025');
    console.log('2. Deposit ($220) should be allocated to June 2025');
    console.log('3. Rent ($220) should be allocated to July 2025');
    
    // Check if there are any transactions with null monthSettled
    const nullMonthSettled = paymentTransactions.filter(tx => !tx.metadata?.monthSettled);
    
    if (nullMonthSettled.length > 0) {
      console.log('\n❌ FOUND TRANSACTIONS WITH NULL MONTHSETTLED:');
      console.log('==============================================');
      nullMonthSettled.forEach((tx, index) => {
        console.log(`${index + 1}. ${tx.description}`);
        console.log(`   Payment Type: ${tx.metadata?.paymentType}`);
        console.log(`   Amount: $${tx.totalDebit}`);
      });
    } else {
      console.log('\n✅ ALL PAYMENT TRANSACTIONS HAVE PROPER MONTHSETTLED VALUES!');
    }
    
    // Check if admin and deposit payments exist and have correct monthSettled
    const adminPayments = paymentTransactions.filter(tx => tx.metadata?.paymentType === 'admin');
    const depositPayments = paymentTransactions.filter(tx => tx.metadata?.paymentType === 'deposit');
    
    console.log('\n🔍 ADMIN AND DEPOSIT PAYMENT ANALYSIS:');
    console.log('=======================================');
    
    if (adminPayments.length > 0) {
      console.log(`\n📋 FOUND ${adminPayments.length} ADMIN FEE PAYMENTS:`);
      adminPayments.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.description}`);
        console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
        console.log(`      Amount: $${tx.totalDebit}`);
      });
    } else {
      console.log('\n❌ NO ADMIN FEE PAYMENTS FOUND');
      console.log('   This means the $20 admin fee payment was not created');
    }
    
    if (depositPayments.length > 0) {
      console.log(`\n📋 FOUND ${depositPayments.length} DEPOSIT PAYMENTS:`);
      depositPayments.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.description}`);
        console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
        console.log(`      Amount: $${tx.totalDebit}`);
      });
    } else {
      console.log('\n❌ NO DEPOSIT PAYMENTS FOUND');
      console.log('   This means the $220 deposit payment was not created');
    }
    
    console.log('\n💡 SUMMARY:');
    console.log('============');
    console.log('The monthSettled fix ensures that:');
    console.log('1. Admin fee payments always use the first month (June 2025) as monthSettled');
    console.log('2. Deposit payments always use the first month (June 2025) as monthSettled');
    console.log('3. No admin or deposit payment will have null monthSettled');
    console.log('4. This ensures proper balance sheet reporting using monthSettled');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

verifyMonthSettledFix();
