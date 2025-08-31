const mongoose = require('mongoose');
require('dotenv').config();

async function testDebtorTransactionSync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Debtor = require('./src/models/Debtor');
    
    console.log('🧪 Testing Debtor Transaction Sync Service...\n');
    
    // Test 1: Sync all existing transactions to debtors
    console.log('📊 STEP 1: Syncing all existing transactions to debtors...');
    const syncResult = await DebtorTransactionSyncService.syncAllTransactionsToDebtors();
    
    if (syncResult.success) {
      console.log('✅ Sync completed successfully!');
      console.log(`   Accruals processed: ${syncResult.accrualsProcessed}`);
      console.log(`   Payments processed: ${syncResult.paymentsProcessed}`);
      console.log(`   Total processed: ${syncResult.totalProcessed}`);
    } else {
      console.error('❌ Sync failed:', syncResult.error);
    }
    
    // Test 2: Check debtor status after sync
    console.log('\n📊 STEP 2: Checking debtor status after sync...');
    const debtors = await Debtor.find({}).limit(5);
    
    debtors.forEach((debtor, index) => {
      console.log(`\n${index + 1}. Debtor: ${debtor.debtorCode}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Total Paid: $${debtor.totalPaid}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      console.log(`   Status: ${debtor.status}`);
      console.log(`   Monthly Payments: ${debtor.monthlyPayments.length}`);
      
      if (debtor.monthlyPayments.length > 0) {
        const latestMonth = debtor.monthlyPayments[debtor.monthlyPayments.length - 1];
        console.log(`   Latest Month: ${latestMonth.month}`);
        console.log(`   Expected: $${latestMonth.expectedAmount}`);
        console.log(`   Paid: $${latestMonth.paidAmount}`);
        console.log(`   Outstanding: $${latestMonth.outstandingAmount}`);
        console.log(`   Status: ${latestMonth.status}`);
      }
    });
    
    // Test 3: Check transaction entries
    console.log('\n📊 STEP 3: Checking transaction entries...');
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      'metadata.type': 'monthly_rent_accrual'
    }).limit(3);
    
    console.log(`Found ${accrualTransactions.length} accrual transactions`);
    accrualTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction: ${tx.transactionId}`);
      console.log(`   Student ID: ${tx.metadata.studentId}`);
      console.log(`   Amount: $${tx.totalDebit}`);
      console.log(`   Month: ${tx.metadata.accrualMonth}/${tx.metadata.accrualYear}`);
      console.log(`   Date: ${tx.date}`);
    });
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.allocationType': 'payment_allocation'
    }).limit(3);
    
    console.log(`\nFound ${paymentTransactions.length} payment transactions`);
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction: ${tx.transactionId}`);
      console.log(`   Student ID: ${tx.metadata.studentId}`);
      console.log(`   Amount: $${tx.totalCredit}`);
      console.log(`   Month Settled: ${tx.metadata.monthSettled}`);
      console.log(`   Payment Type: ${tx.metadata.paymentType}`);
      console.log(`   Date: ${tx.date}`);
    });
    
    // Test 4: Test individual debtor update methods
    console.log('\n📊 STEP 4: Testing individual update methods...');
    if (debtors.length > 0) {
      const testDebtor = debtors[0];
      const testStudentId = testDebtor.user;
      
      console.log(`Testing with debtor: ${testDebtor.debtorCode}`);
      
      // Test accrual update
      const testAccrualData = {
        studentName: 'Test Student',
        residence: testDebtor.residence,
        room: testDebtor.roomNumber,
        accrualMonth: 12,
        accrualYear: 2025,
        type: 'monthly_rent_accrual',
        transactionId: 'TEST-ACCRUAL-001'
      };
      
      const accrualResult = await DebtorTransactionSyncService.updateDebtorFromAccrual(
        null, // No transaction entry for test
        testStudentId,
        180, // $180 test accrual
        '2025-12',
        testAccrualData
      );
      
      if (accrualResult.success) {
        console.log('✅ Test accrual update successful');
        console.log(`   New Total Owed: $${accrualResult.totalOwed}`);
        console.log(`   New Balance: $${accrualResult.currentBalance}`);
      } else {
        console.error('❌ Test accrual update failed:', accrualResult.error);
      }
      
      // Test payment update
      const testPaymentData = {
        paymentId: 'TEST-PAYMENT-001',
        studentId: testStudentId,
        amount: 90, // $90 test payment
        paymentType: 'rent',
        monthSettled: '2025-12',
        allocationType: 'payment_allocation',
        description: 'Test payment allocation',
        transactionId: 'TEST-TXN-001'
      };
      
      const paymentResult = await DebtorTransactionSyncService.updateDebtorFromPayment(
        null, // No transaction entry for test
        testStudentId,
        90, // $90 test payment
        '2025-12',
        testPaymentData
      );
      
      if (paymentResult.success) {
        console.log('✅ Test payment update successful');
        console.log(`   New Total Paid: $${paymentResult.totalPaid}`);
        console.log(`   New Balance: $${paymentResult.currentBalance}`);
      } else {
        console.error('❌ Test payment update failed:', paymentResult.error);
      }
    }
    
    console.log('\n✅ Debtor Transaction Sync Service test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing debtor transaction sync:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testDebtorTransactionSync();
