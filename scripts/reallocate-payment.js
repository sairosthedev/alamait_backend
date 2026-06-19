/**
 * Re-allocate a single payment after reversing its allocation transactions.
 * Usage: node scripts/reallocate-payment.js PAY-1781861879291
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const EnhancedPaymentAllocationService = require('../src/services/enhancedPaymentAllocationService');

const paymentIdArg = process.argv[2];
if (!paymentIdArg) {
  console.error('Usage: node scripts/reallocate-payment.js <paymentId>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const paymentDoc = await Payment.findOne({ paymentId: paymentIdArg });
  if (!paymentDoc) {
    console.error('Payment not found:', paymentIdArg);
    process.exit(1);
  }

  const Debtor = require('../src/models/Debtor');
  const debtor = await Debtor.findOne({ user: paymentDoc.student || paymentDoc.user }).lean();
  const arCode = paymentDoc.debtorAccountCode || paymentDoc.accountCode || debtor?.accountCode;

  const paymentIdStr = paymentDoc._id.toString();
  const txs = await TransactionEntry.find({
    status: { $ne: 'reversed' },
    $or: [
      { 'metadata.paymentId': paymentIdStr },
      { 'metadata.paymentId': paymentDoc.paymentId },
      { reference: paymentIdStr },
      { reference: paymentDoc.paymentId },
    ],
    source: { $in: ['payment', 'advance_payment'] },
  });

  console.log(`Reversing ${txs.length} existing allocation transaction(s)...`);
  for (const tx of txs) {
    await TransactionEntry.findByIdAndUpdate(tx._id, {
      $set: {
        status: 'reversed',
        'metadata.reversedByReallocateScript': true,
        'metadata.reversedAt': new Date().toISOString(),
      },
    });
    console.log(`  ↩️ ${tx.transactionId} (${tx.source}, $${tx.metadata?.amount || '?'})`);
  }

  paymentDoc.metadata = paymentDoc.metadata || {};
  delete paymentDoc.metadata.smartFIFOAllocationCalled;
  delete paymentDoc.metadata.smartFIFOAllocationCalledAt;
  paymentDoc.allocation = null;
  await paymentDoc.save();

  const normalizedPayments = EnhancedPaymentAllocationService.normalizePaymentComponents(
    paymentDoc.payments,
    {
      totalAmount: paymentDoc.totalAmount,
      rentAmount: paymentDoc.rentAmount,
      adminFee: paymentDoc.adminFee,
      deposit: paymentDoc.deposit,
      levies: paymentDoc.levies,
      date: paymentDoc.date,
    }
  );

  const allocationData = {
    paymentId: paymentDoc._id.toString(),
    studentId: paymentDoc.student || paymentDoc.user,
    totalAmount: Number(paymentDoc.totalAmount),
    payments: normalizedPayments,
    residence: paymentDoc.residence,
    paymentMonth: paymentDoc.paymentMonth,
    rentAmount: paymentDoc.rentAmount || 0,
    adminFee: paymentDoc.adminFee || 0,
    deposit: paymentDoc.deposit || 0,
    levies: paymentDoc.levies || 0,
    method: paymentDoc.method,
    date: paymentDoc.date,
    debtorAccountCode: arCode,
    accountCode: arCode,
  };

  console.log('Components:', normalizedPayments);
  const result = await EnhancedPaymentAllocationService.smartFIFOAllocation(allocationData);
  if (result?.success) {
    paymentDoc.metadata.smartFIFOAllocationCalled = true;
    paymentDoc.metadata.smartFIFOAllocationCalledAt = new Date();
    paymentDoc.allocation = result.allocation;
    await paymentDoc.save();
    console.log('✅ Re-allocation summary:', result.allocation.summary);
    console.log('Breakdown:', result.allocation.monthlyBreakdown);
  } else {
    console.error('❌ Re-allocation failed:', result?.message || result);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
