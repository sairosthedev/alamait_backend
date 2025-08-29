const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');
const Debtor = require('./src/models/Debtor');

async function testPaymentAllocationWithExistingDebtor() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 TESTING PAYMENT ALLOCATION WITH EXISTING DEBTOR\n');

    // 1. Check existing debtor
    console.log('📊 STEP 1: Checking Existing Debtor\n');
    
    const existingDebtors = await Debtor.find({});
    console.log(`Found ${existingDebtors.length} debtors`);

    if (existingDebtors.length === 0) {
      console.log('❌ No debtors found - cannot test payment allocation');
      return;
    }

    const debtor = existingDebtors[0];
    console.log(`Using debtor: ${debtor.debtorCode} (User ID: ${debtor.user})`);
    console.log(`Current Balance: $${debtor.currentBalance}`);
    console.log('');

    // 2. Test Smart FIFO allocation with existing debtor
    console.log('📊 STEP 2: Testing Smart FIFO Allocation\n');

    const testPaymentData = {
      paymentId: 'TEST-EXISTING-DEBTOR-001',
      studentId: debtor.user.toString(), // Use the existing debtor's user ID
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

    // 3. Check if any allocation transactions were created
    console.log('\n📊 STEP 3: Checking for Created Allocation Transactions\n');
    
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

    // 4. Check the balance sheet calculation after allocation
    console.log('\n📊 STEP 4: Testing Balance Sheet After Allocation\n');
    
    // Test current month AR calculation
    const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const monthAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      date: { $gte: monthStart, $lte: monthEnd },
      'entries.accountCode': { $regex: '^1100' }
    });

    const monthPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': currentMonth,
      'entries.accountCode': { $regex: '^1100' }
    });

    console.log(`📅 ${currentMonth} Analysis:`);
    console.log(`   Accruals: ${monthAccruals.length} transactions`);
    console.log(`   Payments: ${monthPayments.length} transactions`);
    
    let monthAR = 0;
    monthAccruals.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100')) {
          monthAR += Number(entry.debit || 0);
        }
      });
    });
    
    monthPayments.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100')) {
          monthAR -= Number(entry.credit || 0);
        }
      });
    });
    
    console.log(`   Calculated AR: $${monthAR}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testPaymentAllocationWithExistingDebtor();
