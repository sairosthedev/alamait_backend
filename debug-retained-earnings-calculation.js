const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugRetainedEarningsCalculation() {
  try {
    console.log('🔍 Debugging Retained Earnings Calculation...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test with December 31, 2025
    const testDate = new Date('2025-12-31');
    
    console.log(`📊 Generating Balance Sheet for ${testDate.toDateString()}`);
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet(testDate);
    
    console.log('\n🔍 BALANCE SHEET TOTALS:');
    console.log('=====================================');
    console.log(`Assets Total: $${balanceSheet.assets.totalAssets.toLocaleString()}`);
    console.log(`Liabilities Total: $${balanceSheet.liabilities.totalLiabilities.toLocaleString()}`);
    console.log(`Equity Total: $${balanceSheet.equity.totalEquity.toLocaleString()}`);
    
    console.log('\n🔍 EQUITY BREAKDOWN:');
    console.log('=====================================');
    console.log(`Capital: $${balanceSheet.equity.capital.toLocaleString()}`);
    console.log(`Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
    console.log(`Other Equity: $${balanceSheet.equity.otherEquity.toLocaleString()}`);
    
    console.log('\n🔍 ACCOUNTING EQUATION CHECK:');
    console.log('=====================================');
    const calculatedEquity = balanceSheet.assets.totalAssets - balanceSheet.liabilities.totalLiabilities;
    const actualEquity = balanceSheet.equity.totalEquity;
    const difference = calculatedEquity - actualEquity;
    
    console.log(`Assets - Liabilities = ${balanceSheet.assets.totalAssets} - ${balanceSheet.liabilities.totalLiabilities} = $${calculatedEquity.toLocaleString()}`);
    console.log(`Actual Equity: $${actualEquity.toLocaleString()}`);
    console.log(`Difference: $${difference.toLocaleString()}`);
    
    console.log('\n🔍 TRANSACTION ANALYSIS FOR RETAINED EARNINGS:');
    console.log('=====================================');
    
    // Get all income and expense transactions up to December 31, 2025
    const incomeExpenseTransactions = await TransactionEntry.find({
      date: { $lte: testDate },
      'entries.accountType': { $in: ['Income', 'Expense'] }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${incomeExpenseTransactions.length} income/expense transactions`);
    
    let retainedEarnings = 0;
    let incomeTotal = 0;
    let expenseTotal = 0;
    
    console.log('\n📋 Transaction Details:');
    console.log('Date | Account | Type | Debit | Credit | Running Balance');
    console.log('-----|---------|------|-------|--------|----------------');
    
    incomeExpenseTransactions.forEach((tx, index) => {
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountType === 'Income' || entry.accountType === 'Expense') {
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          
          if (entry.accountType === 'Income') {
            incomeTotal += credit;
            retainedEarnings += credit;
          } else if (entry.accountType === 'Expense') {
            expenseTotal += debit;
            retainedEarnings -= debit;
          }
          
          console.log(`${new Date(tx.date).toLocaleDateString()} | ${entry.accountCode} - ${entry.accountName} | ${entry.accountType} | $${debit} | $${credit} | $${retainedEarnings.toFixed(2)}`);
        }
      });
    });
    
    console.log('\n💰 FINAL TOTALS:');
    console.log('=====================================');
    console.log(`Total Income: $${incomeTotal.toLocaleString()}`);
    console.log(`Total Expenses: $${expenseTotal.toLocaleString()}`);
    console.log(`Net Income: $${(incomeTotal - expenseTotal).toLocaleString()}`);
    console.log(`🏛️ Final Retained Earnings: $${retainedEarnings.toLocaleString()}`);
    
    console.log('\n🔍 COMPARISON WITH BALANCE SHEET:');
    console.log('=====================================');
    console.log(`Calculated from transactions: $${retainedEarnings.toLocaleString()}`);
    console.log(`Balance Sheet shows: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
    console.log(`Difference: $${(retainedEarnings - balanceSheet.equity.retainedEarnings).toLocaleString()}`);
    
    // Check if there are any manual adjustments or other equity entries
    console.log('\n🔍 CHECKING FOR OTHER EQUITY ENTRIES:');
    console.log('=====================================');
    
    const equityTransactions = await TransactionEntry.find({
      date: { $lte: testDate },
      'entries.accountType': 'Equity'
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${equityTransactions.length} equity transactions`);
    
    equityTransactions.forEach((tx, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`Date: ${new Date(tx.date).toLocaleDateString()}`);
      console.log(`Source: ${tx.source}`);
      console.log(`Description: ${tx.description}`);
      
      tx.entries.forEach((entry, entryIndex) => {
        if (entry.accountType === 'Equity') {
          console.log(`  Entry ${entryIndex + 1}:`);
          console.log(`    Account: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`    Debit: $${entry.debit || 0}`);
          console.log(`    Credit: $${entry.credit || 0}`);
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error debugging retained earnings calculation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugRetainedEarningsCalculation();
