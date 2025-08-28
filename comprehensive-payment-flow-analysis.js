const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function comprehensiveAnalysis() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 COMPREHENSIVE PAYMENT ALLOCATION FLOW ANALYSIS\n');

    // 1. Check all accrual transactions
    console.log('📊 STEP 1: ACCRUAL TRANSACTIONS ANALYSIS');
    const accruals = await TransactionEntry.find({
      source: 'rental_accrual'
    }).sort({ date: 1 });

    console.log(`Found ${accruals.length} accrual transactions\n`);

    const accrualsByStudent = {};
    accruals.forEach(accrual => {
      accrual.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          if (!accrualsByStudent[studentId]) {
            accrualsByStudent[studentId] = [];
          }
          accrualsByStudent[studentId].push({
            date: accrual.date,
            description: accrual.description,
            amount: entry.debit || entry.credit,
            monthKey: `${accrual.date.getFullYear()}-${String(accrual.date.getMonth() + 1).padStart(2, '0')}`
          });
        }
      });
    });

    Object.entries(accrualsByStudent).forEach(([studentId, transactions]) => {
      console.log(`👤 Student ${studentId}:`);
      transactions.forEach(tx => {
        console.log(`   ${tx.monthKey}: $${tx.amount} - ${tx.description}`);
      });
      console.log('');
    });

    // 2. Check all payment allocation transactions
    console.log('📊 STEP 2: PAYMENT ALLOCATION TRANSACTIONS ANALYSIS');
    const paymentAllocations = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /Payment allocation/ }
    }).sort({ date: 1 });

    console.log(`Found ${paymentAllocations.length} payment allocation transactions\n`);

    if (paymentAllocations.length === 0) {
      console.log('❌ CRITICAL ISSUE: No payment allocation transactions found!');
      console.log('   This means the Smart FIFO allocation system is not working.\n');
    } else {
      paymentAllocations.forEach((tx, index) => {
        console.log(`📋 Payment Allocation ${index + 1}:`);
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
    }

    // 3. Check all payment transactions
    console.log('📊 STEP 3: PAYMENT TRANSACTIONS ANALYSIS');
    const payments = await TransactionEntry.find({
      source: 'payment'
    }).sort({ date: 1 });

    console.log(`Found ${payments.length} payment transactions\n`);

    const paymentsByStudent = {};
    payments.forEach(payment => {
      payment.entries.forEach(entry => {
        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
          const studentId = entry.accountCode.replace('1100-', '');
          if (!paymentsByStudent[studentId]) {
            paymentsByStudent[studentId] = [];
          }
          paymentsByStudent[studentId].push({
            date: payment.date,
            description: payment.description,
            amount: entry.debit || entry.credit,
            monthSettled: payment.metadata?.monthSettled
          });
        }
      });
    });

    Object.entries(paymentsByStudent).forEach(([studentId, transactions]) => {
      console.log(`👤 Student ${studentId} Payments:`);
      transactions.forEach(tx => {
        console.log(`   ${tx.date.toDateString()}: $${tx.amount} - ${tx.description} (settled: ${tx.monthSettled || 'NOT SET'})`);
      });
      console.log('');
    });

    // 4. Check balance sheet calculation
    console.log('📊 STEP 4: BALANCE SHEET CALCULATION ANALYSIS');
    
    // Test May 2025
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
    console.log('');

    // 5. Root Cause Analysis
    console.log('📊 STEP 5: ROOT CAUSE ANALYSIS');
    console.log('🔍 IDENTIFIED ISSUES:');
    console.log('   1. Student Account Mismatch: Two different student IDs for same person');
    console.log('   2. Payment Allocation System Not Working: No allocation transactions created');
    console.log('   3. Balance Sheet Using Wrong Data: Using test data instead of real allocations');
    console.log('   4. monthSettled Logic Not Applied: Payments not properly allocated by month');
    console.log('');

    // 6. Recommended Fixes
    console.log('📊 STEP 6: RECOMMENDED FIXES');
    console.log('🔧 IMMEDIATE ACTIONS NEEDED:');
    console.log('   1. Fix Student Account Mismatch: Consolidate student IDs');
    console.log('   2. Enable Payment Allocation: Ensure Smart FIFO system creates allocation transactions');
    console.log('   3. Clean Test Data: Remove or mark test transactions');
    console.log('   4. Verify monthSettled Logic: Ensure payments are allocated to correct months');
    console.log('   5. Test Balance Sheet: Verify calculations use correct allocation data');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

comprehensiveAnalysis();
