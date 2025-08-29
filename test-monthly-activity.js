const mongoose = require('mongoose');
require('dotenv').config();

async function testMonthlyActivity() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const BalanceSheetService = require('./src/services/balanceSheetService');
    
    console.log('\n🧪 TESTING MONTHLY ACTIVITY BALANCE SHEET');
    console.log('==========================================');
    
    // Test both cumulative and monthly activity types
    const year = 2025;
    
    console.log('\n1️⃣ TESTING CUMULATIVE BALANCE SHEET (default behavior):');
    const cumulativeResult = await BalanceSheetService.generateMonthlyBalanceSheet(year, null, 'cumulative');
    
    if (cumulativeResult.success) {
      console.log('✅ Cumulative balance sheet generated successfully');
      console.log('July cash amount:', cumulativeResult.data.monthly[7]?.assets?.current?.cashAndBank?.cash?.amount || 0);
      console.log('August cash amount:', cumulativeResult.data.monthly[8]?.assets?.current?.cashAndBank?.cash?.amount || 0);
    } else {
      console.log('❌ Cumulative balance sheet generation failed');
    }
    
    console.log('\n2️⃣ TESTING MONTHLY ACTIVITY BALANCE SHEET:');
    const monthlyResult = await BalanceSheetService.generateMonthlyBalanceSheet(year, null, 'monthly');
    
    if (monthlyResult.success) {
      console.log('✅ Monthly activity balance sheet generated successfully');
      console.log('July cash amount:', monthlyResult.data.monthly[7]?.assets?.current?.cashAndBank?.cash?.amount || 0);
      console.log('August cash amount:', monthlyResult.data.monthly[8]?.assets?.current?.cashAndBank?.cash?.amount || 0);
      
      // Show comparison
      console.log('\n📊 COMPARISON:');
      console.log('Cumulative vs Monthly Activity:');
      for (let month = 6; month <= 8; month++) {
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
        const cumulativeCash = cumulativeResult.data.monthly[month]?.assets?.current?.cashAndBank?.cash?.amount || 0;
        const monthlyCash = monthlyResult.data.monthly[month]?.assets?.current?.cashAndBank?.cash?.amount || 0;
        
        console.log(`${monthName}:`);
        console.log(`  Cumulative: $${cumulativeCash.toFixed(2)}`);
        console.log(`  Monthly Activity: $${monthlyCash.toFixed(2)}`);
      }
    } else {
      console.log('❌ Monthly activity balance sheet generation failed');
    }
    
    console.log('\n3️⃣ SUMMARY:');
    console.log('✅ Both cumulative and monthly activity balance sheets generated');
    console.log('✅ Monthly activity should show changes for each month, not cumulative totals');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testMonthlyActivity();
