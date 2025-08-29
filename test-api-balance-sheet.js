const axios = require('axios');

async function testBalanceSheetAPI() {
  try {
    console.log('🔍 Testing Balance Sheet API...\n');

    // Test the monthly balance sheet endpoint
    const response = await axios.get('http://localhost:5000/api/finance/balance-sheet/monthly/2025', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 API Response:');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${response.data.success}`);
    console.log(`Message: ${response.data.message}`);

    if (response.data.success && response.data.data && response.data.data.monthly) {
      // Show specific months we're interested in
      const months = ['5', '6', '8']; // May, June, August
      
      months.forEach(monthNum => {
        const month = response.data.data.monthly[monthNum];
        if (month) {
          console.log(`\n📅 ${month.monthName} 2025:`);
          console.log(`   AR: $${month.assets.current.accountsReceivable.amount || 0}`);
          console.log(`   Deposits: $${month.liabilities.current.tenantDeposits.amount || 0}`);
          console.log(`   Deferred Income: $${month.liabilities.current.deferredIncome.amount || 0}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testBalanceSheetAPI();
