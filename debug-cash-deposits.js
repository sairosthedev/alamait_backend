const mongoose = require('mongoose');
require('dotenv').config();

async function debugCashDeposits() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 DEBUGGING CASH AND DEPOSITS');
    console.log('================================');
    
    // Test for June 2025
    const testMonth = '2025-06';
    const testDate = new Date(2025, 5, 30); // June 30, 2025
    
    console.log(`\n📊 Testing for ${testMonth}`);
    console.log('================================');
    
    // 1. Check all payment transactions
    console.log('\n💰 ALL PAYMENT TRANSACTIONS:');
    console.log('=============================');
    
    const allPayments = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`Found ${allPayments.length} payment transactions:`);
    
    allPayments.forEach((tx, index) => {
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
    
    // 2. Check cash accounts specifically
    console.log('\n💵 CASH ACCOUNTS ANALYSIS:');
    console.log('===========================');
    
    const cashAccounts = ['1001', '1002', '1003', '1004', '1005', '1010', '1011', '1012', '1013', '1014'];
    
    for (const accountCode of cashAccounts) {
      console.log(`\n📊 Account ${accountCode}:`);
      
      // Get all transactions for this cash account
      const cashTransactions = await TransactionEntry.find({
        'entries.accountCode': accountCode,
        status: 'posted'
      }).sort({ date: 1 });
      
      let balance = 0;
      cashTransactions.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode === accountCode) {
            balance += (entry.debit || 0) - (entry.credit || 0);
          }
        });
      });
      
      console.log(`   Balance: $${balance.toFixed(2)}`);
      
      // Show transactions
      cashTransactions.forEach(tx => {
        console.log(`   - ${tx.date.toISOString().split('T')[0]}: ${tx.description}`);
        tx.entries.forEach(entry => {
          if (entry.accountCode === accountCode) {
            console.log(`     Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
          }
        });
      });
    }
    
    // 3. Check deposit transactions
    console.log('\n🏦 DEPOSIT TRANSACTIONS:');
    console.log('========================');
    
    const depositTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^2020' },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`Found ${depositTransactions.length} deposit transactions:`);
    
    depositTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Source: ${tx.source}`);
      
      console.log('   Entries:');
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    });
    
    // 4. Check AR transactions
    console.log('\n📈 AR TRANSACTIONS:');
    console.log('===================');
    
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100' },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`Found ${arTransactions.length} AR transactions:`);
    
    arTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.description}`);
      console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
      console.log(`   Source: ${tx.source}`);
      
      console.log('   Entries:');
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`     ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`         Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    });
    
    // 5. Check what should happen with the payment
    console.log('\n🔍 PAYMENT ANALYSIS:');
    console.log('===================');
    
    const junePayment = allPayments.find(tx => tx.metadata?.monthSettled === testMonth);
    
    if (junePayment) {
      console.log(`\n📋 June Payment (${junePayment.description}):`);
      console.log(`   Total Amount: $${junePayment.totalDebit}`);
      console.log(`   Month Settled: ${junePayment.metadata?.monthSettled}`);
      
      console.log('\n   Expected Accounting Entries:');
      console.log('   =============================');
      console.log('   1. Cash (1001) Debit: $460 (payment received)');
      console.log('   2. AR (1100-*) Credit: $36.67 (rent payment)');
      console.log('   3. AR (1100-*) Credit: $20 (admin fee)');
      console.log('   4. Deposits (2020) Credit: $220 (deposit)');
      console.log('   5. Income (4001) Credit: $36.67 (rent income)');
      console.log('   6. Income (4002) Credit: $20 (admin fee income)');
      console.log('   7. Deferred Income (2200) Credit: $220 (deposit liability)');
      
      console.log('\n   Actual Entries:');
      junePayment.entries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`       Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
      });
    } else {
      console.log('❌ No June payment found with monthSettled = 2025-06');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugCashDeposits();
