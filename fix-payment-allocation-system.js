const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');

async function fixPaymentAllocationSystem() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 FIXING PAYMENT ALLOCATION SYSTEM\n');

    // 1. First, let's test the Smart FIFO allocation with a real payment
    console.log('📊 STEP 1: Testing Smart FIFO Allocation\n');

    const testPaymentData = {
      paymentId: 'TEST-FIX-001',
      studentId: '68aeaf7a8d70befd6ad29b18', // Use the student ID that has May accruals
      totalAmount: 380,
      payments: [
        { type: 'rent', amount: 180 },
        { type: 'admin', amount: 20 },
        { type: 'deposit', amount: 180 }
      ],
      residence: '67d723cf20f89c4ae69804f3',
      method: 'Cash',
      date: new Date('2025-08-27')
    };

    console.log('🎯 Testing Smart FIFO allocation with payment data:');
    console.log(JSON.stringify(testPaymentData, null, 2));
    console.log('');

    try {
      const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(testPaymentData);
      
      if (allocationResult.success) {
        console.log('✅ Smart FIFO allocation completed successfully!');
        console.log('📊 Allocation result:', JSON.stringify(allocationResult, null, 2));
      } else {
        console.log('❌ Smart FIFO allocation failed:', allocationResult.error);
        console.log('📋 Error details:', allocationResult.message);
      }
    } catch (allocationError) {
      console.log('❌ Error in Smart FIFO allocation:', allocationError.message);
      console.log('📋 Stack trace:', allocationError.stack);
    }

    // 2. Check if any allocation transactions were created
    console.log('\n📊 STEP 2: Checking for Created Allocation Transactions\n');
    
    const allocationTransactions = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /Payment allocation/ }
    }).sort({ date: 1 });

    console.log(`Found ${allocationTransactions.length} payment allocation transactions`);

    if (allocationTransactions.length > 0) {
      allocationTransactions.forEach((tx, index) => {
        console.log(`📋 Allocation Transaction ${index + 1}:`);
        console.log(`   Description: ${tx.description}`);
        console.log(`   Month Settled: ${tx.metadata?.monthSettled || 'NOT SET'}`);
        console.log(`   Amount: $${tx.totalDebit}`);
        console.log(`   Account Codes:`);
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            console.log(`     ${entry.accountCode}: ${entry.debit ? 'Debit' : 'Credit'} $${entry.debit || entry.credit}`);
          }
        });
        console.log('');
      });
    } else {
      console.log('❌ No allocation transactions created - system still not working');
    }

    // 3. Check the balance sheet calculation after allocation
    console.log('\n📊 STEP 3: Testing Balance Sheet After Allocation\n');
    
    // Test May 2025 AR calculation
    const mayStart = new Date('2025-05-01');
    const mayEnd = new Date('2025-05-31');
    
    const mayAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: mayStart, $lte: mayEnd },
      'entries.accountCode': { $regex: '^1100-' }
    });

    const mayPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-05',
      'entries.accountCode': { $regex: '^1100-' }
    });

    console.log(`📅 May 2025 Analysis:`);
    console.log(`   Accruals: ${mayAccruals.length} transactions`);
    console.log(`   Payments: ${mayPayments.length} transactions`);
    
    let mayAR = 0;
    mayAccruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          mayAR += Number(entry.debit || 0);
        }
      });
    });
    
    mayPayments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          mayAR -= Number(entry.credit || 0);
        }
      });
    });
    
    console.log(`   Calculated AR: $${mayAR}`);
    console.log(`   Expected AR: $0 (after payment allocation)`);
    console.log(`   Status: ${mayAR === 0 ? '✅ CORRECT' : '❌ INCORRECT'}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

fixPaymentAllocationSystem();
