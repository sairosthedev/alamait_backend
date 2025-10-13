const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function testTransactionProcessing() {
  console.log('🧪 Testing Transaction Processing and Parent-Child Aggregation...\n');
  
  try {
    // Test with 2024 data (which should have transactions)
    console.log('📊 Testing with 2024 data (should have transactions)...');
    const result = await SimpleBalanceSheetService.generateMonthlyBalanceSheet(2024, null, 'cumulative');
    
    console.log('\n✅ Balance Sheet Generated Successfully!');
    console.log('📈 Performance:', result.performance);
    
    // Check if we have actual data (not all zeros)
    const hasData = Object.values(result.monthly).some(month => 
      month.summary.totalAssets > 0 || 
      month.summary.totalLiabilities > 0 || 
      month.summary.totalEquity > 0
    );
    
    if (hasData) {
      console.log('\n🎉 SUCCESS: Found actual transaction data!');
      
      // Show sample data from December
      const december = result.monthly['12'];
      if (december) {
        console.log('\n📊 December 2024 Sample Data:');
        console.log('Assets:', december.summary.totalAssets);
        console.log('Liabilities:', december.summary.totalLiabilities);
        console.log('Equity:', december.summary.totalEquity);
        console.log('Balance Check:', december.balanceCheck);
        
        // Show some account details
        if (december.assets.current.cashAndBank && Object.keys(december.assets.current.cashAndBank).length > 0) {
          console.log('\n💰 Cash & Bank Accounts:');
          Object.entries(december.assets.current.cashAndBank).forEach(([key, account]) => {
            if (key !== 'total' && account.amount > 0) {
              console.log(`  ${account.accountCode} - ${account.accountName}: $${account.amount}`);
            }
          });
        }
        
        if (december.liabilities.current.accountsPayable.amount > 0) {
          console.log(`\n📋 Accounts Payable: $${december.liabilities.current.accountsPayable.amount}`);
        }
        
        if (december.equity.ownerCapital.amount > 0) {
          console.log(`\n🏛️ Owner Capital: $${december.equity.ownerCapital.amount}`);
        }
      }
    } else {
      console.log('\n⚠️ WARNING: All amounts are still zero - no transaction data found');
      console.log('This could mean:');
      console.log('1. No transactions exist for 2024');
      console.log('2. Transaction processing logic needs adjustment');
      console.log('3. Account mapping is incorrect');
    }
    
    // Show annual summary
    console.log('\n📈 Annual Summary:');
    console.log('Total Assets:', result.annualSummary.totalAnnualAssets);
    console.log('Total Liabilities:', result.annualSummary.totalAnnualLiabilities);
    console.log('Total Equity:', result.annualSummary.totalAnnualEquity);
    
  } catch (error) {
    console.error('❌ Error testing transaction processing:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testTransactionProcessing();
