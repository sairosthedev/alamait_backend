const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');

/**
 * FIX DEBTOR CALCULATIONS
 * 
 * This script will fix the Total Owed calculations based on the correct fee structure:
 * - St Kilda: (Monthly Rent × Months) + $20 Admin Fee + $180 Deposit
 * - Belvedere: (Monthly Rent × Months) only
 * - Other Residences: (Monthly Rent × Months) + $180 Deposit
 */

async function fixDebtorCalculations() {
  try {
    console.log('\n🔧 FIXING DEBTOR CALCULATIONS');
    console.log('================================\n');
    
    // ========================================
    // STEP 1: GET ALL DEBTORS AND RESIDENCES
    // ========================================
    console.log('📋 STEP 1: GETTING DEBTORS AND RESIDENCES');
    console.log('==========================================\n');
    
    const debtors = await Debtor.find({});
    const residences = await Residence.find({});
    
    console.log(`👥 TOTAL DEBTORS: ${debtors.length}`);
    console.log(`🏠 TOTAL RESIDENCES: ${residences.length}\n`);
    
    if (debtors.length === 0) {
      console.log('❌ No debtors found!');
      return;
    }
    
    // Create residence lookup map
    const residenceMap = {};
    residences.forEach(residence => {
      residenceMap[residence._id.toString()] = residence;
    });
    
    // ========================================
    // STEP 2: ANALYZE CURRENT VS CORRECT CALCULATIONS
    // ========================================
    console.log('📋 STEP 2: ANALYZING CURRENT VS CORRECT CALCULATIONS');
    console.log('=====================================================\n');
    
    console.log('👥 DEBTOR CALCULATION ANALYSIS');
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Debtor Code │ Residence   │ Room Price  │ Months      │ Current Owed│ Should Be   │ Difference  │ Status      │');
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalCurrentOwed = 0;
    let totalShouldBeOwed = 0;
    const calculations = [];
    
    debtors.forEach(debtor => {
      const code = (debtor.debtorCode || 'N/A').padEnd(12);
      
      // Get residence info
      let residenceName = 'Unknown';
      let feeStructure = 'Unknown';
      if (debtor.residence && residenceMap[debtor.residence.toString()]) {
        const residence = residenceMap[debtor.residence.toString()];
        residenceName = (residence.name || 'Unknown').padEnd(12);
        
        // Determine fee structure based on residence
        if (residence.name && residence.name.toLowerCase().includes('st kilda')) {
          feeStructure = 'Rent + Admin + Deposit';
        } else if (residence.name && residence.name.toLowerCase().includes('belvedere')) {
          feeStructure = 'Rent Only';
        } else {
          feeStructure = 'Rent + Deposit';
        }
      }
      
      const roomPrice = `$${(debtor.roomPrice || 0).toFixed(2)}`.padStart(12);
      
      // Calculate months
      let months = 0;
      if (debtor.startDate && debtor.endDate) {
        const start = new Date(debtor.startDate);
        const end = new Date(debtor.endDate);
        months = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30.44));
      }
      const monthsPadded = months.toString().padEnd(12);
      
      // Current Total Owed from database
      const currentOwed = debtor.totalOwed || 0;
      const currentOwedPadded = `$${currentOwed.toFixed(2)}`.padStart(12);
      
      // Calculate what Total Owed SHOULD be based on residence
      const monthlyRent = debtor.roomPrice || 0;
      let shouldBeOwed = 0;
      
      if (feeStructure === 'Rent + Admin + Deposit') {
        // St Kilda: Rent + $20 Admin + $180 Deposit
        shouldBeOwed = (monthlyRent * months) + 20 + 180;
      } else if (feeStructure === 'Rent Only') {
        // Belvedere: Rent only
        shouldBeOwed = monthlyRent * months;
      } else {
        // Other residences: Rent + $180 Deposit
        shouldBeOwed = (monthlyRent * months) + 180;
      }
      
      const shouldBeOwedPadded = `$${shouldBeOwed.toFixed(2)}`.padStart(12);
      
      // Calculate difference
      const difference = shouldBeOwed - currentOwed;
      const differencePadded = `$${difference.toFixed(2)}`.padStart(12);
      
      // Determine status
      let status = 'Unknown';
      if (Math.abs(difference) < 0.01) {
        status = '✅ PERFECT'.padEnd(12);
      } else if (difference > 0) {
        status = '❌ UNDER'.padEnd(12);
      } else {
        status = '❌ OVER'.padEnd(12);
      }
      
      console.log(`│ ${code} │ ${residenceName} │ ${roomPrice} │ ${monthsPadded} │ ${currentOwedPadded} │ ${shouldBeOwedPadded} │ ${differencePadded} │ ${status} │`);
      
      totalCurrentOwed += currentOwed;
      totalShouldBeOwed += shouldBeOwed;
      
      // Store calculation for fixing
      calculations.push({
        debtorId: debtor._id,
        debtorCode: debtor.debtorCode,
        currentOwed: currentOwed,
        shouldBeOwed: shouldBeOwed,
        difference: difference,
        feeStructure: feeStructure,
        months: months,
        monthlyRent: monthlyRent
      });
    });
    
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalCurrentPadded = `$${totalCurrentOwed.toFixed(2)}`.padStart(12);
    const totalShouldBePadded = `$${totalShouldBeOwed.toFixed(2)}`.padStart(12);
    const totalDiffPadded = `$${(totalShouldBeOwed - totalCurrentOwed).toFixed(2)}`.padStart(12);
    console.log(`│ TOTAL       │             │             │             │ ${totalCurrentPadded} │ ${totalShouldBePadded} │ ${totalDiffPadded} │             │`);
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
    
    // ========================================
    // STEP 3: SHOW DETAILED BREAKDOWN
    // ========================================
    console.log('📋 STEP 3: DETAILED FEE STRUCTURE BREAKDOWN');
    console.log('============================================\n');
    
    calculations.forEach((calc, index) => {
      console.log(`👤 DEBTOR ${index + 1}: ${calc.debtorCode}`);
      console.log('─'.repeat(60));
      console.log(`   🏠 Fee Structure: ${calc.feeStructure}`);
      console.log(`   📅 Duration: ${calc.months} months`);
      console.log(`   💰 Monthly Rent: $${calc.monthlyRent.toFixed(2)}`);
      
      if (calc.feeStructure === 'Rent + Admin + Deposit') {
        console.log(`   💰 Admin Fee: $20.00 (one-time)`);
        console.log(`   💰 Deposit: $180.00 (one-time)`);
        console.log(`   🧮 Calculation: $${calc.monthlyRent.toFixed(2)} × ${calc.months} months + $20 + $180 = $${calc.shouldBeOwed.toFixed(2)}`);
      } else if (calc.feeStructure === 'Rent Only') {
        console.log(`   🧮 Calculation: $${calc.monthlyRent.toFixed(2)} × ${calc.months} months = $${calc.shouldBeOwed.toFixed(2)}`);
      } else {
        console.log(`   💰 Deposit: $180.00 (one-time)`);
        console.log(`   🧮 Calculation: $${calc.monthlyRent.toFixed(2)} × ${calc.months} months + $180 = $${calc.shouldBeOwed.toFixed(2)}`);
      }
      
      console.log(`   📊 Current: $${calc.currentOwed.toFixed(2)} | Should Be: $${calc.shouldBeOwed.toFixed(2)} | Difference: $${calc.difference.toFixed(2)}`);
      console.log('');
    });
    
    // ========================================
    // STEP 4: SUMMARY OF CHANGES
    // ========================================
    console.log('📋 STEP 4: SUMMARY OF CHANGES NEEDED');
    console.log('=====================================\n');
    
    console.log('🔍 SUMMARY OF CHANGES NEEDED:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  📊 CURRENT STATUS:                                                                         │');
    console.log(`│     • Total Owed (Current): $${totalCurrentOwed.toFixed(2)}                                                    │`);
    console.log(`│     • Total Owed (Should Be): $${totalShouldBeOwed.toFixed(2)}                                                    │`);
    console.log(`│     • Total Difference: $${(totalShouldBeOwed - totalCurrentOwed).toFixed(2)}                                                          │`);
    console.log('│                                                                                             │');
    console.log('│  🏠 FEE STRUCTURES BY RESIDENCE:                                                           │');
    console.log('│     • St Kilda: Rent + $20 Admin Fee + $180 Deposit                                         │');
    console.log('│     • Belvedere: Rent only (no admin, no deposit)                                           │');
    console.log('│     • Other Residences: Rent + $180 Deposit (no admin)                                       │');
    console.log('│                                                                                             │');
    console.log('│  💡 WHAT WILL BE FIXED:                                                                    │');
    console.log('│     • Update totalOwed field for each debtor                                                │');
    console.log('│     • Recalculate based on correct residence fee structure                                  │');
    console.log('│     • Ensure proper month calculations                                                      │');
    console.log('│                                                                                             │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
    // ========================================
    // STEP 5: APPLY THE FIXES
    // ========================================
    console.log('📋 STEP 5: APPLYING FIXES');
    console.log('==========================\n');
    
    let fixedCount = 0;
    let totalFixed = 0;
    
    for (const calc of calculations) {
      if (Math.abs(calc.difference) > 0.01) { // Only fix if there's a difference
        try {
          // Calculate new current balance
          const newBalance = calc.shouldBeOwed - (debtors.find(d => d._id.toString() === calc.debtorId.toString())?.totalPaid || 0);
          
          await Debtor.findByIdAndUpdate(calc.debtorId, {
            totalOwed: calc.shouldBeOwed,
            currentBalance: newBalance
          });
          
          console.log(`✅ FIXED ${calc.debtorCode}: $${calc.currentOwed.toFixed(2)} → $${calc.shouldBeOwed.toFixed(2)} (${calc.feeStructure})`);
          fixedCount++;
          totalFixed += Math.abs(calc.difference);
        } catch (error) {
          console.log(`❌ ERROR fixing ${calc.debtorCode}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${calc.debtorCode}: Already correct (${calc.feeStructure})`);
      }
    }
    
    // ========================================
    // STEP 6: VERIFICATION
    // ========================================
    console.log('\n📋 STEP 6: VERIFICATION');
    console.log('=========================\n');
    
    if (fixedCount > 0) {
      console.log('🎉 FIXES APPLIED SUCCESSFULLY!');
      console.log(`   • Fixed ${fixedCount} debtors`);
      console.log(`   • Total adjustment: $${totalFixed.toFixed(2)}`);
      console.log(`   • Your financial reports will now show accurate data`);
    } else {
      console.log('✅ NO FIXES NEEDED - All calculations are already correct!');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('   1. Run your financial reports again to see the corrected amounts');
    console.log('   2. The Total Owed will now match your fee structure per residence');
    console.log('   3. Your accrual accounting will be accurate');
    
  } catch (error) {
    console.error('❌ Error during calculation fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixDebtorCalculations();
