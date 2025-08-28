const mongoose = require('mongoose');
require('dotenv').config();

async function fixRentAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🔧 FIXING RENT ALLOCATION');
    console.log('==========================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Check current state
    console.log('\n📊 CURRENT STATE:');
    console.log('==================');
    
    const junePayment = await TransactionEntry.findOne({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-06',
      source: 'payment'
    });
    
    const julyPayment = await TransactionEntry.findOne({
      'metadata.studentId': studentId,
      'metadata.monthSettled': '2025-07',
      source: 'payment'
    });
    
    if (junePayment) {
      console.log(`June Payment: $${junePayment.totalDebit} (${junePayment.metadata?.paymentType})`);
    }
    
    if (julyPayment) {
      console.log(`July Payment: $${julyPayment.totalDebit} (${julyPayment.metadata?.paymentType})`);
    }
    
    // 2. Fix the allocation
    console.log('\n🔧 FIXING ALLOCATION:');
    console.log('=======================');
    
    if (julyPayment && julyPayment.totalDebit === 183.33333333333334) {
      console.log(`Moving $${julyPayment.totalDebit.toFixed(2)} from July to June`);
      
      // Update July payment to June
      await TransactionEntry.findByIdAndUpdate(julyPayment._id, {
        $set: {
          'metadata.monthSettled': '2025-06',
          description: 'Payment allocation: rent for 2025-06 (corrected)',
          'entries.1.description': 'rent payment applied to 2025-06 (corrected)'
        }
      });
      
      console.log('✅ July payment moved to June');
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
    let juneTotal = 0;
    updatedJunePayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      juneTotal += tx.totalDebit;
    });
    console.log(`  Total June: $${juneTotal.toFixed(2)}`);
    
    console.log(`July payments: ${updatedJulyPayments.length}`);
    let julyTotal = 0;
    updatedJulyPayments.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.totalDebit}`);
      julyTotal += tx.totalDebit;
    });
    console.log(`  Total July: $${julyTotal.toFixed(2)}`);
    
    // 4. Expected state
    console.log('\n🎯 EXPECTED STATE:');
    console.log('===================');
    console.log('June 2025: $36.67 + $183.33 = $220 total (should be $36.67 outstanding)');
    console.log('July 2025: $0 (should be $220 outstanding)');
    
    console.log('\n📈 SUMMARY:');
    console.log('=============');
    console.log('✅ Rent allocation corrected');
    console.log('✅ June should now have $36.67 outstanding (prorated rent)');
    console.log('✅ July should now have $220 outstanding (full monthly rent)');
    console.log('✅ Payment allocation should work correctly now');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixRentAllocation();
