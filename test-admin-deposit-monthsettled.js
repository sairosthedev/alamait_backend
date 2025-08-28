const mongoose = require('mongoose');
require('dotenv').config();

async function testAdminDepositMonthSettled() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    
    console.log('\n🧪 TESTING ADMIN/DEPOSIT MONTHSETTLED FIX');
    console.log('==========================================');
    
    // Test data for a new payment
    const testPaymentData = {
      paymentId: `TEST-${Date.now()}`,
      studentId: '68af5d953dbf8f2c7c41e5b6',
      totalAmount: 460,
      payments: [
        { type: 'rent', amount: 220, monthAllocated: null },
        { type: 'admin', amount: 20, monthAllocated: null },
        { type: 'deposit', amount: 220, monthAllocated: null }
      ],
      residence: 'default',
      studentName: 'Macdonald Sairos'
    };
    
    console.log('\n📋 TEST PAYMENT DATA:');
    console.log('=====================');
    console.log(`Payment ID: ${testPaymentData.paymentId}`);
    console.log(`Student: ${testPaymentData.studentId}`);
    console.log(`Total Amount: $${testPaymentData.totalAmount}`);
    console.log('Payments:');
    testPaymentData.payments.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.type}: $${p.amount} (monthAllocated: ${p.monthAllocated || 'null'})`);
    });
    
    console.log('\n🔍 EXPECTED BEHAVIOR:');
    console.log('=====================');
    console.log('1. Admin fee ($20) should have monthSettled = "2025-06" (first month)');
    console.log('2. Deposit ($220) should have monthSettled = "2025-06" (first month)');
    console.log('3. Rent ($220) should be allocated to June and July as needed');
    console.log('4. All transactions should have proper monthSettled values (not null)');
    
    console.log('\n🚀 TESTING PAYMENT ALLOCATION...');
    console.log('================================');
    
    // Test the allocation
    const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(testPaymentData);
    
    if (allocationResult.success) {
      console.log('✅ Payment allocation successful!');
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
      
      // Check if admin and deposit have correct monthSettled
      console.log('\n🔍 VERIFYING MONTHSETTLED VALUES:');
      console.log('==================================');
      
      const adminAllocation = allocationResult.allocation.monthlyBreakdown.find(m => m.paymentType === 'admin');
      const depositAllocation = allocationResult.allocation.monthlyBreakdown.find(m => m.paymentType === 'deposit');
      
      if (adminAllocation) {
        console.log(`✅ Admin fee allocation found:`);
        console.log(`   Month: ${adminAllocation.month} (should be 2025-06)`);
        console.log(`   Amount: $${adminAllocation.amountAllocated}`);
        console.log(`   Allocation Type: ${adminAllocation.allocationType}`);
      } else {
        console.log('❌ Admin fee allocation not found');
      }
      
      if (depositAllocation) {
        console.log(`✅ Deposit allocation found:`);
        console.log(`   Month: ${depositAllocation.month} (should be 2025-06)`);
        console.log(`   Amount: $${depositAllocation.amountAllocated}`);
        console.log(`   Allocation Type: ${depositAllocation.allocationType}`);
      } else {
        console.log('❌ Deposit allocation not found');
      }
      
      // Check the actual transaction entries
      console.log('\n🔍 CHECKING TRANSACTION ENTRIES:');
      console.log('=================================');
      
      const TransactionEntry = require('./src/models/TransactionEntry');
      const testTransactions = await TransactionEntry.find({
        'metadata.paymentId': testPaymentData.paymentId,
        status: 'posted'
      }).sort({ date: 1 });
      
      console.log(`Found ${testTransactions.length} test transactions:`);
      
      testTransactions.forEach((tx, index) => {
        console.log(`\n${index + 1}. ${tx.description}`);
        console.log(`   Payment Type: ${tx.metadata?.paymentType}`);
        console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
        console.log(`   Amount: $${tx.totalDebit}`);
        
        // Verify monthSettled is not null for admin and deposit
        if (tx.metadata?.paymentType === 'admin' || tx.metadata?.paymentType === 'deposit') {
          if (tx.metadata?.monthSettled) {
            console.log(`   ✅ ${tx.metadata.paymentType} has monthSettled: ${tx.metadata.monthSettled}`);
          } else {
            console.log(`   ❌ ${tx.metadata.paymentType} has NO monthSettled!`);
          }
        }
      });
      
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

testAdminDepositMonthSettled();
