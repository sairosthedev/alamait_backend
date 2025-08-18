const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugLiabilityFlow() {
  try {
    console.log('🔍 Debugging Liability Data Flow...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the main balance sheet generation for January 31, 2025
    console.log('\n🔍 Testing Main Balance Sheet Generation...');
    const januaryDate = new Date('2025-01-31');
    
    const mainBalanceSheet = await BalanceSheetService.generateBalanceSheet(januaryDate);
    
    if (mainBalanceSheet) {
      console.log('\n📊 MAIN BALANCE SHEET DATA:');
      console.log('=====================================');
      
      // Check liabilities structure
      console.log('\n💸 LIABILITIES STRUCTURE:');
      console.log('Current Liabilities:', Object.keys(mainBalanceSheet.liabilities.current));
      console.log('Total Current Liabilities:', mainBalanceSheet.liabilities.totalCurrent);
      console.log('Total Liabilities:', mainBalanceSheet.liabilities.totalLiabilities);
      
      // Check individual liability accounts
      Object.entries(mainBalanceSheet.liabilities.current).forEach(([code, liability]) => {
        console.log(`\n${code} - ${liability.name}:`);
        console.log(`  Balance: ${liability.balance}`);
        console.log(`  Description: ${liability.description}`);
        console.log(`  Category: ${liability.category}`);
      });
      
      // Check equity
      console.log('\n🏛️ EQUITY STRUCTURE:');
      console.log('Capital:', mainBalanceSheet.equity.capital);
      console.log('Retained Earnings:', mainBalanceSheet.equity.retainedEarnings);
      console.log('Other Equity:', mainBalanceSheet.equity.otherEquity);
      console.log('Total Equity:', mainBalanceSheet.equity.totalEquity);
      
      // Check assets
      console.log('\n💰 ASSETS STRUCTURE:');
      console.log('Total Current Assets:', mainBalanceSheet.assets.totalCurrent);
      console.log('Total Assets:', mainBalanceSheet.assets.totalAssets);
      
      // Test the formatting methods directly
      console.log('\n🔍 TESTING FORMATTING METHODS DIRECTLY...');
      
      const formattedPayable = BalanceSheetService.formatAccountsPayable(mainBalanceSheet.liabilities.current);
      console.log('\nFormatted Accounts Payable:');
      Object.entries(formattedPayable).forEach(([code, account]) => {
        console.log(`  ${code}: $${account.amount}`);
      });
      
      const formattedDeposits = BalanceSheetService.formatTenantDeposits(mainBalanceSheet.liabilities.current);
      console.log('\nFormatted Tenant Deposits:');
      Object.entries(formattedDeposits).forEach(([code, account]) => {
        console.log(`  ${code}: $${account.amount}`);
      });
      
      // Test monthly balance sheet generation
      console.log('\n🔍 TESTING MONTHLY BALANCE SHEET GENERATION...');
      
      const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
      
      if (monthlyBalanceSheet.success) {
        const januaryData = monthlyBalanceSheet.data.monthly[1];
        
        if (januaryData) {
          console.log('\n📊 JANUARY MONTHLY DATA:');
          console.log('=====================================');
          
          console.log('\n💸 LIABILITIES:');
          console.log('Total Liabilities:', januaryData.liabilities.total);
          console.log('Current Liabilities:', januaryData.liabilities.current.total);
          
          if (januaryData.liabilities.current.accountsPayable) {
            console.log('\nAccounts Payable:');
            Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
              if (code !== 'total') {
                console.log(`  ${code}: $${account.amount}`);
              }
            });
          }
          
          if (januaryData.liabilities.current.tenantDeposits) {
            console.log('\nTenant Deposits:');
            Object.entries(januaryData.liabilities.current.tenantDeposits).forEach(([code, account]) => {
              if (code !== 'total') {
                console.log(`  ${code}: $${account.amount}`);
              }
            });
          }
          
          console.log('\n🏛️ EQUITY:');
          console.log('Total Equity:', januaryData.equity.total);
          console.log('Retained Earnings:', januaryData.equity.retainedEarnings.amount);
          
          console.log('\n📋 SUMMARY:');
          console.log('Total Assets:', januaryData.summary.totalAssets);
          console.log('Total Liabilities:', januaryData.summary.totalLiabilities);
          console.log('Total Equity:', januaryData.summary.totalEquity);
          
          // Check balance sheet equation
          const assets = januaryData.summary.totalAssets;
          const liabilities = januaryData.summary.totalLiabilities;
          const equity = januaryData.summary.totalEquity;
          
          console.log('\n🔍 BALANCE SHEET EQUATION:');
          console.log(`Assets: $${assets}`);
          console.log(`Liabilities: $${liabilities}`);
          console.log(`Equity: $${equity}`);
          console.log(`Liabilities + Equity: $${liabilities + equity}`);
          
          const difference = Math.abs(assets - (liabilities + equity));
          console.log(`Difference: $${difference.toFixed(2)}`);
          
          if (difference < 0.01) {
            console.log('✅ SUCCESS: Balance sheet is balanced!');
          } else {
            console.log('❌ FAILED: Balance sheet is not balanced');
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error debugging liability flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugLiabilityFlow();
