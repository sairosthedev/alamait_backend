const mongoose = require('mongoose');
require('dotenv').config();

async function testFixedOutstandingBalances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    const studentId = '68af33e9aef6b0dcc8e8f14b'; // The student from the user's query
    
    console.log('\n🧪 TESTING FIXED OUTSTANDING BALANCES');
    console.log('=====================================');
    
    // Test the fixed method
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log('\n📊 RESULTS:');
    console.log(`Found ${outstandingBalances.length} months with outstanding balances`);
    
    outstandingBalances.forEach((month, index) => {
      console.log(`\n  ${index + 1}. ${month.monthKey} (${month.monthName}):`);
      console.log(`     Rent: $${month.rent.outstanding.toFixed(2)}`);
      console.log(`     Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
      console.log(`     Deposit: $${month.deposit.outstanding.toFixed(2)}`);
      console.log(`     Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
    });
    
    const totalOutstanding = outstandingBalances.reduce((sum, month) => sum + month.totalOutstanding, 0);
    console.log(`\n💰 TOTAL OUTSTANDING: $${totalOutstanding.toFixed(2)}`);
    
    // Check if May 2025 (lease start month) is included
    const may2025 = outstandingBalances.find(month => month.monthKey === '2025-05');
    if (may2025) {
      console.log(`\n✅ SUCCESS: May 2025 (lease start month) is now included!`);
      console.log(`   Outstanding: $${may2025.totalOutstanding.toFixed(2)}`);
    } else {
      console.log(`\n❌ ISSUE: May 2025 (lease start month) is still missing!`);
    }
    
    // Expected total should be $838.71 (May: $298.71 + June: $180 + July: $180 + August: $180)
    const expectedTotal = 838.71;
    if (Math.abs(totalOutstanding - expectedTotal) < 0.01) {
      console.log(`\n✅ SUCCESS: Total outstanding matches expected amount of $${expectedTotal.toFixed(2)}`);
    } else {
      console.log(`\n❌ ISSUE: Total outstanding $${totalOutstanding.toFixed(2)} doesn't match expected $${expectedTotal.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedOutstandingBalances();
