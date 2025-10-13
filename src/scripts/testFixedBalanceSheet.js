const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedBalanceSheet() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FixedBalanceSheetService = require('../services/fixedBalanceSheetService');
    
    console.log('\n🔧 TESTING FIXED BALANCE SHEET SERVICE');
    console.log('=' .repeat(60));
    
    // Test October 2025
    console.log('\n📊 Testing October 2025 Balance Sheet...');
    const octoberBalanceSheet = await FixedBalanceSheetService.generateFixedBalanceSheet('2025-10-31', 'cash');
    
    console.log('\n📋 FIXED BALANCE SHEET RESULTS:');
    console.log(`   Total Assets: $${octoberBalanceSheet.assets?.total_assets || 0}`);
    console.log(`   Total Liabilities: $${octoberBalanceSheet.liabilities?.total_liabilities || 0}`);
    console.log(`   Total Equity: $${octoberBalanceSheet.equity?.total_equity || 0}`);
    console.log(`   Balanced: ${octoberBalanceSheet.accounting_equation?.balanced}`);
    console.log(`   Accounts Included: ${octoberBalanceSheet.accounts_included}`);
    
    // Show key accounts
    console.log('\n💰 KEY ASSET ACCOUNTS:');
    const keyAssetCodes = ['1000', '1001', '10003'];
    keyAssetCodes.forEach(code => {
      const account = Object.values(octoberBalanceSheet.assets || {}).find(acc => acc.code === code);
      if (account) {
        console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
      }
    });
    
    console.log('\n🏛️ KEY EQUITY ACCOUNTS:');
    const keyEquityCodes = ['3001'];
    keyEquityCodes.forEach(code => {
      const account = Object.values(octoberBalanceSheet.equity || {}).find(acc => acc.code === code);
      if (account) {
        console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
      }
    });
    
    // Test September 2025 (should show CBZ Vault opening balance)
    console.log('\n📊 Testing September 2025 Balance Sheet...');
    const septemberBalanceSheet = await FixedBalanceSheetService.generateFixedBalanceSheet('2025-09-30', 'cash');
    
    console.log('\n📋 SEPTEMBER BALANCE SHEET:');
    console.log(`   Total Assets: $${septemberBalanceSheet.assets?.total_assets || 0}`);
    console.log(`   Total Liabilities: $${septemberBalanceSheet.liabilities?.total_liabilities || 0}`);
    console.log(`   Total Equity: $${septemberBalanceSheet.equity?.total_equity || 0}`);
    console.log(`   Balanced: ${septemberBalanceSheet.accounting_equation?.balanced}`);
    
    // Show CBZ Vault in September
    const cbzVaultSept = Object.values(septemberBalanceSheet.assets || {}).find(acc => acc.code === '10003');
    if (cbzVaultSept) {
      console.log(`   CBZ Vault (10003): $${cbzVaultSept.balance.toFixed(2)}`);
    }
    
    // Test August 2025 (should show CBZ Vault opening balance)
    console.log('\n📊 Testing August 2025 Balance Sheet...');
    const augustBalanceSheet = await FixedBalanceSheetService.generateFixedBalanceSheet('2025-08-31', 'cash');
    
    console.log('\n📋 AUGUST BALANCE SHEET:');
    console.log(`   Total Assets: $${augustBalanceSheet.assets?.total_assets || 0}`);
    console.log(`   Total Liabilities: $${augustBalanceSheet.liabilities?.total_liabilities || 0}`);
    console.log(`   Total Equity: $${augustBalanceSheet.equity?.total_equity || 0}`);
    console.log(`   Balanced: ${augustBalanceSheet.accounting_equation?.balanced}`);
    
    // Show CBZ Vault in August
    const cbzVaultAug = Object.values(augustBalanceSheet.assets || {}).find(acc => acc.code === '10003');
    if (cbzVaultAug) {
      console.log(`   CBZ Vault (10003): $${cbzVaultAug.balance.toFixed(2)}`);
    }
    
    console.log('\n✅ FIXED BALANCE SHEET SERVICE TEST COMPLETE');
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Replace the current balance sheet service with this fixed version');
    console.log('   2. Update the API endpoints to use the fixed service');
    console.log('   3. Test the frontend to ensure it shows all accounts correctly');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedBalanceSheet();
