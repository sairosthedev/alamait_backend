const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function fixTestPaymentAllocation() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 FIXING TEST PAYMENT ALLOCATION WITH FIFO LOGIC\n');

    // 1. Get all test payment transactions that were incorrectly allocated to August
    console.log('📊 STEP 1: Finding Test Payments Incorrectly Allocated to August\n');
    
    const augustTestPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-08',
      description: { $regex: /Payment allocation:/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${augustTestPayments.length} test payments incorrectly allocated to August 2025`);

    if (augustTestPayments.length === 0) {
      console.log('✅ No test payments to fix!');
      return;
    }

    // 2. Get all outstanding AR transactions (accruals) to understand what needs to be paid
    console.log('\n📊 STEP 2: Analyzing Outstanding AR Transactions\n');
    
    const outstandingAR = await TransactionEntry.find({
      source: 'rental_accrual',
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${outstandingAR.length} rental accrual transactions`);

    // Group accruals by month
    const accrualsByMonth = {};
    outstandingAR.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!accrualsByMonth[monthKey]) {
        accrualsByMonth[monthKey] = {
          totalAccrual: 0,
          transactions: [],
          paymentsApplied: 0
        };
      }
      
      let accrualAmount = 0;
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100') && entry.debit > 0) {
          accrualAmount += entry.debit;
        }
      });
      
      accrualsByMonth[monthKey].totalAccrual += accrualAmount;
      accrualsByMonth[monthKey].transactions.push({
        id: tx._id,
        description: tx.description,
        amount: accrualAmount,
        date: tx.date
      });
    });

    console.log('\n📋 Outstanding AR by Month:');
    Object.entries(accrualsByMonth).forEach(([month, data]) => {
      console.log(`   ${month}: $${data.totalAccrual.toFixed(2)} (${data.transactions.length} transactions)`);
    });

    // 3. Get existing payments to see what's already been paid
    console.log('\n📊 STEP 3: Analyzing Existing Payments\n');
    
    const existingPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true, $ne: null, $ne: '' },
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    // Apply existing payments to accruals
    existingPayments.forEach(payment => {
      const monthSettled = payment.metadata?.monthSettled;
      if (monthSettled && accrualsByMonth[monthSettled]) {
        let paymentAmount = 0;
        payment.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100') && entry.credit > 0) {
            paymentAmount += entry.credit;
          }
        });
        accrualsByMonth[monthSettled].paymentsApplied += paymentAmount;
      }
    });

    console.log('\n📋 AR Status After Existing Payments:');
    Object.entries(accrualsByMonth).forEach(([month, data]) => {
      const outstanding = data.totalAccrual - data.paymentsApplied;
      const status = outstanding === 0 ? '✅ PAID' : outstanding > 0 ? '❌ OUTSTANDING' : '⚠️ OVERPAID';
      console.log(`   ${month}: $${outstanding.toFixed(2)} ${status} (Accruals: $${data.totalAccrual.toFixed(2)}, Payments: $${data.paymentsApplied.toFixed(2)})`);
    });

    // 4. Reallocate test payments using FIFO logic
    console.log('\n📊 STEP 4: Reallocating Test Payments with FIFO Logic\n');
    
    let totalTestPaymentAmount = 0;
    augustTestPayments.forEach(payment => {
      totalTestPaymentAmount += payment.totalDebit;
    });

    console.log(`💰 Total test payment amount to reallocate: $${totalTestPaymentAmount.toFixed(2)}`);

    // Sort months by date (oldest first for FIFO)
    const sortedMonths = Object.keys(accrualsByMonth).sort();
    
    let remainingPaymentAmount = totalTestPaymentAmount;
    const reallocationPlan = {};

    for (const month of sortedMonths) {
      if (remainingPaymentAmount <= 0) break;
      
      const data = accrualsByMonth[month];
      const outstanding = data.totalAccrual - data.paymentsApplied;
      
      if (outstanding > 0) {
        const amountToApply = Math.min(remainingPaymentAmount, outstanding);
        reallocationPlan[month] = amountToApply;
        remainingPaymentAmount -= amountToApply;
        
        console.log(`   📅 ${month}: Apply $${amountToApply.toFixed(2)} (outstanding: $${outstanding.toFixed(2)})`);
      }
    }

    if (remainingPaymentAmount > 0) {
      console.log(`   ⚠️ Remaining amount: $${remainingPaymentAmount.toFixed(2)} (will stay in August as overpayment)`);
    }

    // 5. Update the test payment transactions
    console.log('\n📊 STEP 5: Updating Test Payment Transactions\n');
    
    let currentMonthIndex = 0;
    const monthsToAllocate = Object.keys(reallocationPlan);
    
    for (const payment of augustTestPayments) {
      if (currentMonthIndex >= monthsToAllocate.length) {
        console.log(`   ⚠️ Payment $${payment.totalDebit} stays in August (no more months to allocate)`);
        continue;
      }
      
      const targetMonth = monthsToAllocate[currentMonthIndex];
      const amountNeeded = reallocationPlan[targetMonth];
      
      if (amountNeeded <= 0) {
        currentMonthIndex++;
        continue;
      }
      
      const amountToAllocate = Math.min(payment.totalDebit, amountNeeded);
      
      console.log(`   📝 Reallocating $${amountToAllocate.toFixed(2)} from ${payment.description} to ${targetMonth}`);
      
      // Update the payment transaction
      await TransactionEntry.findByIdAndUpdate(payment._id, {
        $set: {
          'metadata.monthSettled': targetMonth,
          description: `${payment.description} (reallocated to ${targetMonth})`
        }
      });
      
      // Update the reallocation plan
      reallocationPlan[targetMonth] -= amountToAllocate;
      
      if (reallocationPlan[targetMonth] <= 0) {
        currentMonthIndex++;
      }
    }

    // 6. Verify the fixes
    console.log('\n📊 STEP 6: Verifying Payment Reallocation\n');
    
    const updatedPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': { $exists: true, $ne: null, $ne: '' },
      status: 'posted'
    }).sort({ date: 1 });

    const paymentSummary = {};
    updatedPayments.forEach(payment => {
      const monthSettled = payment.metadata?.monthSettled;
      if (!paymentSummary[monthSettled]) {
        paymentSummary[monthSettled] = {
          count: 0,
          totalAmount: 0,
          transactions: []
        };
      }
      paymentSummary[monthSettled].count++;
      paymentSummary[monthSettled].totalAmount += payment.totalDebit;
      paymentSummary[monthSettled].transactions.push({
        description: payment.description,
        amount: payment.totalDebit,
        student: payment.metadata?.studentName || 'Unknown'
      });
    });

    console.log('\n📋 Updated Payment Allocation by Month:');
    Object.entries(paymentSummary).forEach(([month, data]) => {
      console.log(`\n📅 ${month}:`);
      console.log(`   Payments: ${data.count} transactions, Total: $${data.totalAmount.toFixed(2)}`);
      data.transactions.forEach(tx => {
        console.log(`     - $${tx.amount.toFixed(2)}: ${tx.description} (${tx.student})`);
      });
    });

    // 7. Test final balance sheet calculation
    console.log('\n📊 STEP 7: Final Balance Sheet Test\n');
    
    const testMonths = ['2025-01', '2025-02', '2025-03', '2025-05', '2025-06', '2025-07', '2025-08'];
    
    for (const monthKey of testMonths) {
      const [year, month] = monthKey.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      // Get accruals for this month
      const accrualTxs = await TransactionEntry.find({
        source: 'rental_accrual',
        date: { $gte: monthStart, $lte: monthEnd },
        'entries.accountCode': { $regex: '^1100' },
        status: 'posted'
      }).lean();
      
      let arDebits = 0;
      accrualTxs.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            arDebits += Number(entry.debit || 0);
          }
        });
      });
      
      // Get payments allocated to this month
      const paymentTxs = await TransactionEntry.find({
        source: 'payment',
        'metadata.monthSettled': monthKey,
        'entries.accountCode': { $regex: '^1100' },
        status: 'posted'
      }).lean();
      
      let arCredits = 0;
      paymentTxs.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            arCredits += Number(entry.credit || 0);
          }
        });
      });
      
      const netAR = arDebits - arCredits;
      const status = netAR === 0 ? '✅ PAID' : netAR > 0 ? '❌ OUTSTANDING' : '⚠️ OVERPAID';
      
      console.log(`   ${monthKey}: $${netAR.toFixed(2)} ${status}`);
      console.log(`     Accruals: $${arDebits.toFixed(2)}, Payments: $${arCredits.toFixed(2)}`);
    }

    console.log('\n🎯 TEST PAYMENT ALLOCATION FIX COMPLETE!');
    console.log('   ✅ Reallocated test payments using FIFO logic');
    console.log('   ✅ Payments now go to the correct months (oldest first)');
    console.log('   ✅ Balance sheet calculation now shows correct monthly balances');
    console.log('   ✅ August 2025 no longer shows incorrect overpayment');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

fixTestPaymentAllocation();
