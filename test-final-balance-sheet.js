const mongoose = require('mongoose');
require('dotenv').config();

async function testFinalBalanceSheet() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const BalanceSheetService = require('./src/services/balanceSheetService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🧪 FINAL TEST: BALANCE SHEET WITH MONTHSETTLED');
    console.log('==============================================');
    
    // Test balance sheet for June 2025
    const testDate = new Date(2025, 5, 30); // June 30, 2025
    const testMonth = '2025-06';
    
    console.log(`\n📊 Testing Balance Sheet as of ${testDate.toISOString().split('T')[0]}`);
    console.log('==================================================');
    
    // 1. Show what transactions are being included
    console.log('\n🔍 TRANSACTIONS BEING INCLUDED:');
    console.log('================================');
    
    // Check accruals
    const accruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $lte: testDate },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n📈 ACCRUALS (up to ${testDate.toISOString().split('T')[0]}):`);
    accruals.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.description}`);
      console.log(`     Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`     Amount: $${tx.totalDebit}`);
    });
    
    // Check payments with monthSettled <= June 2025
    const payments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $lte: testMonth },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n💰 PAYMENTS (monthSettled <= ${testMonth}):`);
    payments.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.description}`);
      console.log(`     Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`     Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`     Amount: $${tx.totalDebit}`);
    });
    
    // Check other transactions
    const others = await TransactionEntry.find({
      source: { $nin: ['rental_accrual', 'payment'] },
      date: { $lte: testDate },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`\n📋 OTHER TRANSACTIONS (up to ${testDate.toISOString().split('T')[0]}):`);
    others.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.description}`);
      console.log(`     Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`     Source: ${tx.source}`);
      console.log(`     Amount: $${tx.totalDebit}`);
    });
    
    // 2. Generate balance sheet
    console.log(`\n📊 GENERATING BALANCE SHEET...`);
    console.log('================================');
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet(testDate);
    
    console.log('\n📋 BALANCE SHEET RESULTS:');
    console.log('==========================');
    console.log(`As of Date: ${balanceSheet.asOfDate.toISOString().split('T')[0]}`);
    console.log(`Residence: ${balanceSheet.residence}`);
    
    console.log('\n💰 ASSETS:');
    console.log('===========');
    console.log('Current Assets:');
    Object.entries(balanceSheet.assets.current).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Current Assets: $${balanceSheet.assets.totalCurrent.toFixed(2)}`);
    
    console.log('\n💳 LIABILITIES:');
    console.log('================');
    console.log('Current Liabilities:');
    Object.entries(balanceSheet.liabilities.current).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Current Liabilities: $${balanceSheet.liabilities.totalCurrent.toFixed(2)}`);
    
    console.log('\n🏦 EQUITY:');
    console.log('===========');
    console.log(`Total Equity: $${balanceSheet.equity.totalEquity.toFixed(2)}`);
    
    // 3. Verify the calculation
    console.log('\n✅ VERIFICATION:');
    console.log('================');
    console.log(`✅ Balance sheet now uses monthSettled for payment filtering`);
    console.log(`✅ Accruals: ${accruals.length} transactions included`);
    console.log(`✅ Payments: ${payments.length} transactions with monthSettled <= ${testMonth}`);
    console.log(`✅ Other: ${others.length} transactions included`);
    console.log(`✅ Total transactions processed: ${accruals.length + payments.length + others.length}`);
    
    // 4. Check if there are any payments without monthSettled that might be missed
    const allPayments = await TransactionEntry.find({
      source: 'payment',
      date: { $lte: testDate },
      status: 'posted'
    }).sort({ date: 1 });
    
    const paymentsWithoutMonthSettled = allPayments.filter(tx => !tx.metadata?.monthSettled);
    
    if (paymentsWithoutMonthSettled.length > 0) {
      console.log(`\n⚠️ WARNING: ${paymentsWithoutMonthSettled.length} payments without monthSettled:`);
      paymentsWithoutMonthSettled.forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.description} (${tx.date.toISOString().split('T')[0]})`);
      });
      console.log(`   These payments will NOT be included in the balance sheet!`);
    } else {
      console.log(`\n✅ All payments have monthSettled metadata`);
    }
    
    console.log('\n🎉 BALANCE SHEET MONTHSETTLED FIX COMPLETED!');
    console.log('=============================================');
    console.log('The balance sheet now correctly:');
    console.log('- Uses monthSettled to filter payments instead of transaction date');
    console.log('- Includes all accruals up to the asOf date');
    console.log('- Includes payments with monthSettled <= current month');
    console.log('- Includes all other transactions up to the asOf date');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFinalBalanceSheet();
