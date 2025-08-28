const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const BalanceSheetService = require('./src/services/balanceSheetService');

async function testBalanceSheet() {
  try {
    console.log('🔍 Testing balance sheet generation...\n');

    const year = 2025;
    const result = await BalanceSheetService.generateMonthlyBalanceSheet(year);

    console.log('📊 Balance Sheet Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);

    if (result.success && result.data && result.data.monthly) {
      // Show specific months we're interested in
      const months = ['5', '6', '8']; // May, June, August
      
      months.forEach(monthNum => {
        const month = result.data.monthly[monthNum];
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
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

testBalanceSheet();
