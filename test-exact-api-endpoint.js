const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testExactAPIEndpoint() {
  try {
    console.log('🔍 Testing Exact API Endpoint...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the exact same method that the API endpoint calls
    console.log('\n🔍 Testing BalanceSheetService.generateMonthlyBalanceSheet(2025, null)');
    console.log('This is what your API endpoint /api/financial-reports/monthly-balance-sheet calls');
    
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025, null);
    
    if (monthlyBalanceSheet.success) {
      console.log('\n📊 API RESPONSE STRUCTURE:');
      console.log('=====================================');
      console.log('Success:', monthlyBalanceSheet.success);
      console.log('Message:', monthlyBalanceSheet.message);
      
      // Check January data (the month you mentioned)
      const januaryData = monthlyBalanceSheet.data.monthly[1];
      
      if (januaryData) {
        console.log('\n📅 JANUARY 2025 DATA (Your API Response):');
        console.log('=====================================');
        
        console.log('\n💸 LIABILITIES:');
        console.log('Total Liabilities:', januaryData.liabilities.total);
        console.log('Current Liabilities Total:', januaryData.liabilities.current.total);
        
        // Check accounts payable specifically
        if (januaryData.liabilities.current.accountsPayable) {
          console.log('\n📋 ACCOUNTS PAYABLE:');
          Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`  ${code} - ${account.accountName}: $${account.amount}`);
              console.log(`    Raw amount value: ${account.amount} (Type: ${typeof account.amount})`);
              console.log(`    Is negative: ${account.amount < 0}`);
            }
          });
        }
        
        // Check tenant deposits
        if (januaryData.liabilities.current.tenantDeposits) {
          console.log('\n🏠 TENANT DEPOSITS:');
          Object.entries(januaryData.liabilities.current.tenantDeposits).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`  ${code} - ${account.accountName}: $${account.amount}`);
              console.log(`    Raw amount value: ${account.amount} (Type: ${typeof account.amount})`);
              console.log(`    Is negative: ${account.amount < 0}`);
            }
          });
        }
        
        console.log('\n🏛️ EQUITY:');
        console.log('Total Equity:', januaryData.equity.total);
        console.log('Capital Amount:', januaryData.equity.capital.amount);
        console.log('Retained Earnings Amount:', januaryData.equity.retainedEarnings.amount);
        
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
        
        // Check if any values are negative when they shouldn't be
        console.log('\n🔍 NEGATIVE VALUE CHECK:');
        console.log('=====================================');
        
        if (januaryData.liabilities.total < 0) {
          console.log('❌ WARNING: Total Liabilities is negative:', januaryData.liabilities.total);
        } else {
          console.log('✅ Total Liabilities is positive:', januaryData.liabilities.total);
        }
        
        if (januaryData.liabilities.current.total < 0) {
          console.log('❌ WARNING: Current Liabilities is negative:', januaryData.liabilities.current.total);
        } else {
          console.log('✅ Current Liabilities is positive:', januaryData.liabilities.current.total);
        }
        
        // Check individual liability accounts
        Object.entries(januaryData.liabilities.current).forEach(([key, section]) => {
          if (key !== 'total' && typeof section === 'object') {
            Object.entries(section).forEach(([code, account]) => {
              if (code !== 'total' && account.amount < 0) {
                console.log(`❌ WARNING: ${key} account ${code} has negative amount: ${account.amount}`);
              }
            });
          }
        });
        
      } else {
        console.log('❌ No January data found');
      }
      
    } else {
      console.log('❌ Monthly balance sheet generation failed');
      console.log('Response:', monthlyBalanceSheet);
    }

  } catch (error) {
    console.error('❌ Error testing exact API endpoint:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testExactAPIEndpoint();
