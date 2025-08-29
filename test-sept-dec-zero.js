const BalanceSheetService = require('./src/services/balanceSheetService');

async function testSeptDecZero() {
  try {
    console.log('🧪 Testing September-December Zero Balances');
    console.log('===========================================\n');

    const year = 2024;
    const months = [9, 10, 11, 12]; // September to December

    for (const month of months) {
      console.log(`\n📅 Testing ${getMonthName(month)} ${year}:`);
      console.log('─'.repeat(50));

      try {
        // Test monthly activity balance sheet
        const balanceSheet = await BalanceSheetService.generateMonthlyActivityBalanceSheet(year, month);
        
        console.log(`✅ ${getMonthName(month)} Balance Sheet Generated Successfully`);
        console.log(`📊 Total Assets: $${balanceSheet.assets.totalAssets}`);
        console.log(`📊 Total Liabilities: $${balanceSheet.liabilities.totalLiabilities}`);
        console.log(`📊 Total Equity: $${balanceSheet.equity.totalEquity}`);
        
        // Check if all totals are zero (as expected for months with no transactions)
        const isAllZero = balanceSheet.assets.totalAssets === 0 && 
                         balanceSheet.liabilities.totalLiabilities === 0 && 
                         balanceSheet.equity.totalEquity === 0;
        
        if (isAllZero) {
          console.log(`✅ ${getMonthName(month)} shows ZERO balances as expected (no transactions)`);
        } else {
          console.log(`⚠️  ${getMonthName(month)} shows NON-ZERO balances:`);
          console.log(`   - Assets: $${balanceSheet.assets.totalAssets}`);
          console.log(`   - Liabilities: $${balanceSheet.liabilities.totalLiabilities}`);
          console.log(`   - Equity: $${balanceSheet.equity.totalEquity}`);
        }

        // Show some key account details
        const cashAccounts = Object.keys(balanceSheet.assets.current).filter(code => 
          code.startsWith('100') || code.startsWith('101')
        );
        
        if (cashAccounts.length > 0) {
          console.log(`💰 Cash accounts in ${getMonthName(month)}:`);
          cashAccounts.forEach(code => {
            const account = balanceSheet.assets.current[code];
            console.log(`   - ${code} (${account.name}): $${account.balance}`);
          });
        } else {
          console.log(`💰 No cash accounts found in ${getMonthName(month)}`);
        }

      } catch (error) {
        console.error(`❌ Error testing ${getMonthName(month)}:`, error.message);
      }
    }

    console.log('\n🎯 Test Summary:');
    console.log('─'.repeat(50));
    console.log('Expected: September-December should show 0 balances when no transactions exist');
    console.log('Status: Check the results above for each month');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

// Run the test
testSeptDecZero().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
