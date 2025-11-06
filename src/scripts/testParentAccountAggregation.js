const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');

async function testParentAccountAggregation() {
  try {
    await mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
    
    console.log('🔌 Connected to database...');
    
    console.log('\n🔧 TESTING PARENT ACCOUNT AGGREGATION');
    console.log('=' .repeat(60));
    
    // Test with October 2025 (has transactions)
    const asOfDate = new Date('2025-10-31T00:00:00.000Z');
    const balanceSheet = await FinancialReportingService.generateBalanceSheet(asOfDate.toISOString().split('T')[0], 'cash');
    
    console.log('\n📊 PARENT ACCOUNTS ONLY:');
    console.log('=' .repeat(40));
    
    console.log('\n💰 CURRENT ASSETS:');
    Object.entries(balanceSheet.assets.current_assets).forEach(([key, account]) => {
      console.log(`  ${account.code} - ${account.name}: $${account.balance}`);
      if (account.children && account.children.length > 0) {
        console.log(`    └─ Includes ${account.children.length} child accounts`);
        account.children.forEach(child => {
          console.log(`      • ${child.code} - ${child.name}: $${child.balance}`);
        });
      }
    });
    
    console.log('\n🏢 NON-CURRENT ASSETS:');
    Object.entries(balanceSheet.assets.non_current_assets).forEach(([key, account]) => {
      console.log(`  ${account.code} - ${account.name}: $${account.balance}`);
      if (account.children && account.children.length > 0) {
        console.log(`    └─ Includes ${account.children.length} child accounts`);
        account.children.forEach(child => {
          console.log(`      • ${child.code} - ${child.name}: $${child.balance}`);
        });
      }
    });
    
    console.log('\n💳 LIABILITIES:');
    Object.entries(balanceSheet.liabilities).forEach(([key, account]) => {
      console.log(`  ${account.code} - ${account.name}: $${account.balance}`);
      if (account.children && account.children.length > 0) {
        console.log(`    └─ Includes ${account.children.length} child accounts`);
        account.children.forEach(child => {
          console.log(`      • ${child.code} - ${child.name}: $${child.balance}`);
        });
      }
    });
    
    console.log('\n🏛️ EQUITY:');
    Object.entries(balanceSheet.equity).forEach(([key, account]) => {
      console.log(`  ${account.code} - ${account.name}: $${account.balance}`);
      if (account.children && account.children.length > 0) {
        console.log(`    └─ Includes ${account.children.length} child accounts`);
        account.children.forEach(child => {
          console.log(`      • ${child.code} - ${child.name}: $${child.balance}`);
        });
      }
    });
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Assets: $${balanceSheet.assets.total_assets}`);
    console.log(`  Total Liabilities: $${balanceSheet.liabilities.total_liabilities}`);
    console.log(`  Total Equity: $${balanceSheet.equity.total_equity}`);
    console.log(`  Balanced: ${balanceSheet.accounting_equation.balanced ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testParentAccountAggregation();




