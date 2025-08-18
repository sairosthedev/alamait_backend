const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testAPIEndpoint() {
  try {
    console.log('🔍 Testing API Endpoint Data Structure...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the monthly balance sheet generation (this is what the API endpoint calls)
    console.log('\n🔍 Testing Monthly Balance Sheet API Endpoint...');
    
    const monthlyBalanceSheet = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (monthlyBalanceSheet.success) {
      console.log('\n📊 API RESPONSE STRUCTURE:');
      console.log('=====================================');
      
      // Check the structure that gets sent to the frontend
      console.log('\n📋 RESPONSE STRUCTURE:');
      console.log('Success:', monthlyBalanceSheet.success);
      console.log('Message:', monthlyBalanceSheet.message);
      console.log('Data keys:', Object.keys(monthlyBalanceSheet.data));
      
      // Check January data specifically
      const januaryData = monthlyBalanceSheet.data.monthly[1];
      
      if (januaryData) {
        console.log('\n📊 JANUARY DATA STRUCTURE:');
        console.log('=====================================');
        
        console.log('\n💰 ASSETS:');
        console.log('Total Assets:', januaryData.assets?.total);
        console.log('Current Assets:', januaryData.assets?.current?.total);
        
        console.log('\n💸 LIABILITIES:');
        console.log('Total Liabilities:', januaryData.liabilities?.total);
        console.log('Current Liabilities:', januaryData.liabilities?.current?.total);
        
        // Check individual liability accounts
        if (januaryData.liabilities?.current?.accountsPayable) {
          console.log('\n📝 ACCOUNTS PAYABLE DETAILS:');
          Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`  ${code}: $${account.amount} (${typeof account.amount})`);
            }
          });
        }
        
        if (januaryData.liabilities?.current?.tenantDeposits) {
          console.log('\n🏠 TENANT DEPOSITS DETAILS:');
          Object.entries(januaryData.liabilities.current.tenantDeposits).forEach(([code, account]) => {
            if (code !== 'total') {
              console.log(`  ${code}: $${account.amount} (${typeof account.amount})`);
            }
          });
        }
        
        console.log('\n🏛️ EQUITY:');
        console.log('Total Equity:', januaryData.equity?.total);
        console.log('Retained Earnings:', januaryData.equity?.retainedEarnings?.amount);
        
        console.log('\n📋 SUMMARY:');
        console.log('Total Assets:', januaryData.summary?.totalAssets);
        console.log('Total Liabilities:', januaryData.summary?.totalLiabilities);
        console.log('Total Equity:', januaryData.summary?.totalEquity);
        
        // Check balance sheet equation
        const assets = januaryData.summary?.totalAssets || 0;
        const liabilities = januaryData.summary?.totalLiabilities || 0;
        const equity = januaryData.summary?.totalEquity || 0;
        
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
        
        // Check for negative values
        console.log('\n⚠️ NEGATIVE VALUE CHECK:');
        let hasNegativeLiabilities = false;
        let hasNegativeEquity = false;
        
        if (januaryData.liabilities?.total < 0) {
          console.log(`❌ Total Liabilities is negative: $${januaryData.liabilities.total}`);
          hasNegativeLiabilities = true;
        }
        
        if (januaryData.equity?.total < 0) {
          console.log(`⚠️ Total Equity is negative: $${januaryData.equity.total} (This is OK for losses)`);
          hasNegativeEquity = true;
        }
        
        if (!hasNegativeLiabilities && !hasNegativeEquity) {
          console.log('✅ All values are properly formatted');
        }
        
        // Check the raw data structure
        console.log('\n🔍 RAW DATA STRUCTURE ANALYSIS:');
        console.log('Liabilities object keys:', Object.keys(januaryData.liabilities || {}));
        console.log('Current liabilities keys:', Object.keys(januaryData.liabilities?.current || {}));
        
        // Check if the data structure matches what the frontend expects
        console.log('\n🔍 FRONTEND COMPATIBILITY CHECK:');
        const expectedStructure = {
          hasAssets: !!januaryData.assets,
          hasLiabilities: !!januaryData.liabilities,
          hasEquity: !!januaryData.equity,
          hasSummary: !!januaryData.summary,
          liabilitiesTotal: januaryData.liabilities?.total,
          equityTotal: januaryData.equity?.total
        };
        
        Object.entries(expectedStructure).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      }
    } else {
      console.log('❌ Monthly balance sheet generation failed');
      console.log('Response:', monthlyBalanceSheet);
    }

  } catch (error) {
    console.error('❌ Error testing API endpoint:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testAPIEndpoint();
