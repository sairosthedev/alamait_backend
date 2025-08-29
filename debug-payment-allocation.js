/**
 * Debug Payment Allocation System
 * 
 * This script helps debug the payment allocation system by testing
 * the key components and showing what's happening.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function debugPaymentAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const Payment = require('./src/models/Payment');
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    console.log('\n🔍 DEBUGGING PAYMENT ALLOCATION');
    console.log('================================');
    
    // Get the most recent payment
    const payments = await Payment.find().sort({ createdAt: -1 }).limit(1);
    
    if (payments.length === 0) {
      console.log('❌ No payments found');
      return;
    }
    
    const payment = payments[0];
    console.log(`\n📋 PAYMENT DETAILS:`);
    console.log(`   Payment ID: ${payment.paymentId}`);
    console.log(`   Total Amount: $${payment.totalAmount}`);
    console.log(`   Student: ${payment.student}`);
    console.log(`   Date: ${payment.date.toISOString().split('T')[0]}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Allocation: ${payment.allocation ? 'Has allocation' : 'No allocation'}`);
    
    // Check the payments array
    console.log(`\n📋 PAYMENTS ARRAY:`);
    if (payment.payments && Array.isArray(payment.payments)) {
      payment.payments.forEach((p, index) => {
        console.log(`   ${index + 1}. Type: ${p.type}, Amount: $${p.amount}, Month Allocated: ${p.monthAllocated || 'Not set'}`);
      });
    } else {
      console.log('   ❌ No payments array found');
    }
    
    // Check what the allocation should do
    console.log(`\n🔍 EXPECTED ALLOCATION FOR $${payment.totalAmount}:`);
    console.log('===============================================');
    
    if (payment.totalAmount === 460) {
      console.log('Expected breakdown:');
      console.log('  - Rent: $220 (should be allocated to June/July)');
      console.log('  - Admin Fee: $20 (should be allocated to June)');
      console.log('  - Deposit: $220 (should be allocated to June)');
      console.log('');
      console.log('Expected transactions:');
      console.log('  1. Rent payment transaction');
      console.log('  2. Admin fee payment transaction');
      console.log('  3. Deposit payment transaction');
    }
    
    // Check debtor status
    console.log(`\n🔍 DEBTOR STATUS:`);
    console.log('=================');
    
    try {
      const debtor = await EnhancedPaymentAllocationService.getDebtorStatus(payment.student);
      if (debtor) {
        console.log(`   Admin Fee Paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
        console.log(`   Deposit Paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
        console.log(`   Deferred Income: $${debtor.deferredIncome?.totalAmount || 0}`);
      } else {
        console.log('   ❌ No debtor record found');
      }
    } catch (error) {
      console.log(`   ❌ Error getting debtor status: ${error.message}`);
    }
    
    // Check outstanding balances
    console.log(`\n🔍 OUTSTANDING BALANCES:`);
    console.log('=======================');
    
    try {
      const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(payment.student);
      console.log(`   Found ${outstandingBalances.length} months with outstanding balances:`);
      
      outstandingBalances.forEach((month, index) => {
        console.log(`   ${index + 1}. ${month.monthKey} (${month.monthName}):`);
        console.log(`      Rent: $${month.rent.outstanding} (owed: $${month.rent.owed}, paid: $${month.rent.paid})`);
        console.log(`      Admin Fee: $${month.adminFee.outstanding} (owed: $${month.adminFee.owed}, paid: $${month.adminFee.paid})`);
        console.log(`      Deposit: $${month.deposit.outstanding} (owed: $${month.deposit.owed}, paid: $${month.deposit.paid})`);
        console.log(`      Total Outstanding: $${month.totalOutstanding}`);
      });
    } catch (error) {
      console.log(`   ❌ Error getting outstanding balances: ${error.message}`);
    }
    
    // Check what allocation was actually performed
    console.log(`\n🔍 ACTUAL ALLOCATION PERFORMED:`);
    console.log('================================');
    
    if (payment.allocation && payment.allocation.monthlyBreakdown) {
      console.log(`   Allocation Method: ${payment.allocation.summary?.allocationMethod || 'Unknown'}`);
      console.log(`   Total Allocated: $${payment.allocation.summary?.totalAllocated || 0}`);
      console.log(`   Remaining Balance: $${payment.allocation.summary?.remainingBalance || 0}`);
      console.log(`   Months Covered: ${payment.allocation.summary?.monthsCovered || 0}`);
      console.log(`   Advance Payment Amount: $${payment.allocation.summary?.advancePaymentAmount || 0}`);
      
      console.log(`\n   Monthly Breakdown:`);
      payment.allocation.monthlyBreakdown.forEach((month, index) => {
        console.log(`   ${index + 1}. ${month.monthName} (${month.month}):`);
        console.log(`      Payment Type: ${month.paymentType}`);
        console.log(`      Amount Allocated: $${month.amountAllocated}`);
        console.log(`      Original Outstanding: $${month.originalOutstanding}`);
        console.log(`      New Outstanding: $${month.newOutstanding}`);
        console.log(`      Allocation Type: ${month.allocationType}`);
      });
    } else {
      console.log('   ❌ No allocation breakdown found');
    }
    
    console.log('\n💡 ANALYSIS:');
    console.log('=============');
    console.log('The payment allocation should process:');
    console.log('1. Rent portions (monthly accruals)');
    console.log('2. Admin fee portions (once-off charges)');
    console.log('3. Deposit portions (once-off charges)');
    console.log('');
    console.log('If only rent is being allocated, the issue might be:');
    console.log('1. Admin fee and deposit are already marked as paid in debtor record');
    console.log('2. The payment allocation logic is not finding outstanding admin/deposit charges');
    console.log('3. The payments array is not properly structured');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

debugPaymentAllocation();

