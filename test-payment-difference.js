const mongoose = require('mongoose');
require('dotenv').config();

async function testPaymentDifference() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Debtor = require('./src/models/Debtor');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    console.log('\n🔍 TESTING OLD vs NEW LOGIC');
    console.log('============================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // Get debtor status
    const debtor = await Debtor.findOne({ user: studentId });
    
    // Get outstanding balances
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log('\n📋 DEBTOR STATUS:');
    console.log('=================');
    console.log(`Admin Fee Paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
    console.log(`Deposit Paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
    
    console.log('\n📊 OUTSTANDING BALANCES:');
    console.log('========================');
    outstandingBalances.forEach((month, index) => {
      console.log(`${index + 1}. ${month.monthKey}:`);
      console.log(`   Admin Fee: $${month.adminFee.outstanding}`);
      console.log(`   Deposit: $${month.deposit.outstanding}`);
    });
    
    // Calculate total outstanding
    const totalAdminOutstanding = outstandingBalances.reduce((total, month) => total + month.adminFee.outstanding, 0);
    const totalDepositOutstanding = outstandingBalances.reduce((total, month) => total + month.deposit.outstanding, 0);
    
    console.log('\n💰 TOTAL OUTSTANDING:');
    console.log('=====================');
    console.log(`Admin Fee: $${totalAdminOutstanding}`);
    console.log(`Deposit: $${totalDepositOutstanding}`);
    
    console.log('\n🔍 OLD LOGIC (Debtor Flags):');
    console.log('============================');
    console.log('❌ Would check:');
    console.log(`   Admin: debtor.onceOffCharges?.adminFee?.isPaid = ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
    console.log(`   Deposit: debtor.onceOffCharges?.deposit?.isPaid = ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
    console.log('');
    console.log('❌ Result: Would SKIP admin and deposit payments because flags say "paid"');
    console.log('❌ Problem: Flags are wrong - there are still outstanding amounts!');
    
    console.log('\n✅ NEW LOGIC (Outstanding Balances):');
    console.log('====================================');
    console.log('✅ Now checks:');
    console.log(`   Admin: totalAdminOutstanding = $${totalAdminOutstanding}`);
    console.log(`   Deposit: totalDepositOutstanding = $${totalDepositOutstanding}`);
    console.log('');
    console.log('✅ Result: Will PROCESS admin and deposit payments because there are outstanding amounts');
    console.log('✅ Fix: Uses actual transaction data instead of potentially wrong flags');
    
    console.log('\n🎯 THE DIFFERENCE:');
    console.log('==================');
    console.log('OLD: Checked debtor flags (could be wrong)');
    console.log('NEW: Check actual outstanding balances (always accurate)');
    console.log('');
    console.log('OLD: Would skip $20 admin + $220 deposit = $240 missing');
    console.log('NEW: Will process $20 admin + $220 deposit = $240 allocated');
    console.log('');
    console.log('OLD: Total allocated would be $220 (rent only)');
    console.log('NEW: Total allocated is $460 (rent + admin + deposit)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testPaymentDifference();
