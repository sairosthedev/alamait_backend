const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testBalanceSheetEndpoint() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FinancialReportingService = require('../services/financialReportingService');
    
    console.log('\n📊 Testing Balance Sheet API Endpoint...');
    
    // Test with the date of your adjustment transaction
    const asOfDate = '2025-10-01';
    
    console.log(`\n🔍 Testing balance sheet as of ${asOfDate}...`);
    
    const balanceSheet = await FinancialReportingService.generateBalanceSheet(asOfDate, 'cash');
    
    console.log('\n📋 BALANCE SHEET API RESPONSE:');
    console.log('Assets total:', balanceSheet.assets?.total_assets);
    console.log('Liabilities total:', balanceSheet.liabilities?.total_liabilities);
    console.log('Equity total:', balanceSheet.equity?.total_equity);
    
    console.log('\n📊 ACCOUNTING EQUATION:');
    console.log('Assets:', balanceSheet.accounting_equation?.assets);
    console.log('Liabilities + Equity:', (balanceSheet.accounting_equation?.liabilities || 0) + (balanceSheet.accounting_equation?.equity || 0));
    console.log('Balanced:', balanceSheet.accounting_equation?.balanced);
    
    console.log('\n🔍 DETAILED ACCOUNTS:');
    
    if (balanceSheet.assets) {
      console.log('\n💰 ASSETS:');
      Object.entries(balanceSheet.assets).forEach(([key, value]) => {
        if (key !== 'total_assets' && typeof value === 'object' && value.balance !== undefined) {
          console.log(`   ${value.code} - ${value.name}: $${value.balance.toFixed(2)}`);
        }
      });
      console.log(`   TOTAL: $${balanceSheet.assets.total_assets?.toFixed(2) || '0.00'}`);
    }
    
    if (balanceSheet.liabilities) {
      console.log('\n💳 LIABILITIES:');
      Object.entries(balanceSheet.liabilities).forEach(([key, value]) => {
        if (key !== 'total_liabilities' && typeof value === 'object' && value.balance !== undefined) {
          console.log(`   ${value.code} - ${value.name}: $${value.balance.toFixed(2)}`);
        }
      });
      console.log(`   TOTAL: $${balanceSheet.liabilities.total_liabilities?.toFixed(2) || '0.00'}`);
    }
    
    if (balanceSheet.equity) {
      console.log('\n🏛️ EQUITY:');
      Object.entries(balanceSheet.equity).forEach(([key, value]) => {
        if (key !== 'total_equity' && key !== 'retained_earnings' && typeof value === 'object' && value.balance !== undefined) {
          console.log(`   ${value.code} - ${value.name}: $${value.balance.toFixed(2)}`);
        }
      });
      console.log(`   TOTAL: $${balanceSheet.equity.total_equity?.toFixed(2) || '0.00'}`);
    }
    
    // Final balance check
    const totalAssets = balanceSheet.assets?.total_assets || 0;
    const totalLiabilities = balanceSheet.liabilities?.total_liabilities || 0;
    const totalEquity = balanceSheet.equity?.total_equity || 0;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    
    console.log(`\n📊 FINAL BALANCE CHECK:`);
    console.log(`   Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`   Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`   Total Equity: $${totalEquity.toFixed(2)}`);
    console.log(`   Total Liabilities + Equity: $${totalLiabilitiesAndEquity.toFixed(2)}`);
    console.log(`   Difference: $${(totalAssets - totalLiabilitiesAndEquity).toFixed(2)}`);
    
    if (Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01) {
      console.log('✅ Balance sheet is balanced!');
    } else {
      console.log('❌ Balance sheet is NOT balanced!');
    }
    
    console.log('\n🔍 TRANSACTION COUNT:', balanceSheet.transaction_count);
    console.log('🔍 RESIDENCES PROCESSED:', balanceSheet.residences_processed);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testBalanceSheetEndpoint();
