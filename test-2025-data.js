const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function test2025Data() {
  console.log('🧪 Testing Simple Balance Sheet with 2025 data (which has 13 transactions)...\n');
  
  try {
    // Test with 2025 data (which has actual transactions)
    console.log('📊 Testing with 2025 data (has 13 transactions)...');
    const result = await SimpleBalanceSheetService.generateMonthlyBalanceSheet(2025, null, 'cumulative');
    
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
      
      // Show sample data from October (most recent month with data)
      const october = result.monthly['10'];
      if (october) {
        console.log('\n📊 October 2025 Sample Data:');
        console.log('Assets:', october.summary.totalAssets);
        console.log('Liabilities:', october.summary.totalLiabilities);
        console.log('Equity:', october.summary.totalEquity);
        console.log('Balance Check:', october.balanceCheck);
        
        // Show some account details
        if (october.assets.current.cashAndBank && Object.keys(october.assets.current.cashAndBank).length > 0) {
          console.log('\n💰 Cash & Bank Accounts:');
          Object.entries(october.assets.current.cashAndBank).forEach(([key, account]) => {
            if (key !== 'total' && account.amount > 0) {
              console.log(`  ${account.accountCode} - ${account.accountName}: $${account.amount}`);
            }
          });
        }
        
        if (october.assets.current.accountsReceivable.amount > 0) {
          console.log(`\n📋 Accounts Receivable: $${october.assets.current.accountsReceivable.amount}`);
        }
        
        if (october.liabilities.current.accountsPayable.amount > 0) {
          console.log(`\n📋 Accounts Payable: $${october.liabilities.current.accountsPayable.amount}`);
        }
        
        if (october.liabilities.current.deferredIncome.amount > 0) {
          console.log(`\n📋 Deferred Income: $${october.liabilities.current.deferredIncome.amount}`);
        }
        
        if (october.equity.ownerCapital.amount > 0) {
          console.log(`\n🏛️ Owner Capital: $${october.equity.ownerCapital.amount}`);
        }
        
        if (october.equity.retainedEarnings.amount > 0) {
          console.log(`\n🏛️ Retained Earnings: $${october.equity.retainedEarnings.amount}`);
        }
      }
    } else {
      console.log('\n⚠️ WARNING: All amounts are still zero - transaction processing may need adjustment');
    }
    
    // Show annual summary
    console.log('\n📈 Annual Summary:');
    console.log('Total Assets:', result.annualSummary.totalAnnualAssets);
    console.log('Total Liabilities:', result.annualSummary.totalAnnualLiabilities);
    console.log('Total Equity:', result.annualSummary.totalAnnualEquity);
    
    // Show which months have data
    console.log('\n📅 Months with data:');
    Object.entries(result.monthly).forEach(([month, data]) => {
      if (data.summary.totalAssets > 0 || data.summary.totalLiabilities > 0 || data.summary.totalEquity > 0) {
        console.log(`  ${data.monthName}: Assets=$${data.summary.totalAssets}, Liabilities=$${data.summary.totalLiabilities}, Equity=$${data.summary.totalEquity}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing 2025 data:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
test2025Data();
