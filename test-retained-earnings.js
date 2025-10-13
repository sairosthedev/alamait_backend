const SimpleBalanceSheetService = require('./src/services/simpleBalanceSheetService');

async function testRetainedEarnings() {
  console.log('🧪 Testing Retained Earnings Calculation...\n');
  
  try {
    // Test the retained earnings calculation directly
    const retainedEarnings = await SimpleBalanceSheetService.calculateRetainedEarnings(2025, null);
    
    console.log(`✅ Retained Earnings for 2025: $${retainedEarnings}`);
    
    if (retainedEarnings !== 0) {
      console.log('🎉 SUCCESS: Retained earnings is now being calculated correctly!');
    } else {
      console.log('⚠️ WARNING: Retained earnings is still 0 - need to investigate further');
    }
    
  } catch (error) {
    console.error('❌ Error testing retained earnings:', error);
  }
}

testRetainedEarnings();
