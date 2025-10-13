const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function testSimpleRetainedEarnings() {
  console.log('🧪 Testing Simple Retained Earnings Formula...\n');
  
  try {
    // Test October 2025 - should show -$1,010
    const octoberDate = new Date('2025-10-31');
    const retainedEarnings = await SimpleBalanceSheetService.calculateCumulativeRetainedEarnings(octoberDate, null);
    
    console.log(`✅ Retained Earnings for October 2025: $${retainedEarnings}`);
    
    if (retainedEarnings === -1010) {
      console.log('🎉 SUCCESS: Retained earnings is now -$1,010 as expected!');
    } else {
      console.log(`⚠️ Expected -$1,010 but got $${retainedEarnings}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleRetainedEarnings();
