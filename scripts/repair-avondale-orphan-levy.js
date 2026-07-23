/**
 * Reverse orphan Avondale July cash receipt left after Payment delete.
 * TXN1784708722816EP9L8 — $100 levies for 2026-03, paymentId 6a607e58ebbc4307fda2ec6b (missing)
 *
 * Usage:
 *   node scripts/repair-avondale-orphan-levy.js --dry
 *   node scripts/repair-avondale-orphan-levy.js --live
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const TransactionEntry = require('../src/models/TransactionEntry');
const { invalidateFinancialReports } = require('../src/utils/financialCache');

const DRY_RUN = process.argv.includes('--dry') || !process.argv.includes('--live');
const LIVE = process.argv.includes('--live');
const TXN_ID = 'TXN1784708722816EP9L8';
const MISSING_PAYMENT_ID = '6a607e58ebbc4307fda2ec6b';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI);
  const tx = await TransactionEntry.findOne({ transactionId: TXN_ID });
  if (!tx) {
    console.log('Transaction not found:', TXN_ID);
    process.exit(0);
  }

  console.log('Found:', tx.transactionId, 'status=', tx.status, 'date=', tx.date?.toISOString?.());
  console.log('description:', tx.description);
  console.log('paymentId:', tx.metadata?.paymentId);

  if (String(tx.metadata?.paymentId) !== MISSING_PAYMENT_ID) {
    console.log('Unexpected paymentId — aborting');
    process.exit(1);
  }

  if (tx.status === 'reversed') {
    console.log('Already reversed');
    process.exit(0);
  }

  if (!LIVE || DRY_RUN) {
    console.log('[DRY] Would reverse this transaction (cashflow -$100 levies)');
  } else {
    tx.status = 'reversed';
    tx.metadata = {
      ...(tx.metadata || {}),
      voidedOrphan: true,
      voidedAt: new Date().toISOString(),
      voidedReason: 'Payment document missing; orphan cash receipt inflated Avondale July cashflow by $100'
    };
    await tx.save();
    invalidateFinancialReports();
    console.log('✅ Reversed', TXN_ID, 'and invalidated financial report caches');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
