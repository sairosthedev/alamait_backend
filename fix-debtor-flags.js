const mongoose = require('mongoose');
require('dotenv').config();

async function fixDebtorFlags() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    
    console.log('\n🔧 FIXING DEBTOR FLAGS');
    console.log('======================');
    
    // Find the debtor record for the student
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    const debtor = await Debtor.findOne({ user: studentId });
    
    if (!debtor) {
      console.log('❌ No debtor record found for student:', studentId);
      return;
    }
    
    console.log(`\n📋 CURRENT DEBTOR STATUS:`);
    console.log(`   Admin Fee Paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
    console.log(`   Deposit Paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
    console.log(`   Deferred Income: $${debtor.deferredIncome?.totalAmount || 0}`);
    
    // Check what the flags should be based on outstanding balances
    console.log(`\n🔍 OUTSTANDING BALANCES ANALYSIS:`);
    console.log('==================================');
    console.log('June 2025:');
    console.log('  - Admin Fee: $20 outstanding');
    console.log('  - Deposit: $220 outstanding');
    console.log('');
    console.log('Since these amounts are still outstanding, the flags should be:');
    console.log('  - Admin Fee Paid: false');
    console.log('  - Deposit Paid: false');
    
    // Fix the flags
    console.log(`\n🔧 FIXING DEBTOR FLAGS...`);
    
    const updateResult = await Debtor.findByIdAndUpdate(debtor._id, {
      $set: {
        'onceOffCharges.adminFee.isPaid': false,
        'onceOffCharges.adminFee.paidDate': null,
        'onceOffCharges.adminFee.paidAmount': 0,
        'onceOffCharges.adminFee.paymentId': null,
        'onceOffCharges.deposit.isPaid': false,
        'onceOffCharges.deposit.paidDate': null,
        'onceOffCharges.deposit.paidAmount': 0,
        'onceOffCharges.deposit.paymentId': null
      }
    });
    
    if (updateResult) {
      console.log('✅ Debtor flags updated successfully');
      
      // Verify the update
      const updatedDebtor = await Debtor.findById(debtor._id);
      console.log(`\n📋 UPDATED DEBTOR STATUS:`);
      console.log(`   Admin Fee Paid: ${updatedDebtor.onceOffCharges?.adminFee?.isPaid || false}`);
      console.log(`   Deposit Paid: ${updatedDebtor.onceOffCharges?.deposit?.isPaid || false}`);
      console.log(`   Deferred Income: $${updatedDebtor.deferredIncome?.totalAmount || 0}`);
      
      console.log('\n🎉 DEBTOR FLAGS FIXED!');
      console.log('======================');
      console.log('Now the payment allocation should:');
      console.log('1. Process the $20 admin fee payment');
      console.log('2. Process the $220 deposit payment');
      console.log('3. Create proper accounting entries for both');
      console.log('4. Show cash as $460 (full payment amount)');
      console.log('5. Show AR as $0 (fully settled)');
      console.log('6. Show deposits as $220 (deposit liability)');
      
    } else {
      console.log('❌ Failed to update debtor flags');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixDebtorFlags();
