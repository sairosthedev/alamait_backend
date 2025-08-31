const mongoose = require('mongoose');
require('dotenv').config();

async function testTransactionBasedTotals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const DebtorTransactionSyncService = require('./src/services/debtorTransactionSyncService');
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Debtor = require('./src/models/Debtor');
    
    console.log('🧪 Testing Transaction-Based Totals Calculation...\n');
    
    // Test 1: Check current transaction data
    console.log('📊 STEP 1: Analyzing current transaction data...');
    
    const accrualTransactions = await TransactionEntry.find({
      source: 'rental_accrual',
      'metadata.type': 'monthly_rent_accrual'
    }).sort({ date: 1 });
    
    const paymentTransactions = await TransactionEntry.find({
      source: 'payment',
      'metadata.allocationType': 'payment_allocation'
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${accrualTransactions.length} accrual transactions`);
    console.log(`📊 Found ${paymentTransactions.length} payment transactions`);
    
    // Group transactions by student
    const studentAccruals = {};
    const studentPayments = {};
    
    accrualTransactions.forEach(tx => {
      const studentId = tx.metadata.studentId;
      if (!studentAccruals[studentId]) {
        studentAccruals[studentId] = [];
      }
      studentAccruals[studentId].push(tx);
    });
    
    paymentTransactions.forEach(tx => {
      const studentId = tx.metadata.studentId;
      if (!studentPayments[studentId]) {
        studentPayments[studentId] = [];
      }
      studentPayments[studentId].push(tx);
    });
    
    // Test 2: Calculate expected totals from transactions
    console.log('\n📊 STEP 2: Calculating expected totals from transactions...');
    
    const expectedTotals = {};
    
    Object.keys(studentAccruals).forEach(studentId => {
      const totalOwed = studentAccruals[studentId].reduce((sum, tx) => sum + (tx.totalDebit || 0), 0);
      const totalPaid = studentPayments[studentId] ? 
        studentPayments[studentId].reduce((sum, tx) => sum + (tx.totalCredit || 0), 0) : 0;
      const currentBalance = Math.max(0, totalOwed - totalPaid);
      
      expectedTotals[studentId] = {
        totalOwed,
        totalPaid,
        currentBalance,
        accrualCount: studentAccruals[studentId].length,
        paymentCount: studentPayments[studentId] ? studentPayments[studentId].length : 0
      };
      
      console.log(`\nStudent ${studentId}:`);
      console.log(`   Expected Total Owed: $${totalOwed} (from ${studentAccruals[studentId].length} accruals)`);
      console.log(`   Expected Total Paid: $${totalPaid} (from ${studentPayments[studentId] ? studentPayments[studentId].length : 0} payments)`);
      console.log(`   Expected Current Balance: $${currentBalance}`);
    });
    
    // Test 3: Sync transactions to debtors
    console.log('\n📊 STEP 3: Syncing transactions to debtors...');
    const syncResult = await DebtorTransactionSyncService.syncAllTransactionsToDebtors();
    
    if (syncResult.success) {
      console.log('✅ Sync completed successfully!');
    } else {
      console.error('❌ Sync failed:', syncResult.error);
      return;
    }
    
    // Test 4: Compare debtor totals with transaction-based calculations
    console.log('\n📊 STEP 4: Comparing debtor totals with transaction-based calculations...');
    
    const debtors = await Debtor.find({});
    
    debtors.forEach((debtor, index) => {
      const studentId = debtor.user.toString();
      const expected = expectedTotals[studentId];
      
      console.log(`\n${index + 1}. Debtor: ${debtor.debtorCode}`);
      console.log(`   User ID: ${studentId}`);
      
      if (expected) {
        console.log(`   📊 COMPARISON:`);
        console.log(`   Transaction-Based Total Owed: $${expected.totalOwed}`);
        console.log(`   Debtor Total Owed: $${debtor.totalOwed}`);
        console.log(`   Match: ${Math.abs(expected.totalOwed - debtor.totalOwed) < 0.01 ? '✅' : '❌'}`);
        
        console.log(`   Transaction-Based Total Paid: $${expected.totalPaid}`);
        console.log(`   Debtor Total Paid: $${debtor.totalPaid}`);
        console.log(`   Match: ${Math.abs(expected.totalPaid - debtor.totalPaid) < 0.01 ? '✅' : '❌'}`);
        
        console.log(`   Transaction-Based Current Balance: $${expected.currentBalance}`);
        console.log(`   Debtor Current Balance: $${debtor.currentBalance}`);
        console.log(`   Match: ${Math.abs(expected.currentBalance - debtor.currentBalance) < 0.01 ? '✅' : '❌'}`);
        
        console.log(`   Status: ${debtor.status}`);
        console.log(`   Monthly Payments: ${debtor.monthlyPayments.length}`);
      } else {
        console.log(`   ⚠️ No transaction data found for this student`);
        console.log(`   Total Owed: $${debtor.totalOwed}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
      }
    });
    
    // Test 5: Test individual recalculation method
    console.log('\n📊 STEP 5: Testing individual recalculation method...');
    
    if (debtors.length > 0) {
      const testDebtor = debtors[0];
      const studentId = testDebtor.user.toString();
      
      console.log(`Testing recalculation for debtor: ${testDebtor.debtorCode}`);
      
      // Manually change totals to test recalculation
      testDebtor.totalOwed = 999999;
      testDebtor.totalPaid = 888888;
      testDebtor.currentBalance = 111111;
      await testDebtor.save();
      
      console.log(`   Before recalculation:`);
      console.log(`   Total Owed: $${testDebtor.totalOwed}`);
      console.log(`   Total Paid: $${testDebtor.totalPaid}`);
      console.log(`   Current Balance: $${testDebtor.currentBalance}`);
      
      // Recalculate from transactions
      await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactions(testDebtor, studentId);
      await testDebtor.save();
      
      console.log(`   After recalculation:`);
      console.log(`   Total Owed: $${testDebtor.totalOwed}`);
      console.log(`   Total Paid: $${testDebtor.totalPaid}`);
      console.log(`   Current Balance: $${testDebtor.currentBalance}`);
      
      const expected = expectedTotals[studentId];
      if (expected) {
        console.log(`   Expected from transactions:`);
        console.log(`   Total Owed: $${expected.totalOwed}`);
        console.log(`   Total Paid: $${expected.totalPaid}`);
        console.log(`   Current Balance: $${expected.currentBalance}`);
        
        const owedMatch = Math.abs(expected.totalOwed - testDebtor.totalOwed) < 0.01;
        const paidMatch = Math.abs(expected.totalPaid - testDebtor.totalPaid) < 0.01;
        const balanceMatch = Math.abs(expected.currentBalance - testDebtor.currentBalance) < 0.01;
        
        console.log(`   All totals match: ${owedMatch && paidMatch && balanceMatch ? '✅' : '❌'}`);
      }
    }
    
    console.log('\n✅ Transaction-Based Totals Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing transaction-based totals:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testTransactionBasedTotals();
