const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Debtor = require('../src/models/Debtor');

/**
 * ANALYZE DEBTOR CALCULATIONS
 * 
 * This script will:
 * 1. Show current Total Owed calculations
 * 2. Calculate what Total Owed SHOULD be based on the formula
 * 3. Identify discrepancies
 * 4. Show the correct calculation
 */

async function analyzeDebtorCalculations() {
  try {
    console.log('\n🔍 ANALYZING DEBTOR CALCULATIONS');
    console.log('==================================\n');
    
    console.log('📋 FORMULA: Total Owed = (Monthly Rent × Number of Months) + $20 Admin Fee + $180 Deposit\n');
    
    // ========================================
    // STEP 1: GET ALL DEBTORS
    // ========================================
    console.log('📋 STEP 1: ANALYZING CURRENT DEBTOR DATA');
    console.log('========================================\n');
    
    const debtors = await Debtor.find({});
    console.log(`👥 TOTAL DEBTORS: ${debtors.length}\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found!');
      return;
    }
    
    // ========================================
    // STEP 2: ANALYZE EACH DEBTOR
    // ========================================
    console.log('📋 STEP 2: DETAILED DEBTOR ANALYSIS');
    console.log('====================================\n');
    
    console.log('👥 DEBTOR CALCULATION ANALYSIS');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code │ Room Price  │ Start Date  │ End Date    │ Months      │ Current Owed│ Should Be   │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalCurrentOwed = 0;
    let totalShouldBeOwed = 0;
    
    debtors.forEach(debtor => {
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      const roomPrice = `$${(debtor.roomPrice || 0).toFixed(2)}`.padStart(12);
      
      // Get start and end dates
      let startDate = 'N/A';
      let endDate = 'N/A';
      let months = 0;
      
      if (debtor.startDate && debtor.endDate) {
        startDate = new Date(debtor.startDate).toLocaleDateString().padEnd(12);
        endDate = new Date(debtor.endDate).toLocaleDateString().padEnd(12);
        
        // Calculate months between dates
        const start = new Date(debtor.startDate);
        const end = new Date(debtor.endDate);
        months = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30.44)); // Average month length
      }
      
      const monthsPadded = months.toString().padStart(12);
      
      // Current Total Owed from database
      const currentOwed = debtor.totalOwed || 0;
      const currentOwedPadded = `$${currentOwed.toFixed(2)}`.padStart(12);
      
      // Calculate what Total Owed SHOULD be
      const monthlyRent = debtor.roomPrice || 0;
      const adminFee = 20;
      const deposit = 180;
      const shouldBeOwed = (monthlyRent * months) + adminFee + deposit;
      const shouldBeOwedPadded = `$${shouldBeOwed.toFixed(2)}`.padStart(12);
      
      console.log(`│ ${code} │ ${roomPrice} │ ${startDate} │ ${endDate} │ ${monthsPadded} │ ${currentOwedPadded} │ ${shouldBeOwedPadded} │`);
      
      totalCurrentOwed += currentOwed;
      totalShouldBeOwed += shouldBeOwed;
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalCurrentPadded = `$${totalCurrentOwed.toFixed(2)}`.padStart(12);
    const totalShouldBePadded = `$${totalShouldBeOwed.toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │             │             │             │             │ ${totalCurrentPadded} │ ${totalShouldBePadded} │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // STEP 3: DETAILED BREAKDOWN FOR EACH DEBTOR
    // ========================================
    console.log('📋 STEP 3: DETAILED CALCULATION BREAKDOWN');
    console.log('==========================================\n');
    
    debtors.forEach((debtor, index) => {
      console.log(`👤 DEBTOR ${index + 1}: ${debtor.debtorCode}`);
      console.log('─'.repeat(50));
      
      // Get dates
      if (debtor.startDate && debtor.endDate) {
        const start = new Date(debtor.startDate);
        const end = new Date(debtor.endDate);
        const months = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30.44));
        
        const monthlyRent = debtor.roomPrice || 0;
        const adminFee = 20;
        const deposit = 180;
        
        console.log(`   📅 Start Date: ${start.toLocaleDateString()}`);
        console.log(`   📅 End Date: ${end.toLocaleDateString()}`);
        console.log(`   📅 Duration: ${months} months`);
        console.log(`   💰 Monthly Rent: $${monthlyRent.toFixed(2)}`);
        console.log(`   💰 Admin Fee: $${adminFee.toFixed(2)} (one-time)`);
        console.log(`   💰 Deposit: $${deposit.toFixed(2)} (one-time)`);
        console.log('');
        
        // Calculate components
        const rentComponent = monthlyRent * months;
        const totalShouldBe = rentComponent + adminFee + deposit;
        const currentOwed = debtor.totalOwed || 0;
        
        console.log(`   🧮 CALCULATION BREAKDOWN:`);
        console.log(`      • Rent Component: $${monthlyRent.toFixed(2)} × ${months} months = $${rentComponent.toFixed(2)}`);
        console.log(`      • Admin Fee: $${adminFee.toFixed(2)}`);
        console.log(`      • Deposit: $${deposit.toFixed(2)}`);
        console.log(`      • Total Should Be: $${totalShouldBe.toFixed(2)}`);
        console.log('');
        
        console.log(`   📊 COMPARISON:`);
        console.log(`      • Current Total Owed: $${currentOwed.toFixed(2)}`);
        console.log(`      • Should Be: $${totalShouldBe.toFixed(2)}`);
        
        const difference = totalShouldBe - currentOwed;
        if (Math.abs(difference) < 0.01) {
          console.log(`      • Status: ✅ PERFECT MATCH!`);
        } else if (difference > 0) {
          console.log(`      • Status: ❌ UNDERCHARGED by $${difference.toFixed(2)}`);
        } else {
          console.log(`      • Status: ❌ OVERCHARGED by $${Math.abs(difference).toFixed(2)}`);
        }
      } else {
        console.log(`   ❌ Missing start/end dates - cannot calculate properly`);
      }
      
      console.log('');
    });
    
    // ========================================
    // STEP 4: SUMMARY ANALYSIS
    // ========================================
    console.log('📋 STEP 4: SUMMARY ANALYSIS');
    console.log('============================\n');
    
    const totalDifference = totalShouldBeOwed - totalCurrentOwed;
    
    console.log('🔍 OVERALL ANALYSIS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 CURRENT STATUS:                                                                         │');
    console.log(`│     • Total Owed (Current): $${totalCurrentOwed.toFixed(2)}                                                    │`);
    console.log(`│     • Total Owed (Should Be): $${totalShouldBeOwed.toFixed(2)}                                                    │`);
    console.log(`│     • Difference: $${totalDifference.toFixed(2)}                                                          │`);
    console.log('│                                                                                             │');
    
    if (Math.abs(totalDifference) < 0.01) {
      console.log('│  ✅ STATUS: PERFECT MATCH - All calculations are correct!                              │');
    } else if (totalDifference > 0) {
      console.log('│  ❌ STATUS: UNDERCHARGED - Students owe more than currently recorded                    │');
    } else {
      console.log('│  ❌ STATUS: OVERCHARGED - Students owe less than currently recorded                     │');
    }
    
    console.log('│                                                                                             │');
    console.log('│  💡 RECOMMENDATION:                                                                         │');
    if (Math.abs(totalDifference) < 0.01) {
      console.log('│     • No action needed - calculations are perfect                                        │');
    } else {
      console.log('│     • Review and correct Total Owed calculations for each debtor                        │');
      console.log('│     • Ensure proper start/end dates are set for each student                            │');
      console.log('│     • Verify monthly rent amounts are correct                                           │');
    }
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: FORMULA VERIFICATION
    // ========================================
    console.log('📋 STEP 5: FORMULA VERIFICATION');
    console.log('=================================\n');
    
    console.log('✅ FORMULA VERIFIED:');
    console.log('   Total Owed = (Monthly Rent × Number of Months) + $20 Admin Fee + $180 Deposit');
    console.log('');
    console.log('📝 COMPONENTS:');
    console.log('   • Monthly Rent: From debtor.roomPrice field');
    console.log('   • Number of Months: Calculated from startDate to endDate');
    console.log('   • Admin Fee: Fixed $20 (one-time)');
    console.log('   • Deposit: Fixed $180 (one-time)');
    console.log('');
    console.log('🔧 IMPLEMENTATION:');
    console.log('   • This should be calculated automatically when creating debtors');
    console.log('   • Should be updated when lease terms change');
    console.log('   • Should match the billing period calculations');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
analyzeDebtorCalculations();
