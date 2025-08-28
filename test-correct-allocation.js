const mongoose = require('mongoose');
require('dotenv').config();

async function testCorrectAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const Payment = require('./src/models/Payment');
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6'; // Macdonald Sairos
    
    console.log('\n🧪 TESTING CORRECT PAYMENT ALLOCATION');
    console.log('=======================================');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Create a proper Payment record first
    console.log('\n📝 CREATING PAYMENT RECORD:');
    console.log('============================');
    
    const payment = new Payment({
      paymentId: "PAY-TEST-CORRECT-" + Date.now(),
      student: studentId,
      residence: "67d723cf20f89c4ae69804f3",
      totalAmount: 460, // 220 + 20 + 220
      method: "Cash",
      date: new Date("2025-06-13"),
      description: "Test payment: 220 rent + 20 admin + 220 deposit",
      status: "Confirmed",
      createdBy: new mongoose.Types.ObjectId()
    });
    
    const savedPayment = await payment.save();
    console.log(`✅ Created payment with ID: ${savedPayment._id}`);
    
    // 2. Test payment allocation with proper payment ID
    console.log('\n🚀 TESTING PAYMENT ALLOCATION:');
    console.log('===============================');
    
    const testPaymentData = {
      paymentId: savedPayment._id.toString(), // Use the actual ObjectId
      totalAmount: 460,
      studentId: studentId,
      studentName: "Macdonald Sairos",
      residenceId: "67d723cf20f89c4ae69804f3",
      paymentMonth: "2025-06",
      date: new Date("2025-06-13"),
      method: "Cash",
      description: "Test payment: 220 rent + 20 admin + 220 deposit",
      payments: [
        {type: "rent", amount: 220, monthAllocated: "2025-06"},
        {type: "admin", amount: 20},  // Should settle June admin fee
        {type: "deposit", amount: 220}  // Should settle June deposit
      ]
    };
    
    console.log('Test Payment Data:', JSON.stringify(testPaymentData, null, 2));
    
    try {
      const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(testPaymentData);
      
      console.log('\n✅ Allocation Result:');
      console.log('=====================');
      console.log('Success:', allocationResult.success);
      console.log('Message:', allocationResult.message);
      
      if (allocationResult.success && allocationResult.allocation) {
        console.log('\n📊 Allocation Breakdown:');
        console.log('========================');
        
        allocationResult.allocation.monthlyBreakdown.forEach((allocation, index) => {
          console.log(`\n${index + 1}. ${allocation.month} (${allocation.monthName}):`);
          console.log(`   Payment Type: ${allocation.paymentType}`);
          console.log(`   Amount Allocated: $${allocation.amountAllocated.toFixed(2)}`);
          console.log(`   Original Outstanding: $${allocation.originalOutstanding.toFixed(2)}`);
          console.log(`   New Outstanding: $${allocation.newOutstanding.toFixed(2)}`);
          console.log(`   Allocation Type: ${allocation.allocationType}`);
        });
        
        console.log('\n📈 Summary:');
        console.log('===========');
        console.log('Total Allocated:', allocationResult.allocation.summary.totalAllocated);
        console.log('Remaining Balance:', allocationResult.allocation.summary.remainingBalance);
        console.log('Months Covered:', allocationResult.allocation.summary.monthsCovered);
        console.log('Allocation Method:', allocationResult.allocation.summary.allocationMethod);
        
        // 3. Check what entries were created
        console.log('\n🔍 CHECKING CREATED ENTRIES:');
        console.log('============================');
        
        const createdTransactions = await TransactionEntry.find({
          'metadata.paymentId': testPaymentData.paymentId
        }).sort({ date: 1 });
        
        console.log(`Found ${createdTransactions.length} transactions for this payment`);
        
        createdTransactions.forEach((tx, index) => {
          console.log(`\n${index + 1}. ${tx.description}`);
          console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
          console.log(`   Source: ${tx.source}`);
          console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
          console.log(`   Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
          console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
          
          console.log('\n   📋 ENTRIES:');
          tx.entries.forEach((entry, entryIndex) => {
            console.log(`   ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
            console.log(`      Debit: $${entry.debit}, Credit: $${entry.credit}`);
            console.log(`      Description: ${entry.description}`);
          });
        });
        
        // 4. Verify the allocation is correct
        console.log('\n🎯 VERIFICATION:');
        console.log('=================');
        
        const adminAllocation = allocationResult.allocation.monthlyBreakdown.find(a => a.paymentType === 'admin');
        const depositAllocation = allocationResult.allocation.monthlyBreakdown.find(a => a.paymentType === 'deposit');
        
        if (adminAllocation) {
          console.log(`✅ Admin fee allocated: $${adminAllocation.amountAllocated} to ${adminAllocation.month}`);
        } else {
          console.log(`❌ Admin fee not allocated`);
        }
        
        if (depositAllocation) {
          console.log(`✅ Deposit allocated: $${depositAllocation.amountAllocated} to ${depositAllocation.month}`);
        } else {
          console.log(`❌ Deposit not allocated`);
        }
        
        // Check if deposit was treated as advance
        const advanceAllocation = allocationResult.allocation.monthlyBreakdown.find(a => a.allocationType === 'advance_payment');
        if (advanceAllocation) {
          console.log(`❌ PROBLEM: ${advanceAllocation.paymentType} treated as advance payment`);
        } else {
          console.log(`✅ No advance payments created (good)`);
        }
        
      }
      
    } catch (error) {
      console.error('❌ Error during allocation:', error.message);
    }
    
    // 5. Clean up test data
    console.log('\n🧹 CLEANING UP TEST DATA:');
    console.log('==========================');
    
    await TransactionEntry.deleteMany({
      'metadata.paymentId': testPaymentData.paymentId
    });
    await Payment.findByIdAndDelete(savedPayment._id);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testCorrectAllocation();
