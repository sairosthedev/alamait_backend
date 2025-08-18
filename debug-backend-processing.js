const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugBackendProcessing() {
  try {
    console.log('🔍 Debugging Backend Processing Logic Step by Step...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Get all transaction entries for 2025 (same as your backend)
    const allEntries = await TransactionEntry.find({
      date: { $lte: new Date('2025-12-31') },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📊 Found ${allEntries.length} transactions with status 'posted'`);

    // Step 1: Build account balances exactly like your backend
    console.log('\n🔍 STEP 1: BUILDING ACCOUNT BALANCES');
    console.log('=====================================');
    
    const accountBalances = {};
    
    allEntries.forEach((entry, index) => {
      if (entry.entries && Array.isArray(entry.entries)) {
        entry.entries.forEach((lineItem, lineIndex) => {
          const accountCode = lineItem.accountCode;
          const accountName = lineItem.accountName;
          const accountType = lineItem.accountType;
          const debit = lineItem.debit || 0;
          const credit = lineItem.credit || 0;
          
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
          
          accountBalances[accountCode].debitTotal += debit;
          accountBalances[accountCode].creditTotal += credit;
          
          console.log(`Transaction ${index + 1}, Entry ${lineIndex + 1}: ${accountCode} - ${accountName} (${accountType})`);
          console.log(`  Debit: $${debit}, Credit: $${credit}`);
          console.log(`  Running Totals: Debit: $${accountBalances[accountCode].debitTotal}, Credit: $${accountBalances[accountCode].creditTotal}`);
        });
      }
    });

    // Step 2: Calculate net balance for each account
    console.log('\n🔍 STEP 2: CALCULATING NET BALANCES');
    console.log('=====================================');
    
    Object.values(accountBalances).forEach(account => {
      switch (account.type) {
        case 'Asset':
          account.balance = account.debitTotal - account.creditTotal;
          break;
        case 'Liability':
          account.balance = account.creditTotal - account.debitTotal;
          break;
        case 'Equity':
          account.balance = account.creditTotal - account.debitTotal;
          break;
        case 'Income':
          account.balance = Math.max(0, account.creditTotal - account.debitTotal);
          break;
        case 'Expense':
          account.balance = Math.max(0, account.debitTotal - account.creditTotal);
          break;
      }
      
      console.log(`${account.code} - ${account.name} (${account.type}):`);
      console.log(`  Debit Total: $${account.debitTotal}, Credit Total: $${account.creditTotal}`);
      console.log(`  Calculated Balance: $${account.balance}`);
    });

    // Step 3: Categorize into balance sheet sections
    console.log('\n🔍 STEP 3: CATEGORIZING INTO BALANCE SHEET SECTIONS');
    console.log('=====================================');
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let retainedEarnings = 0;
    
    Object.values(accountBalances).forEach(account => {
      const balance = account.balance;
      
      switch (account.type) {
        case 'Asset':
          if (balance > 0) {
            totalAssets += balance;
            console.log(`💰 Asset: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          }
          break;
          
        case 'Liability':
          if (balance > 0) {
            totalLiabilities += balance;
            console.log(`💸 Liability: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          }
          break;
          
        case 'Equity':
          if (account.code === '3000' || account.name.toLowerCase().includes('capital')) {
            totalEquity += balance;
            console.log(`🏛️ Capital: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          } else if (account.name.toLowerCase().includes('retained') || account.name.toLowerCase().includes('earnings')) {
            retainedEarnings += balance;
            console.log(`📊 Retained Earnings: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          } else {
            totalEquity += balance;
            console.log(`🏛️ Other Equity: ${account.code} - ${account.name}: $${balance.toFixed(2)}`);
          }
          break;
          
        case 'Income':
          retainedEarnings += balance;
          console.log(`📈 Income: ${account.code} - ${account.name}: +$${balance.toFixed(2)} → Retained Earnings: $${retainedEarnings.toFixed(2)}`);
          break;
          
        case 'Expense':
          retainedEarnings -= balance;
          console.log(`📉 Expense: ${account.code} - ${account.name}: -$${balance.toFixed(2)} → Retained Earnings: $${retainedEarnings.toFixed(2)}`);
          break;
      }
    });

    // Step 4: Calculate totals
    console.log('\n🔍 STEP 4: CALCULATING TOTALS');
    console.log('=====================================');
    
    totalEquity += retainedEarnings;
    
    console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
    console.log(`Retained Earnings: $${retainedEarnings.toFixed(2)}`);
    
    // Step 5: Check accounting equation
    console.log('\n🔍 STEP 5: ACCOUNTING EQUATION CHECK');
    console.log('=====================================');
    
    const accountingEquation = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    console.log(`Assets - (Liabilities + Equity) = $${totalAssets} - ($${totalLiabilities} + $${totalEquity}) = $${(totalAssets - (totalLiabilities + totalEquity)).toFixed(2)}`);
    console.log(`Absolute Difference: $${accountingEquation.toFixed(2)}`);
    
    // Step 6: Compare with expected values
    console.log('\n🔍 STEP 6: COMPARISON WITH EXPECTED VALUES');
    console.log('=====================================');
    
    const expectedAssets = 7135;
    const expectedLiabilities = 7397.25;
    const expectedRetainedEarnings = -1762.25;
    
    console.log(`Expected Assets: $${expectedAssets.toFixed(2)}`);
    console.log(`Expected Liabilities: $${expectedLiabilities.toFixed(2)}`);
    console.log(`Expected Retained Earnings: $${expectedRetainedEarnings.toFixed(2)}`);
    
    console.log(`\nAssets Difference: $${(totalAssets - expectedAssets).toFixed(2)}`);
    console.log(`Liabilities Difference: $${(totalLiabilities - expectedLiabilities).toFixed(2)}`);
    console.log(`Retained Earnings Difference: $${(retainedEarnings - expectedRetainedEarnings).toFixed(2)}`);
    
    // Step 7: Check for specific accounts that might be causing issues
    console.log('\n🔍 STEP 7: CHECKING SPECIFIC ACCOUNTS');
    console.log('=====================================');
    
    const liabilityAccounts = Object.values(accountBalances).filter(acc => acc.type === 'Liability');
    const expenseAccounts = Object.values(accountBalances).filter(acc => acc.type === 'Expense');
    
    console.log('\nLiability Accounts:');
    liabilityAccounts.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name}: $${acc.balance.toFixed(2)} (Debit: $${acc.debitTotal}, Credit: $${acc.creditTotal})`);
    });
    
    console.log('\nExpense Accounts:');
    expenseAccounts.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name}: $${acc.balance.toFixed(2)} (Debit: $${acc.debitTotal}, Credit: $${acc.creditTotal})`);
    });

  } catch (error) {
    console.error('❌ Error debugging backend processing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugBackendProcessing();
