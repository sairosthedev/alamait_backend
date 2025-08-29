const mongoose = require('mongoose');
require('dotenv').config();

async function simpleBalanceSheetTrace() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    console.log('\n🔍 WHERE BALANCE SHEET DATA COMES FROM');
    console.log('=======================================');
    
    // 1. Check all transactions in database
    const allTransactions = await TransactionEntry.find({}).sort({ date: 1 });
    console.log(`\n📊 Total transactions in database: ${allTransactions.length}`);
    
    if (allTransactions.length === 0) {
      console.log('❌ No transactions found!');
      return;
    }
    
    // 2. Group by source type
    const sourceTypes = {};
    allTransactions.forEach(tx => {
      const source = tx.source || 'unknown';
      if (!sourceTypes[source]) sourceTypes[source] = 0;
      sourceTypes[source]++;
    });
    
    console.log('\n📋 Transaction Sources:');
    Object.entries(sourceTypes).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} transactions`);
    });
    
    // 3. Show sample transactions
    console.log('\n📋 SAMPLE TRANSACTIONS:');
    console.log('=======================');
    
    allTransactions.slice(0, 3).forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.source} - ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
      console.log(`   Status: ${tx.status}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`     Type: ${entry.accountType}`);
      });
    });
    
    // 4. Check specific account types
    console.log('\n💰 ACCOUNT TYPE BREAKDOWN:');
    console.log('==========================');
    
    const accountTypes = {};
    allTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        const type = entry.accountType || 'unknown';
        if (!accountTypes[type]) accountTypes[type] = { count: 0, total: 0 };
        accountTypes[type].count++;
        accountTypes[type].total += entry.debit + entry.credit;
      });
    });
    
    Object.entries(accountTypes).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} entries, $${data.total.toFixed(2)} total`);
    });
    
    // 5. Show specific student data
    console.log('\n👤 SPECIFIC STUDENT DATA:');
    console.log('=========================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    const studentTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': studentId },
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } },
        { sourceId: studentId }
      ]
    }).sort({ date: 1 });
    
    console.log(`Student ${studentId}: ${studentTransactions.length} transactions`);
    
    studentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.source} - ${tx.date.toISOString().split('T')[0]}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`     Type: ${entry.accountType}`);
      });
    });
    
    // 6. Summary
    console.log('\n📈 BALANCE SHEET DATA SUMMARY:');
    console.log('==============================');
    console.log('✅ Balance sheet data comes from TransactionEntry documents');
    console.log('✅ Each transaction has multiple entries (double-entry accounting)');
    console.log('✅ Account codes determine balance sheet categories:');
    console.log('   - 1000-xxxx: Cash/Bank (Assets)');
    console.log('   - 1100-xxxx: Accounts Receivable (Assets)');
    console.log('   - 2000-xxxx: Liabilities (Deposits)');
    console.log('   - 4000-xxxx: Income (Revenue)');
    console.log('✅ Transaction sources include:');
    console.log('   - rental_accrual: Monthly rent accruals');
    console.log('   - lease_start: Initial lease setup');
    console.log('   - payment: Student payments');
    console.log('   - advance_payment: Future payments');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

simpleBalanceSheetTrace();
