require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Payment = require('../src/models/Payment');
  const TransactionEntry = require('../src/models/TransactionEntry');

  const paymentId = process.argv[2] || 'PAY-1789651414903';
  const payment = await Payment.findOne({ paymentId }).lean();
  if (!payment) {
    console.log('Payment not found:', paymentId);
    process.exit(1);
  }
  console.log('Payment:', payment.paymentId, payment.paymentMonth, payment.totalAmount, payment.date);

  const pid = payment._id.toString();
  const txs = await TransactionEntry.find({
    $or: [{ reference: pid }, { 'metadata.paymentId': pid }],
    status: { $ne: 'reversed' }
  }).lean();

  console.log('\n=== Transactions for payment ===');
  for (const tx of txs) {
    console.log('\n', tx.transactionId, tx.source, tx.description);
    console.log(' metadata:', JSON.stringify(tx.metadata, null, 2));
    for (const e of tx.entries || []) {
      console.log(' ', e.accountCode, 'D:', e.debit, 'C:', e.credit, '-', (e.description || '').slice(0, 50));
    }
  }

  const arId = '6a96917f0cb50dd70a9067fa';
  const ar = await TransactionEntry.findById(arId).lean();
  if (ar) {
    console.log('\n=== Linked AR tx ===', ar.transactionId, ar.source, ar.date);
    console.log(' metadata month:', ar.metadata?.accrualMonth, ar.metadata?.accrualYear, ar.metadata?.type);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
