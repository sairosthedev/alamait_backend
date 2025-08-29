const mongoose = require('mongoose');
require('dotenv').config();

async function checkPaymentMonthSettled() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 CHECKING PAYMENT MONTHSETTLED METADATA');
    console.log('==========================================');
    
    // 1. Check all payment transactions
    console.log('\n📊 ALL PAYMENT TRANSACTIONS:');
    console.log('=============================');
    
    const allPayments = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`Found ${allPayments.length} payment transactions`);
    
    let withMonthSettled = 0;
    let withoutMonthSettled = 0;
    
    allPayments.forEach((tx, index) => {
      const hasMonthSettled = tx.metadata?.monthSettled;
      if (hasMonthSettled) {
        withMonthSettled++;
      } else {
        withoutMonthSettled++;
      }
      
      if (index < 10) { // Show first 10
        console.log(`\n${index + 1}. ${tx.description}`);
        console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
        console.log(`   Month Settled: ${hasMonthSettled || 'NOT SET'}`);
        console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
        console.log(`   Total: $${tx.totalDebit}`);
      }
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   With monthSettled: ${withMonthSettled}`);
    console.log(`   Without monthSettled: ${withoutMonthSettled}`);
    console.log(`   Percentage with monthSettled: ${((withMonthSettled / allPayments.length) * 100).toFixed(1)}%`);
    
    // 2. Check specific payment types
    console.log('\n🔍 PAYMENT TYPES ANALYSIS:');
    console.log('==========================');
    
    const paymentTypes = {};
    allPayments.forEach(tx => {
      const paymentType = tx.metadata?.paymentType || 'unknown';
      const hasMonthSettled = tx.metadata?.monthSettled;
      
      if (!paymentTypes[paymentType]) {
        paymentTypes[paymentType] = { total: 0, withMonthSettled: 0, withoutMonthSettled: 0 };
      }
      
      paymentTypes[paymentType].total++;
      if (hasMonthSettled) {
        paymentTypes[paymentType].withMonthSettled++;
      } else {
        paymentTypes[paymentType].withoutMonthSettled++;
      }
    });
    
    Object.entries(paymentTypes).forEach(([type, data]) => {
      const percentage = ((data.withMonthSettled / data.total) * 100).toFixed(1);
      console.log(`   ${type}: ${data.total} total, ${data.withMonthSettled} with monthSettled (${percentage}%)`);
    });
    
    // 3. Check recent payments (last 30 days)
    console.log('\n📅 RECENT PAYMENTS (Last 30 days):');
    console.log('===================================');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPayments = await TransactionEntry.find({
      source: 'payment',
      date: { $gte: thirtyDaysAgo },
      status: 'posted'
    }).sort({ date: -1 });
    
    console.log(`Found ${recentPayments.length} recent payment transactions`);
    
    let recentWithMonthSettled = 0;
    recentPayments.forEach(tx => {
      if (tx.metadata?.monthSettled) {
        recentWithMonthSettled++;
      }
    });
    
    console.log(`   Recent payments with monthSettled: ${recentWithMonthSettled}/${recentPayments.length} (${((recentWithMonthSettled / recentPayments.length) * 100).toFixed(1)}%)`);
    
    // 4. Check if this affects balance sheet
    console.log('\n📊 BALANCE SHEET IMPACT:');
    console.log('=========================');
    
    if (withoutMonthSettled > 0) {
      console.log(`❌ ${withoutMonthSettled} payments without monthSettled will affect balance sheet accuracy`);
      console.log(`   These payments will be calculated based on transaction date instead of settlement month`);
    } else {
      console.log(`✅ All payments have monthSettled metadata`);
      console.log(`   Balance sheet calculations should be accurate`);
    }
    
    // 5. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (withoutMonthSettled > 0) {
      console.log('1. 🔧 Update payment allocation service to always set monthSettled');
      console.log('2. 🔧 Create a script to backfill monthSettled for existing payments');
      console.log('3. 🔧 Update balance sheet calculation to handle missing monthSettled gracefully');
    } else {
      console.log('1. ✅ All payments have monthSettled metadata');
      console.log('2. ✅ Balance sheet calculation should be accurate');
      console.log('3. ✅ No action required');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkPaymentMonthSettled();
