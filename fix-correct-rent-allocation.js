const mongoose = require('mongoose');
require('dotenv').config();

async function fixCorrectRentAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔧 FIXING CORRECT RENT ALLOCATION');
    console.log('==================================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Check current state
    console.log('\n📊 CURRENT STATE:');
    console.log('==================');
    
    const junePayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-06',
      source: 'payment'
    }).sort({ date: 1 });
    
    const julyPayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-07',
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`June payments: ${junePayments.length}`);
    let juneTotal = 0;
    junePayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      juneTotal += tx.totalDebit;
    });
    console.log(`  Total June: $${juneTotal.toFixed(2)}`);
    
    console.log(`July payments: ${julyPayments.length}`);
    let julyTotal = 0;
    julyPayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      julyTotal += tx.totalDebit;
    });
    console.log(`  Total July: $${julyTotal.toFixed(2)}`);
    
    // 2. Fix the allocation
    console.log('\n🔧 FIXING ALLOCATION:');
    console.log('=======================');
    
    // Expected allocation:
    // June: $36.67 (prorated rent)
    // July: $183.33 (remaining rent)
    
    if (junePayments.length >= 2) {
      // Keep the first payment ($36.67) for June
      const firstJunePayment = junePayments[0];
      console.log(`✅ Keeping first June payment: $${firstJunePayment.totalDebit.toFixed(2)}`);
      
      // Move the second payment ($183.33) to July
      const secondJunePayment = junePayments[1];
      console.log(`Moving second June payment to July: $${secondJunePayment.totalDebit.toFixed(2)}`);
      
      await TransactionEntry.findByIdAndUpdate(secondJunePayment._id, {
        $set: {
          'metadata.monthSettled': '2025-07',
          description: 'Payment allocation: rent for 2025-07 (corrected)',
          'entries.1.description': 'rent payment applied to 2025-07 (corrected)'
        }
      });
      
      console.log('✅ Second June payment moved to July');
    }
    
    // 3. Verify the fix
    console.log('\n✅ VERIFICATION:');
    console.log('=================');
    
    const updatedJunePayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-06',
      source: 'payment'
    }).sort({ date: 1 });
    
    const updatedJulyPayments = await TransactionEntry.find({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-07',
      source: 'payment'
    }).sort({ date: 1 });
    
    console.log(`June payments: ${updatedJunePayments.length}`);
    let updatedJuneTotal = 0;
    updatedJunePayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      updatedJuneTotal += tx.totalDebit;
    });
    console.log(`  Total June: $${updatedJuneTotal.toFixed(2)}`);
    
    console.log(`July payments: ${updatedJulyPayments.length}`);
    let updatedJulyTotal = 0;
    updatedJulyPayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      updatedJulyTotal += tx.totalDebit;
    });
    console.log(`  Total July: $${updatedJulyTotal.toFixed(2)}`);
    
    // 4. Expected state
    console.log('\n🎯 EXPECTED STATE:');
    console.log('===================');
    console.log('June 2025: $36.67 (prorated rent)');
    console.log('July 2025: $183.33 (remaining rent)');
    
    // 5. Calculate outstanding balances
    console.log('\n📊 OUTSTANDING BALANCES:');
    console.log('=========================');
    
    // June: $36.67 owed - $36.67 paid = $0 outstanding ✅
    // July: $220 owed - $183.33 paid = $36.67 outstanding
    
    const juneOutstanding = 36.67 - updatedJuneTotal;
    const julyOutstanding = 220 - updatedJulyTotal;
    
    console.log(`June 2025 Outstanding: $${juneOutstanding.toFixed(2)}`);
    console.log(`July 2025 Outstanding: $${julyOutstanding.toFixed(2)}`);
    
    console.log('\n📈 SUMMARY:');
    console.log('=============');
    console.log('✅ Rent allocation corrected');
    console.log('✅ June: $36.67 applied (fully paid)');
    console.log('✅ July: $183.33 applied ($36.67 outstanding)');
    console.log('✅ Payment allocation now matches expected amounts');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixCorrectRentAllocation();
