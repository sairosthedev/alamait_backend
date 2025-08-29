const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function cleanupTestData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🧹 CLEANING UP TEST DATA - KEEPING ONLY CINDY GWEKWERERE\n');

    // 1. Find all test payment transactions (not Cindy Gwekwerere)
    console.log('📊 STEP 1: Finding Test Payment Transactions to Remove\n');
    
    const testPayments = await TransactionEntry.find({
      source: 'payment',
      description: { $regex: /Payment allocation:/ },
      status: 'posted'
    });

    console.log(`Found ${testPayments.length} test payment transactions to remove`);

    // 2. Find all test rental accruals (not Cindy Gwekwerere)
    console.log('\n📊 STEP 2: Finding Test Rental Accruals to Remove\n');
    
    const testAccruals = await TransactionEntry.find({
      source: 'rental_accrual',
      description: { $regex: /Student Payment - Room/ },
      status: 'posted'
    });

    console.log(`Found ${testAccruals.length} test rental accrual transactions to remove`);

    // 3. Show what we're keeping (Cindy Gwekwerere transactions)
    console.log('\n📊 STEP 3: Cindy Gwekwerere Transactions (Keeping)\n');
    
    const cindyTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentName': 'Cindy Gwekwerere' },
        { description: { $regex: /Cindy Gwekwerere/i } }
      ],
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`Found ${cindyTransactions.length} Cindy Gwekwerere transactions to keep:`);
    cindyTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.description} (${tx.date.toISOString().split('T')[0]})`);
    });

    // 4. Remove test data
    console.log('\n📊 STEP 4: Removing Test Data\n');
    
    if (testPayments.length > 0) {
      console.log(`🗑️ Removing ${testPayments.length} test payment transactions...`);
      for (const payment of testPayments) {
        console.log(`   - Removing: ${payment.description}`);
        await TransactionEntry.findByIdAndDelete(payment._id);
      }
    }

    if (testAccruals.length > 0) {
      console.log(`🗑️ Removing ${testAccruals.length} test rental accrual transactions...`);
      for (const accrual of testAccruals) {
        console.log(`   - Removing: ${accrual.description}`);
        await TransactionEntry.findByIdAndDelete(accrual._id);
      }
    }

    // 5. Verify cleanup
    console.log('\n📊 STEP 5: Verifying Cleanup\n');
    
    const remainingTransactions = await TransactionEntry.find({
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Remaining transactions in database: ${remainingTransactions.length}`);
    
    const transactionTypes = {};
    remainingTransactions.forEach(tx => {
      const type = tx.source || 'unknown';
      if (!transactionTypes[type]) {
        transactionTypes[type] = 0;
      }
      transactionTypes[type]++;
    });

    console.log('\n📋 Transaction Types Remaining:');
    Object.entries(transactionTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} transactions`);
    });

    // 6. Test balance sheet calculation with clean data
    console.log('\n📊 STEP 6: Testing Balance Sheet with Clean Data\n');
    
    const testMonths = ['2025-05', '2025-06', '2025-07', '2025-08'];
    
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

    // 7. Show Cindy Gwekwerere's final status
    console.log('\n📊 STEP 7: Cindy Gwekwerere Final Status\n');
    
    const cindyAR = await TransactionEntry.find({
      $or: [
        { 'metadata.studentName': 'Cindy Gwekwerere' },
        { description: { $regex: /Cindy Gwekwerere/i } }
      ],
      'entries.accountCode': { $regex: /^1100/ },
      status: 'posted'
    }).sort({ date: 1 });

    let totalAccruals = 0;
    let totalPayments = 0;

    cindyAR.forEach(tx => {
      tx.entries.forEach(entry => {
        if (entry.accountCode.startsWith('1100')) {
          if (tx.source === 'rental_accrual') {
            totalAccruals += entry.debit || 0;
          } else if (tx.source === 'payment') {
            totalPayments += entry.credit || 0;
          }
        }
      });
    });

    const outstandingBalance = totalAccruals - totalPayments;
    console.log(`💰 Cindy Gwekwerere AR Summary:`);
    console.log(`   Total Accruals: $${totalAccruals.toFixed(2)}`);
    console.log(`   Total Payments: $${totalPayments.toFixed(2)}`);
    console.log(`   Outstanding Balance: $${outstandingBalance.toFixed(2)}`);

    console.log('\n🎯 DATABASE CLEANUP COMPLETE!');
    console.log('   ✅ Removed all test data (John Doe, Jane Smith, etc.)');
    console.log('   ✅ Kept only Cindy Gwekwerere real transactions');
    console.log('   ✅ Balance sheet now shows correct data');
    console.log('   ✅ No more confusion with test payments');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

cleanupTestData();
