/**
 * Check payment allocation and related journal entries.
 * Usage: node scripts/check-payment-allocation.js PAY-1789642599027
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');

const paymentIdArg = process.argv[2];
if (!paymentIdArg) {
  console.error('Usage: node scripts/check-payment-allocation.js <paymentId>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const p = await Payment.findOne({ paymentId: paymentIdArg }).lean();
  if (!p) {
    console.error('Payment not found:', paymentIdArg);
    process.exit(1);
  }

  console.log('=== PAYMENT ===');
  console.log(
    JSON.stringify(
      {
        paymentId: p.paymentId,
        date: p.date,
        paymentMonth: p.paymentMonth,
        totalAmount: p.totalAmount,
        student: p.student,
        allocation: p.allocation,
        metadata: p.metadata
      },
      null,
      2
    )
  );

  const pid = p._id.toString();
  const txs = await TransactionEntry.find({
    status: { $ne: 'reversed' },
    $or: [
      { 'metadata.paymentId': pid },
      { 'metadata.paymentId': p.paymentId },
      { reference: pid },
      { reference: p.paymentId }
    ]
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`\n=== TRANSACTIONS (${txs.length}) ===`);
  for (const tx of txs) {
    console.log(`--- ${tx.transactionId} | ${tx.source} | ${(tx.description || '').slice(0, 80)}`);
    for (const e of tx.entries || []) {
      console.log(
        `    ${(e.accountCode || '').slice(0, 35)} ${(e.accountName || '').slice(0, 40)} D:${e.debit || 0} C:${e.credit || 0} | ${(e.description || '').slice(0, 70)}`
      );
    }
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
