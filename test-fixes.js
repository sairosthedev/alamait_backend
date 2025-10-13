const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function testFixes() {
  console.log('🧪 Testing Fixed Balance Sheet Service...\n');
  
  try {
    // Test with 2025 data
    console.log('📊 Testing with 2025 data...');
    const result = await SimpleBalanceSheetService.generateMonthlyBalanceSheet(2025, null, 'cumulative');
    
    console.log('\n✅ Balance Sheet Generated Successfully!');
    
    // Check October data (which should have the most activity)
    const october = result.monthly['10'];
    if (october) {
      console.log('\n📊 October 2025 Data:');
      console.log('Assets:', october.summary.totalAssets);
      console.log('Liabilities:', october.summary.totalLiabilities);
      console.log('Equity:', october.summary.totalEquity);
      console.log('Balance Check:', october.balanceCheck);
      
      // Check Accounts Receivable
      console.log('\n📋 Accounts Receivable:');
      console.log('Amount:', october.assets.current.accountsReceivable.amount);
      console.log('Account Code:', october.assets.current.accountsReceivable.accountCode);
      console.log('Account Name:', october.assets.current.accountsReceivable.accountName);
      
      // Check Retained Earnings
      console.log('\n🏛️ Retained Earnings:');
      console.log('Amount:', october.equity.retainedEarnings.amount);
      console.log('Account Code:', october.equity.retainedEarnings.accountCode);
      console.log('Account Name:', october.equity.retainedEarnings.accountName);
      
      // Check if balance sheet balances
      const assets = october.summary.totalAssets;
      const liabilities = october.summary.totalLiabilities;
      const equity = october.summary.totalEquity;
      const difference = Math.abs(assets - (liabilities + equity));
      
      console.log('\n⚖️ Balance Check:');
      console.log(`Assets (${assets}) = Liabilities (${liabilities}) + Equity (${equity})`);
      console.log(`Difference: $${difference}`);
      
      if (difference < 0.01) {
        console.log('✅ Balance sheet is balanced!');
      } else {
        console.log('⚠️ Balance sheet is off by $' + difference.toFixed(2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing fixes:', error);
  }
}

testFixes();
