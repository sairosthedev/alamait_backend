const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugMonthlyFormatting() {
  try {
    console.log('🔍 Debugging Monthly Balance Sheet Formatting...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the monthly balance sheet generation
    console.log('\n🔍 Testing Monthly Balance Sheet Generation...');
    
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (monthlyBalanceSheet.success) {
      console.log('\n📊 MONTHLY BALANCE SHEET STRUCTURE:');
      console.log('=====================================');
      
      // Check the first month (January)
      const januaryData = monthlyBalanceSheet.data.monthly[1];
      
      if (januaryData) {
        console.log('\n📅 JANUARY DATA:');
        console.log('Month:', januaryData.month);
        console.log('Month Name:', januaryData.monthName);
        
        console.log('\n💸 LIABILITIES STRUCTURE:');
        console.log('Total Liabilities:', januaryData.liabilities.total);
        console.log('Current Liabilities Total:', januaryData.liabilities.current.total);
        
        // Check what's in the current liabilities
        console.log('\n🔍 CURRENT LIABILITIES BREAKDOWN:');
        console.log('Keys:', Object.keys(januaryData.liabilities.current));
        
        if (januaryData.liabilities.current.accountsPayable) {
          console.log('\n📋 ACCOUNTS PAYABLE:');
          console.log('Type:', typeof januaryData.liabilities.current.accountsPayable);
          console.log('Keys:', Object.keys(januaryData.liabilities.current.accountsPayable));
          
          Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([key, value]) => {
            if (key !== 'total') {
              console.log(`  ${key}:`, value);
              if (typeof value === 'object' && value.amount !== undefined) {
                console.log(`    Amount: ${value.amount} (Type: ${typeof value.amount})`);
                console.log(`    Account Code: ${value.accountCode}`);
                console.log(`    Account Name: ${value.accountName}`);
              }
            }
          });
        }
        
        if (januaryData.liabilities.current.tenantDeposits) {
          console.log('\n🏠 TENANT DEPOSITS:');
          console.log('Type:', typeof januaryData.liabilities.current.tenantDeposits);
          console.log('Keys:', Object.keys(januaryData.liabilities.current.tenantDeposits));
          
          Object.entries(januaryData.liabilities.current.tenantDeposits).forEach(([key, value]) => {
            if (key !== 'total') {
              console.log(`  ${key}:`, value);
            }
          });
        }
        
        console.log('\n🏛️ EQUITY STRUCTURE:');
        console.log('Total Equity:', januaryData.equity.total);
        console.log('Capital:', januaryData.equity.capital);
        console.log('Retained Earnings:', januaryData.equity.retainedEarnings);
        
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
      
      // Also check the raw data structure
      console.log('\n🔍 RAW DATA STRUCTURE:');
      console.log('=====================================');
      console.log('Success:', monthlyBalanceSheet.success);
      console.log('Message:', monthlyBalanceSheet.message);
      console.log('Data Keys:', Object.keys(monthlyBalanceSheet.data));
      console.log('Monthly Keys:', Object.keys(monthlyBalanceSheet.data.monthly));
      console.log('Annual Summary Keys:', Object.keys(monthlyBalanceSheet.data.annualSummary || {}));
      
    } else {
      console.log('❌ Monthly balance sheet generation failed');
      console.log('Response:', monthlyBalanceSheet);
    }

  } catch (error) {
    console.error('❌ Error debugging monthly formatting:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugMonthlyFormatting();
