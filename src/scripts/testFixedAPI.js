const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedAPI() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FinancialReportingService = require('../services/financialReportingService');
    
    console.log('\n🔧 TESTING FIXED BALANCE SHEET API');
    console.log('=' .repeat(60));
    
    // Test October 2025
    console.log('\n📊 Testing October 2025 Balance Sheet...');
    const octoberBalanceSheet = await FinancialReportingService.generateBalanceSheet('2025-10-31', 'cash');
    
    console.log('\n📋 FIXED API RESULTS:');
    console.log(`   Total Assets: $${octoberBalanceSheet.assets?.total_assets || 0}`);
    console.log(`   Total Liabilities: $${octoberBalanceSheet.liabilities?.total_liabilities || 0}`);
    console.log(`   Total Equity: $${octoberBalanceSheet.equity?.total_equity || 0}`);
    console.log(`   Balanced: ${octoberBalanceSheet.accounting_equation?.balanced}`);
    
    // Show key accounts
    console.log('\n💰 KEY ACCOUNTS:');
    const keyAssetCodes = ['1000', '1001', '10003'];
    keyAssetCodes.forEach(code => {
      const account = Object.values(octoberBalanceSheet.assets || {}).find(acc => acc.code === code);
      if (account) {
        console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
      }
    });
    
    const keyEquityCodes = ['3001'];
    keyEquityCodes.forEach(code => {
      const account = Object.values(octoberBalanceSheet.equity || {}).find(acc => acc.code === code);
      if (account) {
        console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
      }
    });
    
    // Count accounts
    const assetCount = Object.keys(octoberBalanceSheet.assets || {}).filter(key => key !== 'total_assets').length;
    const liabilityCount = Object.keys(octoberBalanceSheet.liabilities || {}).filter(key => key !== 'total_liabilities').length;
    const equityCount = Object.keys(octoberBalanceSheet.equity || {}).filter(key => key !== 'total_equity' && key !== 'retained_earnings').length;
    
    console.log(`\n📊 ACCOUNT COUNTS:`);
    console.log(`   Assets: ${assetCount} accounts`);
    console.log(`   Liabilities: ${liabilityCount} accounts`);
    console.log(`   Equity: ${equityCount} accounts`);
    
    if (assetCount >= 20 && liabilityCount >= 15 && equityCount >= 3) {
      console.log('✅ SUCCESS: All accounts are now included!');
    } else {
      console.log('❌ ISSUE: Still missing some accounts');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedAPI();




