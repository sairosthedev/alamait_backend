const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkActualAccountCodes() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 CHECKING ACTUAL ACCOUNT CODES IN TRANSACTIONS\n');

    // 1. Check all accrual transactions
    console.log('📊 STEP 1: Checking Accrual Transactions\n');
    
    const accruals = await TransactionEntry.find({
      source: 'rental_accrual'
    }).sort({ date: 1 });

    console.log(`Found ${accruals.length} accrual transactions\n`);

    accruals.forEach((accrual, index) => {
      console.log(`📋 Accrual ${index + 1}:`);
      console.log(`   Description: ${accrual.description}`);
      console.log(`   Date: ${accrual.date.toDateString()}`);
      console.log(`   Account Codes:`);
      accrual.entries.forEach(entry => {
        console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
      });
      console.log('');
    });

    // 2. Check all payment transactions
    console.log('📊 STEP 2: Checking Payment Transactions\n');
    
    const payments = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: 1 });

    console.log(`Found ${payments.length} payment transactions\n`);

    payments.forEach((payment, index) => {
      console.log(`📋 Payment ${index + 1}:`);
      console.log(`   Description: ${payment.description}`);
      console.log(`   Date: ${payment.date.toDateString()}`);
      console.log(`   Account Codes:`);
      payment.entries.forEach(entry => {
        console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
      });
      console.log('');
    });

    // 3. Check all transactions for AR-related account codes
    console.log('📊 STEP 3: Checking All Transactions for AR Account Codes\n');
    
    const allTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '1100' }
    }).sort({ date: 1 });

    console.log(`Found ${allTransactions.length} transactions with 1100 account codes\n`);

    allTransactions.forEach((tx, index) => {
      console.log(`📋 Transaction ${index + 1}:`);
      console.log(`   Source: ${tx.source}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Date: ${tx.date.toDateString()}`);
      console.log(`   Account Codes:`);
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.includes('1100')) {
          console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
        }
      });
      console.log('');
    });

    // 4. Check what student IDs are actually in the system
    console.log('📊 STEP 4: Checking Student IDs in Account Codes\n');
    
    const studentIds = new Set();
    allTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.includes('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          studentIds.add(studentId);
        }
      });
    });

    console.log(`Found ${studentIds.size} unique student IDs in account codes:`);
    Array.from(studentIds).forEach(id => console.log(`   ${id}`));
    console.log('');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkActualAccountCodes();
