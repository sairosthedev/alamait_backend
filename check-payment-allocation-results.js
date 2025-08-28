const mongoose = require('mongoose');
require('dotenv').config();

async function checkPaymentAllocationResults() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    const Payment = require('./src/models/Payment');
    
    // Find our recent payment
    const recentPayment = await Payment.findOne({
      paymentId: 'PAY-1756242624286'
    }).sort({ createdAt: -1 });
    
    if (recentPayment) {
      console.log('\n💰 Recent Payment Details:');
      console.log(`   Payment ID: ${recentPayment.paymentId}`);
      console.log(`   Total Amount: $${recentPayment.totalAmount}`);
      console.log(`   Allocation: ${recentPayment.allocation ? 'Completed' : 'Pending'}`);
      
      if (recentPayment.allocation) {
        console.log('\n📊 Allocation Results:');
        console.log(JSON.stringify(recentPayment.allocation, null, 2));
      }
    }
    
    // Check all AR transactions for Cindy to see the current state
    console.log('\n🔍 Current AR State for Cindy:');
    
    const allARTransactions = await TransactionEntry.find({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' }
    }).sort({ date: 1 });
    
    console.log(`Found ${allARTransactions.length} total AR transactions`);
    
    // Group by month
    const monthlyAR = {};
    
    allARTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyAR[monthKey]) {
        monthlyAR[monthKey] = {
          month: monthKey,
          accruals: [],
          payments: [],
          totalOwed: 0,
          totalPaid: 0,
          outstanding: 0
        };
      }
      
      if (tx.source === 'rental_accrual' || tx.source === 'lease_start') {
        // This is money owed (debit to AR)
        const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
        if (arEntry) {
          monthlyAR[monthKey].accruals.push({
            id: tx._id,
            amount: arEntry.debit,
            description: tx.description,
            source: tx.source
          });
          monthlyAR[monthKey].totalOwed += arEntry.debit;
        }
      } else if (tx.source === 'payment') {
        // This is money paid (credit to AR)
        const arEntry = tx.entries.find(e => e.accountCode.startsWith('1100-') && e.credit > 0);
        if (arEntry) {
          monthlyAR[monthKey].payments.push({
            id: tx._id,
            amount: arEntry.credit,
            description: tx.description,
            monthSettled: tx.metadata?.monthSettled
          });
          monthlyAR[monthKey].totalPaid += arEntry.credit;
        }
      }
    });
    
    // Calculate outstanding for each month
    Object.values(monthlyAR).forEach(month => {
      month.outstanding = Math.max(0, month.totalOwed - month.totalPaid);
      
      console.log(`\n📅 ${month.month}:`);
      console.log(`   Accruals (Owed): $${month.totalOwed}`);
      console.log(`   Payments (Paid): $${month.totalPaid}`);
      console.log(`   Outstanding: $${month.outstanding}`);
      
      if (month.accruals.length > 0) {
        console.log(`   Accrual Details:`);
        month.accruals.forEach(acc => {
          console.log(`     - ${acc.description}: $${acc.amount}`);
        });
      }
      
      if (month.payments.length > 0) {
        console.log(`   Payment Details:`);
        month.payments.forEach(pay => {
          console.log(`     - ${pay.description}: $${pay.amount} (settled month: ${pay.monthSettled || 'unknown'})`);
        });
      }
    });
    
    // Check if June was actually settled
    console.log('\n🔍 Checking June 2025 specifically:');
    const juneAR = monthlyAR['2025-06'];
    if (juneAR) {
      console.log(`   June 2025 AR: $${juneAR.outstanding}`);
      if (juneAR.outstanding === 0) {
        console.log('   ✅ June 2025 is fully settled!');
      } else {
        console.log('   ⚠️ June 2025 still has outstanding balance');
      }
    } else {
      console.log('   ❌ No June 2025 AR found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkPaymentAllocationResults();
