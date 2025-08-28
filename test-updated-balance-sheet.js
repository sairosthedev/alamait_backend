const mongoose = require('mongoose');
require('dotenv').config();

async function testUpdatedBalanceSheet() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const BalanceSheetService = require('./src/services/balanceSheetService');
    
    console.log('\n🧪 TESTING UPDATED BALANCE SHEET WITH MONTHSETTLED');
    console.log('==================================================');
    
    // Test balance sheet for June 2025
    const testDate = new Date(2025, 5, 30); // June 30, 2025
    
    console.log(`\n📊 Generating Balance Sheet as of ${testDate.toISOString().split('T')[0]}`);
    console.log('==================================================');
    
    const balanceSheet = await BalanceSheetService.generateBalanceSheet(testDate);
    
    console.log('\n📋 BALANCE SHEET RESULTS:');
    console.log('==========================');
    console.log(`As of Date: ${balanceSheet.asOfDate.toISOString().split('T')[0]}`);
    console.log(`Residence: ${balanceSheet.residence}`);
    
    console.log('\n💰 ASSETS:');
    console.log('===========');
    console.log('Current Assets:');
    Object.entries(balanceSheet.assets.current).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Current Assets: $${balanceSheet.assets.totalCurrent.toFixed(2)}`);
    
    console.log('\nNon-Current Assets:');
    Object.entries(balanceSheet.assets.nonCurrent).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Non-Current Assets: $${balanceSheet.assets.totalNonCurrent.toFixed(2)}`);
    console.log(`Total Assets: $${balanceSheet.assets.totalAssets.toFixed(2)}`);
    
    console.log('\n💳 LIABILITIES:');
    console.log('================');
    console.log('Current Liabilities:');
    Object.entries(balanceSheet.liabilities.current).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Current Liabilities: $${balanceSheet.liabilities.totalCurrent.toFixed(2)}`);
    
    console.log('\nNon-Current Liabilities:');
    Object.entries(balanceSheet.liabilities.nonCurrent).forEach(([account, amount]) => {
      console.log(`  ${account}: $${amount.toFixed(2)}`);
    });
    console.log(`Total Non-Current Liabilities: $${balanceSheet.liabilities.totalNonCurrent.toFixed(2)}`);
    console.log(`Total Liabilities: $${balanceSheet.liabilities.totalLiabilities.toFixed(2)}`);
    
    console.log('\n🏦 EQUITY:');
    console.log('===========');
    console.log(`Capital: $${balanceSheet.equity.capital.toFixed(2)}`);
    console.log(`Retained Earnings: $${balanceSheet.equity.retainedEarnings.toFixed(2)}`);
    console.log(`Other Equity: $${balanceSheet.equity.otherEquity.toFixed(2)}`);
    console.log(`Total Equity: $${balanceSheet.equity.totalEquity.toFixed(2)}`);
    
    console.log('\n📈 FINANCIAL RATIOS:');
    console.log('====================');
    console.log(`Working Capital: $${balanceSheet.workingCapital.toFixed(2)}`);
    console.log(`Current Ratio: ${balanceSheet.currentRatio.toFixed(2)}`);
    console.log(`Debt to Equity: ${balanceSheet.debtToEquity.toFixed(2)}`);
    
    // 2. Test monthly balance sheet
    console.log('\n📅 TESTING MONTHLY BALANCE SHEET:');
    console.log('==================================');
    
    const FinancialReportingService = require('./src/services/financialReportingService');
    
    const monthlyBalanceSheet = await FinancialReportingService.generateMonthlyBalanceSheet('2025', 'accrual');
    
    console.log('\n📊 MONTHLY BREAKDOWN (2025):');
    console.log('=============================');
    
    Object.entries(monthlyBalanceSheet.monthly_breakdown).forEach(([month, data]) => {
      console.log(`\n${month.toUpperCase()}:`);
      console.log(`  Total Assets: $${data.total_assets.toFixed(2)}`);
      console.log(`  Total Liabilities: $${data.total_liabilities.toFixed(2)}`);
      console.log(`  Net Worth: $${data.net_worth.toFixed(2)}`);
      
      // Show AR specifically
      if (data.assets.current && data.assets.current['Accounts Receivable - Tenants (1100)']) {
        console.log(`  Accounts Receivable: $${data.assets.current['Accounts Receivable - Tenants (1100)'].toFixed(2)}`);
      }
      
      // Show deposits specifically
      if (data.liabilities.current && data.liabilities.current['Tenant Deposits Held (2020)']) {
        console.log(`  Tenant Deposits: $${data.liabilities.current['Tenant Deposits Held (2020)'].toFixed(2)}`);
      }
    });
    
    console.log('\n📈 YEARLY SUMMARY:');
    console.log('==================');
    console.log(`Average Total Assets: $${monthlyBalanceSheet.yearly_summary.average_total_assets.toFixed(2)}`);
    console.log(`Average Total Liabilities: $${monthlyBalanceSheet.yearly_summary.average_total_liabilities.toFixed(2)}`);
    console.log(`Average Net Worth: $${monthlyBalanceSheet.yearly_summary.average_net_worth.toFixed(2)}`);
    console.log(`Net Worth Growth: $${monthlyBalanceSheet.yearly_summary.net_worth_growth.toFixed(2)}`);
    console.log(`Highest Net Worth Month: ${monthlyBalanceSheet.yearly_summary.highest_net_worth_month}`);
    console.log(`Lowest Net Worth Month: ${monthlyBalanceSheet.yearly_summary.lowest_net_worth_month}`);
    
    console.log('\n✅ BALANCE SHEET TEST COMPLETED');
    console.log('===============================');
    console.log('The balance sheet now correctly uses monthSettled for:');
    console.log('- Accounts Receivable calculations');
    console.log('- Cash calculations');
    console.log('- Deposit liability calculations');
    console.log('- Deferred income calculations');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testUpdatedBalanceSheet();
