const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigateTransactionEntriesOnly() {
  try {
    console.log('🔍 Investigating TransactionEntries Collection Only for $3,004.50 Imbalance...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Get ALL transaction entries for 2025
    const allTransactions = await TransactionEntry.find({
      date: { 
        $gte: new Date('2025-01-01'), 
        $lte: new Date('2025-12-31') 
      }
    }).sort({ date: 1 });

    console.log(`📊 Found ${allTransactions.length} transactions in 2025`);

    // Calculate running balances for each account type
    const accountBalances = {};
    let runningTotal = 0;

    console.log('\n🔍 CALCULATING RUNNING BALANCES:');
    console.log('=====================================');
    console.log('Date | Transaction | Account | Type | Debit | Credit | Running Total');
    console.log('-----|-------------|---------|------|-------|--------|---------------');

    allTransactions.forEach((tx, index) => {
      if (tx.entries && Array.isArray(tx.entries)) {
        tx.entries.forEach((entry, entryIndex) => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const accountType = entry.accountType;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;

          // Initialize account if not exists
          if (!accountBalances[accountCode]) {
            accountBalances[accountCode] = {
              code: accountCode,
              name: accountName,
              type: accountType,
              debitTotal: 0,
              creditTotal: 0,
              balance: 0
            };
          }

          // Update totals
          accountBalances[accountCode].debitTotal += debit;
          accountBalances[accountCode].creditTotal += credit;

          // Calculate balance based on account type
          switch (accountType) {
            case 'Asset':
              accountBalances[accountCode].balance = accountBalances[accountCode].debitTotal - accountBalances[accountCode].creditTotal;
              break;
            case 'Liability':
              accountBalances[accountCode].balance = accountBalances[accountCode].creditTotal - accountBalances[accountCode].debitTotal;
              break;
            case 'Equity':
              accountBalances[accountCode].balance = accountBalances[accountCode].creditTotal - accountBalances[accountCode].debitTotal;
              break;
            case 'Income':
              accountBalances[accountCode].balance = accountBalances[accountCode].creditTotal - accountBalances[accountCode].debitTotal;
              break;
            case 'Expense':
              accountBalances[accountCode].balance = accountBalances[accountCode].debitTotal - accountBalances[accountCode].creditTotal;
              break;
          }

          // Log each entry
          console.log(`${new Date(tx.date).toLocaleDateString()} | ${tx.description.substring(0, 20)}... | ${accountCode} | ${accountType} | $${debit} | $${credit} | $${accountBalances[accountCode].balance.toFixed(2)}`);
        });
      }
    });

    console.log('\n🔍 FINAL ACCOUNT BALANCES:');
    console.log('=====================================');
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    Object.values(accountBalances).forEach(account => {
      const balance = account.balance;
      
      switch (account.type) {
        case 'Asset':
          totalAssets += Math.max(0, balance);
          console.log(`💰 Asset: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          break;
        case 'Liability':
          totalLiabilities += Math.max(0, balance);
          console.log(`💸 Liability: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          break;
        case 'Equity':
          totalEquity += Math.max(0, balance);
          console.log(`🏛️ Equity: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          break;
        case 'Income':
          totalIncome += Math.max(0, balance);
          console.log(`📈 Income: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          break;
        case 'Expense':
          totalExpenses += Math.max(0, balance);
          console.log(`📉 Expense: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          break;
      }
    });

    console.log('\n🔍 BALANCE SHEET TOTALS:');
    console.log('=====================================');
    console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
    console.log(`Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);

    // Calculate Retained Earnings from Income - Expenses
    const retainedEarnings = totalIncome - totalExpenses;
    console.log(`Retained Earnings (Income - Expenses): $${retainedEarnings.toFixed(2)}`);

    // Calculate what equity should be
    const calculatedEquity = totalAssets - totalLiabilities;
    console.log(`Calculated Equity (Assets - Liabilities): $${calculatedEquity.toFixed(2)}`);

    // Check the accounting equation
    const accountingEquation = totalAssets - (totalLiabilities + totalEquity);
    console.log(`Accounting Equation (Assets - Liabilities - Equity): $${accountingEquation.toFixed(2)}`);

    console.log('\n🔍 CHECKING FOR SPECIFIC ISSUES:');
    console.log('=====================================');

    // Check for any accounts with suspicious balances
    const suspiciousAccounts = Object.values(accountBalances).filter(acc => 
      Math.abs(acc.balance) > 1000 || 
      acc.balance < 0 && acc.type === 'Asset' ||
      acc.balance < 0 && acc.type === 'Liability'
    );

    if (suspiciousAccounts.length > 0) {
      console.log(`⚠️ Found ${suspiciousAccounts.length} suspicious account balances:`);
      suspiciousAccounts.forEach(acc => {
        console.log(`  - ${acc.code} (${acc.name}): $${acc.balance.toFixed(2)} - Type: ${acc.type}`);
      });
    }

    // Check for any transactions with very large amounts
    const largeAmountTransactions = [];
    allTransactions.forEach(tx => {
      if (tx.entries) {
        tx.entries.forEach(entry => {
          if ((entry.debit && entry.debit > 1000) || (entry.credit && entry.credit > 1000)) {
            largeAmountTransactions.push({
              date: tx.date,
              description: tx.description,
              accountCode: entry.accountCode,
              accountName: entry.accountName,
              accountType: entry.accountType,
              debit: entry.debit,
              credit: entry.credit
            });
          }
        });
      }
    });

    if (largeAmountTransactions.length > 0) {
      console.log(`⚠️ Found ${largeAmountTransactions.length} transactions with amounts > $1,000:`);
      largeAmountTransactions.forEach(tx => {
        console.log(`  - ${new Date(tx.date).toLocaleDateString()}: ${tx.description}`);
        console.log(`    ${tx.accountCode} - ${tx.accountName} (${tx.accountType}): Debit: $${tx.debit || 0}, Credit: $${tx.credit || 0}`);
      });
    }

    // Check for any missing or invalid data
    const invalidEntries = [];
    allTransactions.forEach(tx => {
      if (tx.entries) {
        tx.entries.forEach(entry => {
          if (!entry.accountCode || !entry.accountName || !entry.accountType) {
            invalidEntries.push({
              transactionId: tx._id,
              date: tx.date,
              description: tx.description,
              entry: entry
            });
          }
        });
      }
    });

    if (invalidEntries.length > 0) {
      console.log(`⚠️ Found ${invalidEntries.length} entries with missing data:`);
      invalidEntries.forEach(entry => {
        console.log(`  - Transaction: ${entry.description}`);
        console.log(`    Missing: ${!entry.entry.accountCode ? 'accountCode ' : ''}${!entry.entry.accountName ? 'accountName ' : ''}${!entry.entry.accountType ? 'accountType' : ''}`);
      });
    }

    console.log('\n🔍 SUMMARY:');
    console.log('=====================================');
    console.log(`Expected imbalance: $3,004.50`);
    console.log(`Actual accounting equation difference: $${accountingEquation.toFixed(2)}`);
    
    if (Math.abs(accountingEquation - 3004.50) < 1) {
      console.log('✅ MATCH FOUND! The imbalance is in the transactionentries collection.');
    } else {
      console.log('⚠️ The imbalance is NOT in transactionentries. Check other sources.');
    }

  } catch (error) {
    console.error('❌ Error investigating transaction entries:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

investigateTransactionEntriesOnly();
