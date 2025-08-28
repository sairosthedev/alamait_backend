const mongoose = require('mongoose');
require('dotenv').config();

async function debugNewPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const Debtor = require('./src/models/Debtor');
    
    console.log('\n🔍 DEBUGGING NEW PAYMENT ALLOCATION');
    console.log('====================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // Check debtor status
    console.log('\n🔍 CHECKING DEBTOR STATUS:');
    console.log('==========================');
    
    const debtor = await Debtor.findOne({ user: studentId });
    if (debtor) {
      console.log(`   Admin Fee Paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
      console.log(`   Deposit Paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
      console.log(`   Deferred Income: $${debtor.deferredIncome?.totalAmount || 0}`);
    } else {
      console.log('   ❌ No debtor record found');
    }
    
    // Check outstanding balances
    console.log('\n🔍 CHECKING OUTSTANDING BALANCES:');
    console.log('==================================');
    
    const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
    
    console.log(`   Found ${outstandingBalances.length} months with outstanding balances:`);
    
    outstandingBalances.forEach((month, index) => {
      console.log(`   ${index + 1}. ${month.monthKey} (${month.monthName}):`);
      console.log(`      Rent: $${month.rent.outstanding} (owed: $${month.rent.owed}, paid: $${month.rent.paid})`);
      console.log(`      Admin Fee: $${month.adminFee.outstanding} (owed: $${month.adminFee.owed}, paid: $${month.adminFee.paid})`);
      console.log(`      Deposit: $${month.deposit.outstanding} (owed: $${month.deposit.owed}, paid: $${month.deposit.paid})`);
      console.log(`      Total Outstanding: $${month.totalOutstanding}`);
    });
    
    // Test with the new payment data
    console.log('\n🚀 TESTING NEW PAYMENT ALLOCATION:');
    console.log('==================================');
    
    const testPaymentData = {
      paymentId: 'PAY-1756338328369',
      studentId: studentId,
      totalAmount: 460,
      payments: [
        { type: 'rent', amount: 220 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 220 }
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
      });
      
      // Check if admin fee is missing
      const adminAllocation = allocationResult.allocation.monthlyBreakdown.find(m => m.paymentType === 'admin');
      const rentAllocation = allocationResult.allocation.monthlyBreakdown.filter(m => m.paymentType === 'rent');
      const depositAllocation = allocationResult.allocation.monthlyBreakdown.find(m => m.paymentType === 'deposit');
      
      console.log('\n🔍 ALLOCATION ANALYSIS:');
      console.log('=======================');
      
      if (adminAllocation) {
        console.log(`✅ Admin fee allocation found:`);
        console.log(`   Month: ${adminAllocation.month}`);
        console.log(`   Amount: $${adminAllocation.amountAllocated}`);
        console.log(`   Allocation Type: ${adminAllocation.allocationType}`);
      } else {
        console.log('❌ Admin fee allocation MISSING!');
        console.log('   Expected: $20 admin fee should be allocated to June 2025');
      }
      
      console.log(`\n📊 Rent allocations: ${rentAllocation.length}`);
      rentAllocation.forEach((rent, index) => {
        console.log(`   ${index + 1}. ${rent.monthName}: $${rent.amountAllocated}`);
      });
      
      if (depositAllocation) {
        console.log(`\n✅ Deposit allocation found:`);
        console.log(`   Month: ${depositAllocation.month}`);
        console.log(`   Amount: $${depositAllocation.amountAllocated}`);
        console.log(`   Allocation Type: ${depositAllocation.allocationType}`);
      } else {
        console.log('\n❌ Deposit allocation missing!');
      }
      
      // Check what's missing
      const totalAllocated = allocationResult.allocation.monthlyBreakdown.reduce((sum, m) => sum + m.amountAllocated, 0);
      const expectedTotal = 460;
      
      console.log('\n🔍 MISSING AMOUNT ANALYSIS:');
      console.log('===========================');
      console.log(`Expected Total: $${expectedTotal}`);
      console.log(`Total Allocated: $${totalAllocated}`);
      console.log(`Missing Amount: $${expectedTotal - totalAllocated}`);
      
      if (expectedTotal - totalAllocated > 0) {
        console.log('\n❌ ISSUE FOUND:');
        console.log('===============');
        console.log(`Missing $${expectedTotal - totalAllocated} in allocation`);
        console.log('This should be the admin fee payment!');
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

debugNewPayment();
