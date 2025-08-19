const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testDeployedAPI() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Testing LOCAL BalanceSheetService...');
    const localResult = await BalanceSheetService.generateMonthlyBalanceSheet(2025);
    
    if (localResult.success) {
      console.log('✅ Local service working correctly');
      console.log('📊 Local Assets Total:', localResult.data.monthly[12]?.summary?.totalAssets || 'N/A');
      console.log('📊 Local Liabilities Total:', localResult.data.monthly[12]?.summary?.totalLiabilities || 'N/A');
      console.log('📊 Local Equity Total:', localResult.data.monthly[12]?.summary?.totalEquity || 'N/A');
    } else {
      console.log('❌ Local service failed');
    }

    console.log('\n🌐 Testing DEPLOYED API...');
    console.log('URL: https://alamait-backend.onrender.com/api/financial-reports/monthly-balance-sheet?period=2025&basis=accrual');
    
    // Try to fetch from deployed API
    try {
      const response = await fetch('https://alamait-backend.onrender.com/api/financial-reports/monthly-balance-sheet?period=2025&basis=accrual');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Deployed API responded successfully');
        console.log('📊 Deployed Assets Total:', data.data?.monthly?.[12]?.summary?.totalAssets || 'N/A');
        console.log('📊 Deployed Liabilities Total:', data.data?.monthly?.[12]?.summary?.totalLiabilities || 'N/A');
        console.log('📊 Deployed Equity Total:', data.data?.monthly?.[12]?.summary?.totalEquity || 'N/A');
        
        // Compare with local
        if (localResult.success) {
          const localAssets = localResult.data.monthly[12]?.summary?.totalAssets || 0;
          const deployedAssets = data.data?.monthly?.[12]?.summary?.totalAssets || 0;
          const localLiab = localResult.data.monthly[12]?.summary?.totalLiabilities || 0;
          const deployedLiab = data.data?.monthly?.[12]?.summary?.totalLiabilities || 0;
          const localEquity = localResult.data.monthly[12]?.summary?.totalEquity || 0;
          const deployedEquity = data.data?.monthly?.[12]?.summary?.totalEquity || 0;
          
          console.log('\n🔍 COMPARISON:');
          console.log(`Assets: Local ${localAssets} vs Deployed ${deployedAssets} (Diff: ${deployedAssets - localAssets})`);
          console.log(`Liabilities: Local ${localLiab} vs Deployed ${deployedLiab} (Diff: ${deployedLiab - localLiab})`);
          console.log(`Equity: Local ${localEquity} vs Deployed ${deployedEquity} (Diff: ${deployedEquity - localEquity})`);
        }
      } else {
        console.log(`❌ Deployed API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log('❌ Failed to reach deployed API:', error.message);
    }

  } catch (error) {
    console.error('❌ Error testing services:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testDeployedAPI();
