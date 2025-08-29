const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TransactionEntry = require('./src/models/TransactionEntry');

async function fixPaymentAllocations() {
  try {
    console.log('🔧 Fixing corrupted payment allocations...\n');

    // Get all payment allocation transactions
    const paymentTxs = await TransactionEntry.find({
      source: 'payment',
      'metadata.allocationType': 'payment_allocation'
    }).lean();

    console.log(`📊 Found ${paymentTxs.length} payment allocation transactions\n`);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const paymentTx of paymentTxs) {
      const studentId = paymentTx.metadata?.studentId;
      const monthSettled = paymentTx.metadata?.monthSettled;
      
      if (!studentId || !monthSettled) {
        console.log(`⚠️ Skipping payment ${paymentTx._id} - missing studentId or monthSettled`);
        continue;
      }

      console.log(`🔍 Checking payment ${paymentTx._id}:`);
      console.log(`   Student: ${studentId}`);
      console.log(`   Month Settled: ${monthSettled}`);
      console.log(`   Description: ${paymentTx.description}`);

      // Check if the student has an accrual for this month
      const [year, month] = monthSettled.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

      const accrualTx = await TransactionEntry.findOne({
        source: 'rental_accrual',
        date: { $gte: monthStart, $lte: monthEnd },
        'entries.accountCode': `1100-${studentId}`
      });

      if (!accrualTx) {
        console.log(`❌ PROBLEM: Student ${studentId} has no accrual for ${monthSettled}`);
        console.log(`   Payment amount: $${paymentTx.totalCredit}`);
        console.log(`   This payment should be deleted or reallocated`);
        
        // Delete the incorrect payment allocation
        await TransactionEntry.findByIdAndDelete(paymentTx._id);
        deletedCount++;
        console.log(`   ✅ Deleted incorrect payment allocation`);
      } else {
        console.log(`✅ Student ${studentId} has accrual for ${monthSettled} - payment is valid`);
        fixedCount++;
      }
      console.log('');
    }

    console.log('📊 SUMMARY:');
    console.log(`   Valid payments: ${fixedCount}`);
    console.log(`   Deleted incorrect payments: ${deletedCount}`);
    console.log(`   Total processed: ${paymentTxs.length}`);

    // Verify the fix
    console.log('\n🔍 Verifying the fix...\n');
    
    const remainingPaymentTxs = await TransactionEntry.find({
      source: 'payment',
      'metadata.allocationType': 'payment_allocation'
    }).lean();

    console.log(`📊 Remaining payment allocation transactions: ${remainingPaymentTxs.length}`);

    // Check for any remaining mismatches
    for (const paymentTx of remainingPaymentTxs) {
      const studentId = paymentTx.metadata?.studentId;
      const monthSettled = paymentTx.metadata?.monthSettled;
      
      if (studentId && monthSettled) {
        const [year, month] = monthSettled.split('-');
        const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

        const accrualTx = await TransactionEntry.findOne({
          source: 'rental_accrual',
          date: { $gte: monthStart, $lte: monthEnd },
          'entries.accountCode': `1100-${studentId}`
        });

        if (!accrualTx) {
          console.log(`⚠️ Still found mismatch: Payment for ${studentId} in ${monthSettled} but no accrual`);
        } else {
          console.log(`✅ Verified: Payment for ${studentId} in ${monthSettled} has matching accrual`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}

fixPaymentAllocations();
