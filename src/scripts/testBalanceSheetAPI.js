const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testBalanceSheetAPI() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    // Test different balance sheet endpoints
    const FinancialReportingService = require('../services/financialReportingService');
    
    console.log('\n📊 Testing Balance Sheet Generation...');
    
    // Test with the date of your adjustment transaction
    const asOfDate = '2025-10-01';
    
    console.log(`\n🔍 Testing balance sheet as of ${asOfDate}...`);
    
    try {
      const balanceSheet = await FinancialReportingService.generateBalanceSheet(asOfDate, 'cash');
      
      console.log('\n📋 BALANCE SHEET RESULTS:');
      console.log('Assets:', balanceSheet.assets);
      console.log('Liabilities:', balanceSheet.liabilities);
      console.log('Equity:', balanceSheet.equity);
      
      const totalAssets = balanceSheet.assets?.total || 0;
      const totalLiabilities = balanceSheet.liabilities?.total || 0;
      const totalEquity = balanceSheet.equity?.total || 0;
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
      
      console.log(`\n📊 BALANCE SHEET TOTALS:`);
      console.log(`   Total Assets: $${totalAssets.toFixed(2)}`);
      console.log(`   Total Liabilities: $${totalLiabilities.toFixed(2)}`);
      console.log(`   Total Equity: $${totalEquity.toFixed(2)}`);
      console.log(`   Total Liabilities + Equity: $${totalLiabilitiesAndEquity.toFixed(2)}`);
      console.log(`   Difference: $${(totalAssets - totalLiabilitiesAndEquity).toFixed(2)}`);
      
      if (Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01) {
        console.log('✅ Balance sheet is balanced!');
      } else {
        console.log('❌ Balance sheet is NOT balanced!');
        
        // Show detailed breakdown
        console.log('\n🔍 DETAILED BREAKDOWN:');
        
        if (balanceSheet.assets?.accounts) {
          console.log('\n💰 ASSETS:');
          balanceSheet.assets.accounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
          });
        }
        
        if (balanceSheet.liabilities?.accounts) {
          console.log('\n💳 LIABILITIES:');
          balanceSheet.liabilities.accounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
          });
        }
        
        if (balanceSheet.equity?.accounts) {
          console.log('\n🏛️ EQUITY:');
          balanceSheet.equity.accounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}: $${account.balance.toFixed(2)}`);
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error generating balance sheet:', error);
    }
    
    // Also test with accrual basis
    console.log(`\n🔍 Testing balance sheet as of ${asOfDate} (accrual basis)...`);
    
    try {
      const balanceSheetAccrual = await FinancialReportingService.generateBalanceSheet(asOfDate, 'accrual');
      
      const totalAssetsAccrual = balanceSheetAccrual.assets?.total || 0;
      const totalLiabilitiesAccrual = balanceSheetAccrual.liabilities?.total || 0;
      const totalEquityAccrual = balanceSheetAccrual.equity?.total || 0;
      const totalLiabilitiesAndEquityAccrual = totalLiabilitiesAccrual + totalEquityAccrual;
      
      console.log(`\n📊 ACCRUAL BASIS BALANCE SHEET TOTALS:`);
      console.log(`   Total Assets: $${totalAssetsAccrual.toFixed(2)}`);
      console.log(`   Total Liabilities: $${totalLiabilitiesAccrual.toFixed(2)}`);
      console.log(`   Total Equity: $${totalEquityAccrual.toFixed(2)}`);
      console.log(`   Total Liabilities + Equity: $${totalLiabilitiesAndEquityAccrual.toFixed(2)}`);
      console.log(`   Difference: $${(totalAssetsAccrual - totalLiabilitiesAndEquityAccrual).toFixed(2)}`);
      
      if (Math.abs(totalAssetsAccrual - totalLiabilitiesAndEquityAccrual) < 0.01) {
        console.log('✅ Accrual balance sheet is balanced!');
      } else {
        console.log('❌ Accrual balance sheet is NOT balanced!');
      }
      
    } catch (error) {
      console.error('❌ Error generating accrual balance sheet:', error);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testBalanceSheetAPI();
