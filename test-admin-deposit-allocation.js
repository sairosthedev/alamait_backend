const mongoose = require('mongoose');
require('dotenv').config();

async function testAdminDepositAllocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const Payment = require('./src/models/Payment');
    
    console.log('\n🧪 TESTING ADMIN & DEPOSIT ALLOCATION FIX');
    console.log('==========================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // Create a real payment first
    const payment = new Payment({
      paymentId: "PAY-TEST-ADMIN-DEPOSIT-" + Date.now(),
      student: studentId,
      residence: "67d723cf20f89c4ae69804f3",
      totalAmount: 380,
      method: "Cash",
      date: new Date("2025-06-13"),
      description: "Test payment with admin and deposit",
      status: "Confirmed",
      createdBy: new mongoose.Types.ObjectId() // Use a valid ObjectId
    });
    
    const savedPayment = await payment.save();
    console.log(`✅ Created test payment with ID: ${savedPayment._id}`);
    
    // Test payment data similar to what frontend sends
    const testPaymentData = {
      paymentId: savedPayment._id.toString(),
      totalAmount: 380,
      studentId: studentId,
      studentName: "Macdonald Sairos",
      residenceId: "67d723cf20f89c4ae69804f3",
      paymentMonth: "2025-06",
      date: new Date("2025-06-13"),
      method: "Cash",
      description: "Test payment with admin and deposit",
      payments: [
        {type: "rent", amount: 180, monthAllocated: "2025-06"},
        {type: "admin", amount: 20},  // ❌ Missing monthAllocated
        {type: "deposit", amount: 180}  // ❌ Missing monthAllocated
      ]
    };
    
    console.log('\n📊 Test Payment Data:');
    console.log('=====================');
    console.log('Payment ID:', testPaymentData.paymentId);
    console.log('Total Amount:', testPaymentData.totalAmount);
    console.log('Student:', testPaymentData.studentName);
    console.log('Payments:', JSON.stringify(testPaymentData.payments, null, 2));
    
    // Test the Smart FIFO allocation
    console.log('\n🚀 Testing Smart FIFO Allocation:');
    console.log('==================================');
    
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
      }
      
      // Check if transactions were created
      console.log('\n🔍 Checking Created Transactions:');
      console.log('==================================');
      
      const TransactionEntry = require('./src/models/TransactionEntry');
      const createdTransactions = await TransactionEntry.find({
        'metadata.paymentId': testPaymentData.paymentId
      }).sort({ date: 1 });
      
      console.log(`Found ${createdTransactions.length} transactions for test payment`);
      
      createdTransactions.forEach((tx, index) => {
        console.log(`\n${index + 1}. ${tx.description}`);
        console.log(`   Date: ${tx.date.toISOString().split('T')[0]}`);
        console.log(`   Source: ${tx.source}`);
        console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'N/A'}`);
        console.log(`   Payment Type: ${tx.metadata?.paymentType || 'N/A'}`);
        console.log(`   Total: $${tx.totalDebit} / $${tx.totalCredit}`);
        
        tx.entries.forEach((entry, entryIndex) => {
          console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`     Debit: $${entry.debit}, Credit: $${entry.credit}`);
        });
      });
      
    } catch (error) {
      console.error('❌ Error during allocation:', error.message);
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
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

testAdminDepositAllocation();
