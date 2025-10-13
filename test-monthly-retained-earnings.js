const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function testMonthlyRetainedEarnings() {
  console.log('🧪 Testing Monthly Retained Earnings Calculation...\n');
  
  try {
    // Test the monthly retained earnings calculation directly for October 2025
    const octoberDate = new Date('2025-10-31');
    const retainedEarnings = await SimpleBalanceSheetService.calculateMonthlyRetainedEarnings(octoberDate, null);
    
    console.log(`✅ Retained Earnings for October 2025: $${retainedEarnings}`);
    
    if (retainedEarnings !== 0) {
      console.log('🎉 SUCCESS: Monthly retained earnings is now being calculated correctly!');
    } else {
      console.log('⚠️ WARNING: Monthly retained earnings is still 0 - need to investigate further');
    }
    
    // Also test for August 2025 (should be 0 since no income/expense transactions)
    const augustDate = new Date('2025-08-31');
    const augustRetainedEarnings = await SimpleBalanceSheetService.calculateMonthlyRetainedEarnings(augustDate, null);
    
    console.log(`✅ Retained Earnings for August 2025: $${augustRetainedEarnings}`);
    
  } catch (error) {
    console.error('❌ Error testing monthly retained earnings:', error);
  }
}

testMonthlyRetainedEarnings();
