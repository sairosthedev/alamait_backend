const mongoose = require('mongoose');
require('dotenv').config();

async function traceBalanceSheetData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Account = require('./src/models/Account');
    
    console.log('\n🔍 TRACING BALANCE SHEET DATA SOURCES');
    console.log('=======================================');
    
    // 1. Check all TransactionEntry documents
    console.log('\n1️⃣ ALL TRANSACTION ENTRIES IN DATABASE:');
    console.log('==========================================');
    
    const allTransactions = await TransactionEntry.find({}).sort({ date: 1 });
    console.log(`Total transactions in database: ${allTransactions.length}`);
    
    if (allTransactions.length === 0) {
      console.log('❌ No transactions found in database!');
      return;
    }
    
    // Group by source type
    const sourceTypes = {};
    allTransactions.forEach(tx => {
      const source = tx.source || 'unknown';
      if (!sourceTypes[source]) sourceTypes[source] = 0;
      sourceTypes[source]++;
    });
    
    console.log('\n📊 Transaction Sources:');
    Object.entries(sourceTypes).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} transactions`);
    });
    
    // 2. Check specific transaction types that affect balance sheet
    console.log('\n2️⃣ BALANCE SHEET RELEVANT TRANSACTIONS:');
    console.log('==========================================');
    
    // AR Transactions (Assets)
    const arTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-' }
    });
    console.log(`AR (Accounts Receivable) transactions: ${arTransactions.length}`);
    
    // Cash/Bank Transactions (Assets)
    const cashTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1000-' }
    });
    console.log(`Cash/Bank transactions: ${cashTransactions.length}`);
    
    // Income Transactions (Revenue)
    const incomeTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^400' }
    });
    console.log(`Income transactions: ${incomeTransactions.length}`);
    
    // Liability Transactions (Deposits)
    const liabilityTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^2000-' }
    });
    console.log(`Liability (Deposits) transactions: ${liabilityTransactions.length}`);
    
    // 3. Show sample transactions for each type
    console.log('\n3️⃣ SAMPLE TRANSACTIONS BY TYPE:');
    console.log('===============================');
    
    // Sample AR transaction
    if (arTransactions.length > 0) {
      const sampleAR = arTransactions[0];
      console.log('\n📋 Sample AR Transaction:');
      console.log(`  ID: ${sampleAR._id}`);
      console.log(`  Date: ${sampleAR.date.toISOString().split('T')[0]}`);
      console.log(`  Source: ${sampleAR.source}`);
      console.log(`  Description: ${sampleAR.description}`);
      console.log(`  Total Debit: $${sampleAR.totalDebit}`);
      console.log(`  Total Credit: $${sampleAR.totalCredit}`);
      console.log('  Entries:');
      sampleAR.entries.forEach((entry, index) => {
        console.log(`    ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`       Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`       Type: ${entry.accountType}`);
      });
    }
    
    // Sample Cash transaction
    if (cashTransactions.length > 0) {
      const sampleCash = cashTransactions[0];
      console.log('\n💰 Sample Cash Transaction:');
      console.log(`  ID: ${sampleCash._id}`);
      console.log(`  Date: ${sampleCash.date.toISOString().split('T')[0]}`);
      console.log(`  Source: ${sampleCash.source}`);
      console.log(`  Description: ${sampleCash.description}`);
      console.log(`  Total Debit: $${sampleCash.totalDebit}`);
      console.log(`  Total Credit: $${sampleCash.totalCredit}`);
      console.log('  Entries:');
      sampleCash.entries.forEach((entry, index) => {
        console.log(`    ${index + 1}. ${entry.accountCode} - ${entry.accountName}`);
        console.log(`       Debit: $${entry.debit}, Credit: $${entry.credit}`);
        console.log(`       Type: ${entry.accountType}`);
      });
    }
    
    // 4. Check Account Chart of Accounts
    console.log('\n4️⃣ CHART OF ACCOUNTS:');
    console.log('=====================');
    
    const accounts = await Account.find({}).sort({ accountCode: 1 });
    console.log(`Total accounts in chart: ${accounts.length}`);
    
    // Group by account type
    const accountTypes = {};
    accounts.forEach(account => {
      const type = account.accountType || 'unknown';
      if (!accountTypes[type]) accountTypes[type] = [];
      accountTypes[type].push(account);
    });
    
    Object.entries(accountTypes).forEach(([type, typeAccounts]) => {
      console.log(`\n${type.toUpperCase()} Accounts (${typeAccounts.length}):`);
      typeAccounts.forEach(account => {
        console.log(`  ${account.accountCode} - ${account.accountName}`);
      });
    });
    
    // 5. Calculate current balance sheet totals
    console.log('\n5️⃣ CURRENT BALANCE SHEET TOTALS:');
    console.log('==================================');
    
    // Assets
    const assetTransactions = await TransactionEntry.find({
      'entries.accountType': 'asset'
    });
    
    let totalAssets = 0;
    const assetBreakdown = {};
    
    assetTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountType === 'asset') {
          const netAmount = entry.debit - entry.credit;
          totalAssets += netAmount;
          
          const accountCode = entry.accountCode.split('-')[0]; // Get main account code
          if (!assetBreakdown[accountCode]) assetBreakdown[accountCode] = 0;
          assetBreakdown[accountCode] += netAmount;
        }
      });
    });
    
    console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
    console.log('Asset Breakdown:');
    Object.entries(assetBreakdown).forEach(([code, amount]) => {
      console.log(`  ${code}: $${amount.toFixed(2)}`);
    });
    
    // Liabilities
    const liabilityTransactions = await TransactionEntry.find({
      'entries.accountType': 'liability'
    });
    
    let totalLiabilities = 0;
    const liabilityBreakdown = {};
    
    liabilityTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountType === 'liability') {
          const netAmount = entry.credit - entry.debit; // Liabilities are credits
          totalLiabilities += netAmount;
          
          const accountCode = entry.accountCode.split('-')[0];
          if (!liabilityBreakdown[accountCode]) liabilityBreakdown[accountCode] = 0;
          liabilityBreakdown[accountCode] += netAmount;
        }
      });
    });
    
    console.log(`\nTotal Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log('Liability Breakdown:');
    Object.entries(liabilityBreakdown).forEach(([code, amount]) => {
      console.log(`  ${code}: $${amount.toFixed(2)}`);
    });
    
    // Equity (Income - Expenses)
    const incomeTransactions = await TransactionEntry.find({
      'entries.accountType': 'income'
    });
    
    let totalIncome = 0;
    incomeTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountType === 'income') {
          totalIncome += entry.credit;
        }
      });
    });
    
    console.log(`\nTotal Income: $${totalIncome.toFixed(2)}`);
    console.log(`Net Assets (Assets - Liabilities): $${(totalAssets - totalLiabilities).toFixed(2)}`);
    
    // 6. Show data flow for a specific student
    console.log('\n6️⃣ DATA FLOW FOR SPECIFIC STUDENT:');
    console.log('===================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    console.log(`Student ID: ${studentId}`);
    
    // Find all transactions for this student
    const studentTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': studentId },
        { 'entries.accountCode': { $regex: `^1100-${studentId}` } },
        { sourceId: studentId }
      ]
    }).sort({ date: 1 });
    
    console.log(`\nTransactions for this student: ${studentTransactions.length}`);
    
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
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

traceBalanceSheetData();
