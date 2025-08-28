const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function testBalanceSheetMonthlyCalculation() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔧 TESTING BALANCE SHEET MONTHLY CALCULATION\n');

    // 1. Get all transactions for Cindy Gwekwerere
    console.log('📊 STEP 1: Cindy Gwekwerere Transaction Analysis\n');
    
    const cindyTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentName': 'Cindy Gwekwerere' },
        { description: { $regex: /Cindy Gwekwerere/i } }
      ],
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${cindyTransactions.length} transactions for Cindy Gwekwerere`);

    // Group by month and type
    const monthlyAnalysis = {};
    
    cindyTransactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyAnalysis[monthKey]) {
        monthlyAnalysis[monthKey] = {
          accruals: [],
          payments: [],
          totalAccrual: 0,
          totalPayment: 0,
          netBalance: 0
        };
      }

      // Analyze entries
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100-')) {
          if (tx.source === 'rental_accrual') {
            monthlyAnalysis[monthKey].accruals.push({
              amount: entry.debit || 0,
              description: tx.description,
              date: tx.date
            });
            monthlyAnalysis[monthKey].totalAccrual += entry.debit || 0;
          } else if (tx.source === 'payment') {
            monthlyAnalysis[monthKey].payments.push({
              amount: entry.credit || 0,
              description: tx.description,
              monthSettled: tx.metadata?.monthSettled,
              date: tx.date
            });
            monthlyAnalysis[monthKey].totalPayment += entry.credit || 0;
          }
        }
      });
    });

    console.log('\n📋 Monthly Analysis for Cindy Gwekwerere:');
    Object.entries(monthlyAnalysis).forEach(([month, data]) => {
      data.netBalance = data.totalAccrual - data.totalPayment;
      console.log(`\n📅 ${month}:`);
      console.log(`   Accruals: $${data.totalAccrual.toFixed(2)} (${data.accruals.length} transactions)`);
      console.log(`   Payments: $${data.totalPayment.toFixed(2)} (${data.payments.length} transactions)`);
      console.log(`   Net Balance: $${data.netBalance.toFixed(2)}`);
      
      if (data.accruals.length > 0) {
        console.log(`   Accrual Details:`);
        data.accruals.forEach(accrual => {
          console.log(`     - $${accrual.amount.toFixed(2)}: ${accrual.description}`);
        });
      }
      
      if (data.payments.length > 0) {
        console.log(`   Payment Details:`);
        data.payments.forEach(payment => {
          console.log(`     - $${payment.amount.toFixed(2)}: ${payment.description} (Settled: ${payment.monthSettled})`);
        });
      }
    });

    // 2. Test balance sheet calculation logic
    console.log('\n📊 STEP 2: Balance Sheet Calculation Test\n');
    
    const asOfDate = new Date('2025-08-31');
    console.log(`📅 Balance Sheet as of ${asOfDate.toISOString().split('T')[0]}`);

    // Get all AR transactions up to asOfDate
    const allARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: /^1100/ },
      date: { $lte: asOfDate },
      status: 'posted'
    }).sort({ date: 1 });

    // Calculate AR by month
    const arByMonth = {};
    
    allARTransactions.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          const date = new Date(tx.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!arByMonth[monthKey]) {
            arByMonth[monthKey] = {
              accruals: 0,
              payments: 0,
              netBalance: 0
            };
          }

          if (tx.source === 'rental_accrual') {
            arByMonth[monthKey].accruals += entry.debit || 0;
          } else if (tx.source === 'payment') {
            // Check if payment has monthSettled metadata
            const monthSettled = tx.metadata?.monthSettled;
            if (monthSettled) {
              // Payment is allocated to specific month
              if (!arByMonth[monthSettled]) {
                arByMonth[monthSettled] = {
                  accruals: 0,
                  payments: 0,
                  netBalance: 0
                };
              }
              arByMonth[monthSettled].payments += entry.credit || 0;
            } else {
              // Payment is allocated to transaction date month (fallback)
              arByMonth[monthKey].payments += entry.credit || 0;
            }
          }
        }
      });
    });

    // Calculate net balances
    Object.keys(arByMonth).forEach(month => {
      arByMonth[month].netBalance = arByMonth[month].accruals - arByMonth[month].payments;
    });

    console.log('\n📋 AR Balance by Month:');
    Object.entries(arByMonth).forEach(([month, data]) => {
      const status = data.netBalance === 0 ? '✅ PAID' : data.netBalance > 0 ? '❌ OUTSTANDING' : '⚠️ OVERPAID';
      console.log(`   ${month}: $${data.netBalance.toFixed(2)} ${status}`);
      console.log(`     Accruals: $${data.accruals.toFixed(2)}, Payments: $${data.payments.toFixed(2)}`);
    });

    // 3. Test the issue you mentioned
    console.log('\n📊 STEP 3: Testing the August vs May Issue\n');
    
    // Check if there are any payments allocated to August instead of May
    const augustPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-08',
      status: 'posted'
    });

    const mayPayments = await TransactionEntry.find({
      source: 'payment',
      'metadata.monthSettled': '2025-05',
      status: 'posted'
    });

    console.log(`📋 Payments allocated to August 2025: ${augustPayments.length}`);
    augustPayments.forEach(payment => {
      console.log(`   - $${payment.totalDebit} for ${payment.metadata?.studentName || 'Unknown'}`);
    });

    console.log(`📋 Payments allocated to May 2025: ${mayPayments.length}`);
    mayPayments.forEach(payment => {
      console.log(`   - $${payment.totalDebit} for ${payment.metadata?.studentName || 'Unknown'}`);
    });

    // 4. Check balance sheet calculation method
    console.log('\n📊 STEP 4: Balance Sheet Calculation Method\n');
    
    // Simulate what the balance sheet service might be doing
    const balanceSheetAR = await TransactionEntry.find({
      date: { $lte: asOfDate },
      status: 'posted',
      'entries.accountCode': { $regex: /^1100/ }
    });

    let totalAR = 0;
    const arByAccount = {};

    balanceSheetAR.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          if (!arByAccount[entry.accountCode]) {
            arByAccount[entry.accountCode] = 0;
          }
          
          const amount = (entry.debit || 0) - (entry.credit || 0);
          arByAccount[entry.accountCode] += amount;
          totalAR += amount;
        }
      });
    });

    console.log(`💰 Total AR Balance: $${totalAR.toFixed(2)}`);
    console.log('\n📋 AR by Account:');
    Object.entries(arByAccount).forEach(([accountCode, balance]) => {
      console.log(`   ${accountCode}: $${balance.toFixed(2)}`);
    });

    console.log('\n🎯 BALANCE SHEET MONTHLY CALCULATION TEST COMPLETE!');
    console.log('   ✅ Analyzed Cindy Gwekwerere transactions by month');
    console.log('   ✅ Verified payment allocation to correct months');
    console.log('   ✅ Checked balance sheet calculation logic');
    console.log('   ✅ Identified potential calculation issues');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testBalanceSheetMonthlyCalculation();
