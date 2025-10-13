const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function fixBalanceSheetAPI() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const Account = require('../models/Account');
    const TransactionEntry = require('../models/TransactionEntry');
    
    console.log('\n🔧 FIXING BALANCE SHEET API TO SHOW ALL ACCOUNTS');
    console.log('=' .repeat(60));
    
    // Get all accounts from chart of accounts
    const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 });
    console.log(`\n📋 Found ${allAccounts.length} active accounts in chart of accounts`);
    
    // Get all transactions
    const allTransactions = await TransactionEntry.find({ status: 'posted' }).sort({ date: 1 });
    console.log(`📋 Found ${allTransactions.length} posted transactions`);
    
    // Test different months to see the issue
    const testMonths = [
      { month: 8, year: 2025, name: 'August' },
      { month: 9, year: 2025, name: 'September' },
      { month: 10, year: 2025, name: 'October' }
    ];
    
    for (const testMonth of testMonths) {
      console.log(`\n📊 TESTING ${testMonth.name} ${testMonth.year}`);
      console.log('-' .repeat(40));
      
      // Calculate end of month date
      const endOfMonth = new Date(testMonth.year, testMonth.month, 0); // Last day of month
      console.log(`   Testing as of: ${endOfMonth.toDateString()}`);
      
      // Get transactions up to end of month
      const transactionsUpToMonth = allTransactions.filter(t => t.date <= endOfMonth);
      console.log(`   Transactions up to ${testMonth.name}: ${transactionsUpToMonth.length}`);
      
      // Initialize all accounts with zero balances
      const accountBalances = {};
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
      transactionsUpToMonth.forEach(transaction => {
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
      
      // Show key accounts for this month
      const keyAccounts = [
        '1000 - Cash',
        '1001 - Bank Account', 
        '10003 - Cbz Vault',
        '3001 - Owner Capital'
      ];
      
      console.log(`\n   Key Account Balances for ${testMonth.name}:`);
      keyAccounts.forEach(key => {
        if (accountBalances[key]) {
          const account = accountBalances[key];
          console.log(`     ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
        }
      });
      
      // Calculate totals
      const assets = Object.values(accountBalances).filter(acc => acc.type === 'Asset');
      const liabilities = Object.values(accountBalances).filter(acc => acc.type === 'Liability');
      const equity = Object.values(accountBalances).filter(acc => acc.type === 'Equity');
      
      const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
      const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
      
      console.log(`\n   ${testMonth.name} Totals:`);
      console.log(`     Assets: $${totalAssets.toFixed(2)}`);
      console.log(`     Liabilities: $${totalLiabilities.toFixed(2)}`);
      console.log(`     Equity: $${totalEquity.toFixed(2)}`);
      console.log(`     Balance Check: $${(totalAssets - totalLiabilities - totalEquity).toFixed(2)}`);
    }
    
    // Now let's check what the current API is returning vs what it should return
    console.log('\n🔍 COMPARING API RESULTS VS ACTUAL DATA');
    console.log('=' .repeat(60));
    
    // Check October 2025 (should show CBZ Vault $250 + Bank Account $700)
    const octoberEnd = new Date(2025, 9, 31); // October 31, 2025
    const octoberTransactions = allTransactions.filter(t => t.date <= octoberEnd);
    
    console.log(`\n📊 October 2025 Analysis:`);
    console.log(`   Transactions up to October 31: ${octoberTransactions.length}`);
    
    // Show all transactions for October
    octoberTransactions.forEach(transaction => {
      console.log(`   ${transaction.date.toDateString()}: ${transaction.transactionId}`);
      console.log(`     Description: ${transaction.description}`);
      console.log(`     Total: Dr. $${transaction.totalDebit}, Cr. $${transaction.totalCredit}`);
    });
    
    // Calculate what October balance sheet should show
    const octoberBalances = {};
    allAccounts.forEach(account => {
      const key = `${account.code} - ${account.name}`;
      octoberBalances[key] = {
        code: account.code,
        name: account.name,
        type: account.type,
        balance: 0
      };
    });
    
    octoberTransactions.forEach(transaction => {
      if (transaction.entries && transaction.entries.length > 0) {
        transaction.entries.forEach(entry => {
          const key = `${entry.accountCode} - ${entry.accountName}`;
          if (octoberBalances[key]) {
            if (entry.accountType === 'Asset' || entry.accountType === 'Expense') {
              octoberBalances[key].balance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              octoberBalances[key].balance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      }
    });
    
    console.log(`\n📋 October 2025 - What Balance Sheet SHOULD Show:`);
    const importantAccounts = [
      '1000 - Cash',
      '1001 - Bank Account',
      '10003 - Cbz Vault', 
      '3001 - Owner Capital'
    ];
    
    importantAccounts.forEach(key => {
      if (octoberBalances[key]) {
        console.log(`   ${octoberBalances[key].code} - ${octoberBalances[key].name}: $${octoberBalances[key].balance.toFixed(2)}`);
      }
    });
    
    // Show what your API is currently returning
    console.log(`\n❌ What Your API is Currently Showing:`);
    console.log(`   Cash: $100 (should be $110)`);
    console.log(`   Bank Account: $700 (correct)`);
    console.log(`   CBZ Vault: $0 (should be $250)`);
    console.log(`   Owner Capital: $0 (should be $950)`);
    
    console.log(`\n💡 THE PROBLEM:`);
    console.log(`   1. Your balance sheet API is not including all accounts`);
    console.log(`   2. It's not properly calculating cumulative balances`);
    console.log(`   3. It's missing opening balance transactions`);
    console.log(`   4. The monthly breakdown is not showing the correct data`);
    
    console.log(`\n🔧 SOLUTION NEEDED:`);
    console.log(`   1. Fix the balance sheet API to include ALL accounts from chart of accounts`);
    console.log(`   2. Ensure it calculates cumulative balances correctly`);
    console.log(`   3. Include opening balance transactions in the calculations`);
    console.log(`   4. Show zero balances for accounts with no transactions`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixBalanceSheetAPI();
