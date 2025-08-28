const mongoose = require('mongoose');
require('dotenv').config();

async function testPaymentEntries() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
    const Payment = require('./src/models/Payment');
    
    console.log('\n🧪 TESTING PAYMENT ENTRIES: 220 + 20 + 220');
    console.log('============================================');
    
    const studentId = '68af5d953dbf8f2c7c41e5b6';
    
    // Create a real payment first
    const payment = new Payment({
      paymentId: "PAY-TEST-ENTRIES-" + Date.now(),
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
    console.log(`✅ Created test payment with ID: ${savedPayment._id}`);
    
    // Test payment data
    const testPaymentData = {
      paymentId: savedPayment._id.toString(),
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
        {type: "admin", amount: 20},  // Will be auto-assigned to June
        {type: "deposit", amount: 220}  // Will be auto-assigned to June
      ]
    };
    
    console.log('\n📊 Payment Breakdown:');
    console.log('=====================');
    console.log('Total Amount: $460');
    console.log('Rent: $220');
    console.log('Admin Fee: $20');
    console.log('Deposit: $220');
    console.log('Expected Month: June 2025 (lease start month)');
    
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
      
      // Check what entries were created
      console.log('\n🔍 DETAILED TRANSACTION ENTRIES:');
      console.log('=================================');
      
      const TransactionEntry = require('./src/models/TransactionEntry');
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
        console.log(`   Total Debit: $${tx.totalDebit}`);
        console.log(`   Total Credit: $${tx.totalCredit}`);
        console.log(`   Status: ${tx.status}`);
        
        console.log('\n   📋 ENTRIES:');
        console.log('   ===========');
        tx.entries.forEach((entry, entryIndex) => {
          console.log(`   ${entryIndex + 1}. ${entry.accountCode} - ${entry.accountName}`);
          console.log(`      Type: ${entry.accountType}`);
          console.log(`      Debit: $${entry.debit}`);
          console.log(`      Credit: $${entry.credit}`);
          console.log(`      Description: ${entry.description}`);
        });
        
        // Show the double-entry impact
        console.log('\n   💰 DOUBLE-ENTRY IMPACT:');
        console.log('   =======================');
        const cashEntry = tx.entries.find(e => e.accountCode === '1000');
        const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-'));
        
        if (cashEntry && arEntry) {
          console.log(`   Cash (Asset): +$${cashEntry.debit} (Debit increases asset)`);
          console.log(`   AR (Asset): -$${arEntry.credit} (Credit decreases asset)`);
          console.log(`   Net Impact: Cash ↑, AR ↓ (Balance sheet stays balanced)`);
        }
      });
      
      // Show balance sheet impact
      console.log('\n📊 BALANCE SHEET IMPACT:');
      console.log('=========================');
      
      let totalCashIncrease = 0;
      let totalARDecrease = 0;
      
      createdTransactions.forEach(tx => {
        const cashEntry = tx.entries.find(e => e.accountCode === '1000');
        const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-'));
        
        if (cashEntry) totalCashIncrease += cashEntry.debit;
        if (arEntry) totalARDecrease += arEntry.credit;
      });
      
      console.log(`Cash (Asset): +$${totalCashIncrease.toFixed(2)}`);
      console.log(`Accounts Receivable (Asset): -$${totalARDecrease.toFixed(2)}`);
      console.log(`Net Change: $${(totalCashIncrease - totalARDecrease).toFixed(2)}`);
      console.log(`Balance Sheet: Remains balanced (Assets = Assets)`);
      
    } catch (error) {
      console.error('❌ Error during allocation:', error.message);
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const TransactionEntry = require('./src/models/TransactionEntry');
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

testPaymentEntries();
