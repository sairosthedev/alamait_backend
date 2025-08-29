const mongoose = require('mongoose');
require('dotenv').config();

async function fixBalanceSheetMonthSettled() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔧 FIXING BALANCE SHEET TO USE MONTHSETTLED');
    console.log('============================================');
    
    // 1. Test current balance sheet calculation
    console.log('\n📊 TESTING CURRENT BALANCE SHEET CALCULATION:');
    console.log('==============================================');
    
    const testMonth = '2025-06';
    const testDate = new Date(2025, 5, 30); // June 30, 2025
    
    // Current method (using transaction date)
    console.log('\n🔍 CURRENT METHOD (Transaction Date):');
    console.log('=====================================');
    
    const currentARTransactions = await TransactionEntry.find({
      date: { $lte: testDate },
      'entries.accountCode': { $regex: '^1100-' },
      status: 'posted'
    }).sort({ date: 1 });
    
    let currentARBalance = 0;
    currentARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          if (tx.source === 'rental_accrual') {
            currentARBalance += entry.debit || 0;
          } else if (tx.source === 'payment') {
            currentARBalance -= entry.credit || 0;
          }
        }
      });
    });
    
    console.log(`Current AR Balance (transaction date): $${currentARBalance.toFixed(2)}`);
    
    // 2. Test monthSettled method
    console.log('\n🔍 MONTHSETTLED METHOD:');
    console.log('=======================');
    
    // Get all AR accruals up to the test date
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $lte: testDate },
      'entries.accountCode': { $regex: '^1100-' },
      status: 'posted'
    }).sort({ date: 1 });
    
    // Get all payments with monthSettled up to the test month
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $lte: testMonth },
      'entries.accountCode': { $regex: '^1100-' },
      status: 'posted'
    }).sort({ date: 1 });
    
    let accrualTotal = 0;
    accrualTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          accrualTotal += entry.debit || 0;
        }
      });
    });
    
    let paymentTotal = 0;
    paymentTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          paymentTotal += entry.credit || 0;
        }
      });
    });
    
    const monthSettledARBalance = accrualTotal - paymentTotal;
    
    console.log(`Accruals Total: $${accrualTotal.toFixed(2)}`);
    console.log(`Payments Total (monthSettled <= ${testMonth}): $${paymentTotal.toFixed(2)}`);
    console.log(`MonthSettled AR Balance: $${monthSettledARBalance.toFixed(2)}`);
    
    // 3. Show the difference
    console.log('\n📈 COMPARISON:');
    console.log('===============');
    console.log(`Current Method: $${currentARBalance.toFixed(2)}`);
    console.log(`MonthSettled Method: $${monthSettledARBalance.toFixed(2)}`);
    console.log(`Difference: $${Math.abs(currentARBalance - monthSettledARBalance).toFixed(2)}`);
    
    if (Math.abs(currentARBalance - monthSettledARBalance) > 0.01) {
      console.log(`❌ SIGNIFICANT DIFFERENCE DETECTED!`);
      console.log(`   The balance sheet is not using monthSettled correctly.`);
    } else {
      console.log(`✅ No significant difference detected.`);
    }
    
    // 4. Show specific examples
    console.log('\n🔍 SPECIFIC EXAMPLES:');
    console.log('=====================');
    
    const examplePayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true },
      'entries.accountCode': { $regex: '^1100-' },
      status: 'posted'
    }).sort({ date: 1 }).limit(5);
    
    console.log(`Found ${examplePayments.length} payments with monthSettled:`);
    examplePayments.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'Not set'}`);
      console.log(`   Payment Type: ${tx.metadata?.paymentType || 'Unknown'}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountCode.startsWith('1100-')) {
          console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - $${entry.credit || 0}`);
        }
      });
    });
    
    // 5. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('===================');
    console.log('1. ✅ Balance sheet should use monthSettled for AR calculations');
    console.log('2. ✅ Cash should be calculated based on monthSettled payments');
    console.log('3. ✅ Deposits should be calculated based on monthSettled');
    console.log('4. ✅ Deferred income should be calculated based on monthSettled');
    console.log('5. ✅ All payment allocations should have monthSettled metadata');
    
    console.log('\n🔧 FIX REQUIRED:');
    console.log('================');
    console.log('The balance sheet calculation needs to be updated to:');
    console.log('- Use monthSettled for all payment-related calculations');
    console.log('- Calculate AR as: Accruals - Payments(monthSettled <= current month)');
    console.log('- Calculate Cash as: Payments(monthSettled = current month)');
    console.log('- Calculate Deposits as: Deposits(monthSettled <= current month)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixBalanceSheetMonthSettled();
