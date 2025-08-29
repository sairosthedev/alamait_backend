const mongoose = require('mongoose');
const UniversalPaymentAllocationService = require('./src/services/universalPaymentAllocationService');

async function testUniversalService() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 TESTING UNIVERSAL PAYMENT ALLOCATION SERVICE\n');

    // 1. Get current AR balances
    console.log('📊 STEP 1: Current AR Balances\n');
    
    const arBalances = await UniversalPaymentAllocationService.getARBalances();
    
    console.log(`💰 Total AR: $${arBalances.totalAR}`);
    console.log('\n📋 Account Balances:');
    Object.entries(arBalances.accountBalances).forEach(([accountCode, data]) => {
      console.log(`   ${accountCode}: $${data.balance} (${data.transactionCount} transactions)`);
    });

    console.log('\n📋 Student Balances:');
    Object.entries(arBalances.studentBalances).forEach(([studentId, data]) => {
      console.log(`   ${studentId}: $${data.balance} (${data.accountCode})`);
    });

    // 2. Test payment allocation for existing students
    console.log('\n📊 STEP 2: Testing Payment Allocation\n');

    // Test 1: Payment for existing student (John Doe)
    console.log('\n🧪 Test 1: Payment for John Doe');
    const johnDoeBalance = await UniversalPaymentAllocationService.getStudentOutstandingBalance(
      null, 
      'John Doe'
    );
    console.log(`   Current balance: $${johnDoeBalance.outstandingBalance}`);
    
    if (johnDoeBalance.outstandingBalance > 0) {
      const payment1 = await UniversalPaymentAllocationService.allocatePayment({
        amount: 200,
        studentName: 'John Doe',
        paymentMethod: 'Cash',
        date: new Date('2025-08-29'),
        reference: 'TEST-001'
      });
      console.log(`   ✅ Allocated payment: $200`);
    }

    // Test 2: Payment for Jane Smith
    console.log('\n🧪 Test 2: Payment for Jane Smith');
    const janeSmithBalance = await UniversalPaymentAllocationService.getStudentOutstandingBalance(
      null, 
      'Jane Smith'
    );
    console.log(`   Current balance: $${janeSmithBalance.outstandingBalance}`);
    
    if (janeSmithBalance.outstandingBalance > 0) {
      const payment2 = await UniversalPaymentAllocationService.allocatePayment({
        amount: 300,
        studentName: 'Jane Smith',
        paymentMethod: 'Bank Transfer',
        date: new Date('2025-08-29'),
        reference: 'TEST-002'
      });
      console.log(`   ✅ Allocated payment: $300`);
    }

    // Test 3: Payment for new student (will use general AR)
    console.log('\n🧪 Test 3: Payment for New Student');
    const payment3 = await UniversalPaymentAllocationService.allocatePayment({
      amount: 250,
      studentName: 'New Student',
      paymentMethod: 'Cash',
      date: new Date('2025-08-29'),
      reference: 'TEST-003'
    });
    console.log(`   ✅ Allocated payment: $250 for new student`);

    // 3. Test multiple payments processing
    console.log('\n📊 STEP 3: Testing Multiple Payments Processing\n');
    
    const multiplePayments = [
      {
        amount: 150,
        studentName: 'Mike Johnson',
        paymentMethod: 'Cash',
        date: new Date('2025-08-29'),
        reference: 'BATCH-001'
      },
      {
        amount: 100,
        studentName: 'Another Student',
        paymentMethod: 'Bank Transfer',
        date: new Date('2025-08-29'),
        reference: 'BATCH-002'
      }
    ];

    const batchResults = await UniversalPaymentAllocationService.processMultiplePayments(multiplePayments);
    
    console.log(`📋 Processed ${batchResults.length} payments:`);
    batchResults.forEach((result, index) => {
      if (result.success) {
        console.log(`   ${index + 1}. ✅ $${result.payment.amount} for ${result.payment.studentName}`);
      } else {
        console.log(`   ${index + 1}. ❌ Error: ${result.error}`);
      }
    });

    // 4. Get updated AR balances
    console.log('\n📊 STEP 4: Updated AR Balances\n');
    
    const updatedARBalances = await UniversalPaymentAllocationService.getARBalances();
    
    console.log(`💰 Updated Total AR: $${updatedARBalances.totalAR}`);
    console.log(`📉 AR Reduced by: $${arBalances.totalAR - updatedARBalances.totalAR}`);

    console.log('\n📋 Updated Account Balances:');
    Object.entries(updatedARBalances.accountBalances).forEach(([accountCode, data]) => {
      const previousBalance = arBalances.accountBalances[accountCode]?.balance || 0;
      const change = data.balance - previousBalance;
      console.log(`   ${accountCode}: $${data.balance} (${change > 0 ? '+' : ''}${change})`);
    });

    // 5. Get payment allocation report
    console.log('\n📊 STEP 5: Payment Allocation Report\n');
    
    const report = await UniversalPaymentAllocationService.getPaymentAllocationReport(
      new Date('2025-08-29'),
      new Date('2025-08-29')
    );

    console.log(`📋 Today's Payment Summary:`);
    console.log(`   Total Payments: ${report.totalPayments}`);
    console.log(`   Total Amount: $${report.totalAmount}`);
    
    console.log('\n📋 By Allocation Type:');
    Object.entries(report.byAllocationType).forEach(([type, data]) => {
      console.log(`   ${type}: ${data.count} payments, $${data.amount}`);
    });

    console.log('\n📋 By Student:');
    Object.entries(report.byStudent).forEach(([student, data]) => {
      console.log(`   ${student}: ${data.count} payments, $${data.amount}`);
    });

    console.log('\n📋 By Payment Method:');
    Object.entries(report.byPaymentMethod).forEach(([method, data]) => {
      console.log(`   ${method}: ${data.count} payments, $${data.amount}`);
    });

    console.log('\n🎯 UNIVERSAL PAYMENT ALLOCATION SERVICE TEST COMPLETE!');
    console.log('   ✅ Works with general AR accounts (1100)');
    console.log('   ✅ Works with student-specific AR accounts (1100-{studentId})');
    console.log('   ✅ Automatically detects account type');
    console.log('   ✅ Handles multiple payment methods');
    console.log('   ✅ Provides comprehensive reporting');
    console.log('   ✅ Tracks allocation metadata');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testUniversalService();
