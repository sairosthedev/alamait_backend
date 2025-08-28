const mongoose = require('mongoose');
require('dotenv').config();

async function testAugustOverpayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    console.log('\n🔍 TESTING AUGUST OVERPAYMENT SCENARIO');
    console.log('========================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // Check current outstanding balances
    console.log('\n📊 CURRENT OUTSTANDING BALANCES:');
    console.log('================================');
    
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    outstandingBalances.forEach((month, index) => {
      console.log(`${index + 1}. ${month.monthKey} (${month.monthName}):`);
      console.log(`   Rent: $${month.rent.outstanding} (owed: $${month.rent.owed}, paid: $${month.rent.paid})`);
      console.log(`   Admin Fee: $${month.adminFee.outstanding} (owed: $${month.adminFee.owed}, paid: $${month.adminFee.paid})`);
      console.log(`   Deposit: $${month.deposit.outstanding} (owed: $${month.deposit.owed}, paid: $${month.deposit.paid})`);
      console.log(`   Total Outstanding: $${month.totalOutstanding}`);
    });
    
    // Test payment scenario: August owing $36, but pay $220
    console.log('\n🚀 TESTING PAYMENT SCENARIO:');
    console.log('============================');
    console.log('August 2025:');
    console.log('  - Outstanding: $36.67');
    console.log('  - Payment: $220');
    console.log('  - Overpayment: $183.33');
    console.log('');
    console.log('Expected behavior:');
    console.log('1. $36.67 should settle August rent');
    console.log('2. $183.33 should become advance payment for future months');
    console.log('3. Total allocated: $220');
    console.log('4. Remaining balance: $0');
    
    const testPaymentData = {
      paymentId: 'PAY-AUGUST-OVERPAYMENT-TEST',
      studentId: studentId,
      totalAmount: 220,
      payments: [
        { type: 'rent', amount: 220 }
      ],
      residence: '67d723cf20f89c4ae69804f3',
      studentName: 'Macdonald Sairos'
    };
    
    console.log('\n📋 PAYMENT DATA:');
    console.log('================');
    console.log(`Payment ID: ${testPaymentData.paymentId}`);
    console.log(`Student: ${testPaymentData.studentId}`);
    console.log(`Total Amount: $${testPaymentData.totalAmount}`);
    console.log('Payments:');
    testPaymentData.payments.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.type}: $${p.amount}`);
    });
    
    // Test the allocation
    const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(testPaymentData);
    
    if (allocationResult.success) {
      console.log('\n✅ Payment allocation successful!');
      console.log('\n📊 ALLOCATION RESULTS:');
      console.log('======================');
      console.log(`Total Allocated: $${allocationResult.allocation.summary.totalAllocated}`);
      console.log(`Remaining Balance: $${allocationResult.allocation.summary.remainingBalance}`);
      console.log(`Months Covered: ${allocationResult.allocation.summary.monthsCovered}`);
      console.log(`Advance Payment Amount: $${allocationResult.allocation.summary.advancePaymentAmount}`);
      
      console.log('\n📋 MONTHLY BREAKDOWN:');
      console.log('=====================');
      allocationResult.allocation.monthlyBreakdown.forEach((month, index) => {
        console.log(`\n${index + 1}. ${month.monthName} (${month.month}):`);
        console.log(`   Payment Type: ${month.paymentType}`);
        console.log(`   Amount Allocated: $${month.amountAllocated}`);
        console.log(`   Original Outstanding: $${month.originalOutstanding}`);
        console.log(`   New Outstanding: $${month.newOutstanding}`);
        console.log(`   Allocation Type: ${month.allocationType}`);
        
        if (month.advanceDetails) {
          console.log(`   Advance Details: ${month.advanceDetails.description}`);
        }
      });
      
      // Analyze the results
      console.log('\n🔍 ANALYSIS:');
      console.log('============');
      
      const rentSettlements = allocationResult.allocation.monthlyBreakdown.filter(m => m.allocationType === 'rent_settlement');
      const advancePayments = allocationResult.allocation.monthlyBreakdown.filter(m => m.allocationType === 'advance_payment');
      
      console.log(`📊 Rent Settlements: ${rentSettlements.length}`);
      rentSettlements.forEach((settlement, index) => {
        console.log(`   ${index + 1}. ${settlement.monthName}: $${settlement.amountAllocated}`);
      });
      
      console.log(`📊 Advance Payments: ${advancePayments.length}`);
      advancePayments.forEach((advance, index) => {
        console.log(`   ${index + 1}. ${advance.advanceDetails.type}: $${advance.amountAllocated}`);
        console.log(`      Description: ${advance.advanceDetails.description}`);
      });
      
      // Check if the behavior is correct
      const totalSettled = rentSettlements.reduce((sum, m) => sum + m.amountAllocated, 0);
      const totalAdvance = advancePayments.reduce((sum, m) => sum + m.amountAllocated, 0);
      
      console.log('\n✅ VERIFICATION:');
      console.log('================');
      console.log(`Expected August settlement: $36.67`);
      console.log(`Actual August settlement: $${totalSettled}`);
      console.log(`Expected advance payment: $183.33`);
      console.log(`Actual advance payment: $${totalAdvance}`);
      console.log(`Total allocated: $${totalSettled + totalAdvance}`);
      
      if (Math.abs(totalSettled - 36.67) < 0.01) {
        console.log('✅ August rent settlement: CORRECT');
      } else {
        console.log('❌ August rent settlement: INCORRECT');
      }
      
      if (Math.abs(totalAdvance - 183.33) < 0.01) {
        console.log('✅ Advance payment: CORRECT');
      } else {
        console.log('❌ Advance payment: INCORRECT');
      }
      
      if (Math.abs((totalSettled + totalAdvance) - 220) < 0.01) {
        console.log('✅ Total allocation: CORRECT');
      } else {
        console.log('❌ Total allocation: INCORRECT');
      }
      
    } else {
      console.log('❌ Payment allocation failed:', allocationResult.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testAugustOverpayment();
