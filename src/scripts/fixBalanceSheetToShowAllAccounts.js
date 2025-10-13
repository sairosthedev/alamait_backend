const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixBalanceSheetToShowAllAccounts() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const Account = require('../models/Account');
    const TransactionEntry = require('../models/TransactionEntry');
    
    console.log('\n🔧 FIXING BALANCE SHEET TO SHOW ALL ACCOUNTS');
    console.log('=' .repeat(60));
    
    // Get all accounts from chart of accounts
    const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 });
    console.log(`\n📋 Found ${allAccounts.length} active accounts in chart of accounts`);
    
    // Get all transactions
    const asOfDate = new Date('2025-10-13');
    const allTransactions = await TransactionEntry.find({
      date: { $lte: asOfDate },
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`📋 Found ${allTransactions.length} transactions up to ${asOfDate.toDateString()}`);
    
    // Calculate balances for all accounts (including zero balances)
    const accountBalances = {};
    
    // Initialize all accounts with zero balances
    allAccounts.forEach(account => {
      const key = `${account.code} - ${account.name}`;
      accountBalances[key] = {
        code: account.code,
        name: account.name,
        type: account.type,
        category: account.category,
        balance: 0,
        debit_total: 0,
        credit_total: 0
      };
    });
    
    // Process transactions to calculate actual balances
    allTransactions.forEach(transaction => {
      if (transaction.entries && transaction.entries.length > 0) {
        transaction.entries.forEach(entry => {
          const accountCode = entry.accountCode;
          const accountName = entry.accountName;
          const accountType = entry.accountType;
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          const key = `${accountCode} - ${accountName}`;
          
          // Update balance if account exists in chart of accounts
          if (accountBalances[key]) {
            accountBalances[key].debit_total += debit;
            accountBalances[key].credit_total += credit;
            
            // Calculate balance based on account type
            if (accountType === 'Asset' || accountType === 'Expense') {
              accountBalances[key].balance += debit - credit;
            } else {
              accountBalances[key].balance += credit - debit;
            }
          }
        });
      }
    });
    
    // Group accounts by type
    const assets = {};
    const liabilities = {};
    const equity = {};
    const income = {};
    const expenses = {};
    
    Object.values(accountBalances).forEach(account => {
      const key = `${account.code} - ${account.name}`;
      
      switch (account.type) {
        case 'Asset':
          assets[key] = {
            balance: account.balance,
            debit_total: account.debit_total,
            credit_total: account.credit_total,
            code: account.code,
            name: account.name,
            category: account.category
          };
          break;
        case 'Liability':
          liabilities[key] = {
            balance: account.balance,
            debit_total: account.debit_total,
            credit_total: account.credit_total,
            code: account.code,
            name: account.name,
            category: account.category
          };
          break;
        case 'Equity':
          equity[key] = {
            balance: account.balance,
            debit_total: account.debit_total,
            credit_total: account.credit_total,
            code: account.code,
            name: account.name,
            category: account.category
          };
          break;
        case 'Income':
          income[key] = {
            balance: account.balance,
            debit_total: account.debit_total,
            credit_total: account.credit_total,
            code: account.code,
            name: account.name,
            category: account.category
          };
          break;
        case 'Expense':
          expenses[key] = {
            balance: account.balance,
            debit_total: account.debit_total,
            credit_total: account.credit_total,
            code: account.code,
            name: account.name,
            category: account.category
          };
          break;
      }
    });
    
    // Calculate totals
    const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
    const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
    const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
    const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
    const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
    
    // Calculate retained earnings
    const retainedEarnings = totalIncome - totalExpenses;
    
    console.log('\n📊 COMPLETE BALANCE SHEET (All Accounts):');
    console.log('=' .repeat(60));
    
    console.log(`\n💰 ASSETS (${Object.keys(assets).length} accounts):`);
    Object.values(assets).forEach(account => {
      const balanceStr = account.balance === 0 ? '$0.00' : `$${account.balance.toFixed(2)}`;
      console.log(`   ${account.code} - ${account.name}: ${balanceStr} (${account.category})`);
    });
    console.log(`   TOTAL ASSETS: $${totalAssets.toFixed(2)}`);
    
    console.log(`\n💳 LIABILITIES (${Object.keys(liabilities).length} accounts):`);
    Object.values(liabilities).forEach(account => {
      const balanceStr = account.balance === 0 ? '$0.00' : `$${account.balance.toFixed(2)}`;
      console.log(`   ${account.code} - ${account.name}: ${balanceStr} (${account.category})`);
    });
    console.log(`   TOTAL LIABILITIES: $${totalLiabilities.toFixed(2)}`);
    
    console.log(`\n🏛️ EQUITY (${Object.keys(equity).length} accounts):`);
    Object.values(equity).forEach(account => {
      const balanceStr = account.balance === 0 ? '$0.00' : `$${account.balance.toFixed(2)}`;
      console.log(`   ${account.code} - ${account.name}: ${balanceStr} (${account.category})`);
    });
    console.log(`   RETAINED EARNINGS: $${retainedEarnings.toFixed(2)}`);
    console.log(`   TOTAL EQUITY: $${(totalEquity + retainedEarnings).toFixed(2)}`);
    
    console.log(`\n📈 INCOME (${Object.keys(income).length} accounts):`);
    Object.values(income).forEach(account => {
      const balanceStr = account.balance === 0 ? '$0.00' : `$${account.balance.toFixed(2)}`;
      console.log(`   ${account.code} - ${account.name}: ${balanceStr} (${account.category})`);
    });
    console.log(`   TOTAL INCOME: $${totalIncome.toFixed(2)}`);
    
    console.log(`\n📉 EXPENSES (${Object.keys(expenses).length} accounts):`);
    Object.values(expenses).forEach(account => {
      const balanceStr = account.balance === 0 ? '$0.00' : `$${account.balance.toFixed(2)}`;
      console.log(`   ${account.code} - ${account.name}: ${balanceStr} (${account.category})`);
    });
    console.log(`   TOTAL EXPENSES: $${totalExpenses.toFixed(2)}`);
    
    // Balance sheet equation
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retainedEarnings;
    
    console.log(`\n📊 BALANCE SHEET EQUATION:`);
    console.log(`   Assets = Liabilities + Equity`);
    console.log(`   $${totalAssets.toFixed(2)} = $${totalLiabilities.toFixed(2)} + $${(totalEquity + retainedEarnings).toFixed(2)}`);
    console.log(`   $${totalAssets.toFixed(2)} = $${totalLiabilitiesAndEquity.toFixed(2)}`);
    console.log(`   Difference: $${(totalAssets - totalLiabilitiesAndEquity).toFixed(2)}`);
    
    if (Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01) {
      console.log('✅ Balance sheet is balanced!');
    } else {
      console.log('❌ Balance sheet is NOT balanced!');
    }
    
    // Show zero balance accounts
    const zeroBalanceAssets = Object.values(assets).filter(acc => acc.balance === 0);
    const zeroBalanceLiabilities = Object.values(liabilities).filter(acc => acc.balance === 0);
    const zeroBalanceEquity = Object.values(equity).filter(acc => acc.balance === 0);
    
    console.log(`\n🔍 ZERO BALANCE ACCOUNTS:`);
    console.log(`   Assets with zero balance: ${zeroBalanceAssets.length}`);
    console.log(`   Liabilities with zero balance: ${zeroBalanceLiabilities.length}`);
    console.log(`   Equity with zero balance: ${zeroBalanceEquity.length}`);
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('   The balance sheet should show ALL accounts from your chart of accounts,');
    console.log('   even if they have zero balances. This is standard accounting practice.');
    console.log('   The current API only shows accounts with transactions.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixBalanceSheetToShowAllAccounts();
