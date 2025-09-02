/*
  One-time repair script:
  - Finds TransactionEntry docs with source='payment' missing metadata.studentId
  - Derives student/residence from linked Payment via reference/sourceId
  - Also fixes rental_accrual entries missing residence metadata using Debtor link

  Usage:
    NODE_ENV=development node scripts/repair-missing-student-metadata.js
*/

const mongoose = require('mongoose');
require('dotenv').config();

const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Debtor = require('../src/models/Debtor');
// Ensure Residence model is registered for population
require('../src/models/Residence');
const DebtorDataSyncService = require('../src/services/debtorDataSyncService');

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri, { autoIndex: false });
}

async function fixPaymentEntries(affectedDebtors) {
  const cursor = TransactionEntry.find({
    source: 'payment',
    $or: [
      { 'metadata.studentId': { $exists: false } },
      { 'metadata.studentId': null }
    ]
  }).cursor();

  let fixed = 0, skipped = 0;
  for await (const tx of cursor) {
    try {
      // Try reference first (often set to Payment _id in this codebase)
      let payment = null;
      if (tx.reference) {
        payment = await Payment.findById(tx.reference).select('student residence');
      }
      // Fallback to sourceId if reference not valid
      if (!payment && tx.sourceId) {
        payment = await Payment.findById(tx.sourceId).select('student residence');
      }
      let studentId = payment?.student;
      let residenceId = payment?.residence;

      // If no payment found, try to infer from AR account code in entries (e.g., 1100-{userId})
      if (!studentId && Array.isArray(tx.entries)) {
        const arEntry = tx.entries.find(e => typeof e.accountCode === 'string' && e.accountCode.startsWith('1100-'));
        if (arEntry) {
          const arCode = arEntry.accountCode;
          const userIdPart = arCode.substring('1100-'.length);
          // Find debtor by exact accountCode to resolve user
          const debtor = await Debtor.findOne({ accountCode: arCode }).select('user residence');
          if (debtor) {
            studentId = debtor.user;
            residenceId = debtor.residence;
          }
        }
      }

      if (!studentId) { skipped++; continue; }

      tx.metadata = { ...(tx.metadata || {}) };
      tx.metadata.studentId = tx.metadata.studentId || studentId;
      if (!tx.metadata.residenceId && residenceId) tx.metadata.residenceId = residenceId;
      if (payment && !tx.sourceId) tx.sourceId = payment._id;
      if (payment) tx.sourceModel = tx.sourceModel || 'Payment';

      await tx.save();

      // Track debtor for later sync
      try {
        const debtor = await Debtor.findOne({ user: payment.student }).select('_id');
        if (debtor?._id) {
          affectedDebtors.add(debtor._id.toString());
        }
      } catch {}
      fixed++;
    } catch (e) {
      console.error('Error fixing payment tx', tx._id.toString(), e.message);
      skipped++;
    }
  }
  return { fixed, skipped };
}

async function fixAccrualEntries(affectedDebtors) {
  const cursor = TransactionEntry.find({
    source: 'rental_accrual',
    $or: [
      { 'metadata.residenceId': { $exists: false } },
      { 'metadata.residenceId': null }
    ]
  }).cursor();

  let fixed = 0, skipped = 0;
  for await (const tx of cursor) {
    try {
      // We saved sourceId as Debtor _id in backfill; use it to get residence
      const debtorId = tx.sourceId;
      if (!debtorId) { skipped++; continue; }
      const debtor = await Debtor.findById(debtorId).populate('residence', 'name');
      if (!debtor) { skipped++; continue; }

      tx.metadata = { ...(tx.metadata || {}) };
      if (!tx.metadata.studentId && debtor.user) tx.metadata.studentId = debtor.user;
      if (!tx.metadata.residenceId) tx.metadata.residenceId = debtor.residence?._id || debtor.residence;
      if (!tx.metadata.residenceName) tx.metadata.residenceName = debtor.residence?.name || 'Unknown';
      await tx.save();
      affectedDebtors.add(debtor._id.toString());
      fixed++;
    } catch (e) {
      console.error('Error fixing accrual tx', tx._id.toString(), e.message);
      skipped++;
    }
  }
  return { fixed, skipped };
}

(async () => {
  try {
    await connect();
    console.log('🔧 Connected. Starting repair...');

    const affectedDebtors = new Set();
    const pay = await fixPaymentEntries(affectedDebtors);
    console.log(`✅ Payment entries fixed: ${pay.fixed}, skipped: ${pay.skipped}`);

    const accr = await fixAccrualEntries(affectedDebtors);
    console.log(`✅ Accrual entries fixed: ${accr.fixed}, skipped: ${accr.skipped}`);

    // Run debtor data sync for affected debtors
    console.log(`🔄 Syncing debtor data arrays for ${affectedDebtors.size} debtors...`);
    for (const debtorId of affectedDebtors) {
      try {
        await DebtorDataSyncService.syncDebtorDataArrays(debtorId);
        console.log(`   ✅ Synced debtor ${debtorId}`);
      } catch (e) {
        console.error(`   ❌ Sync failed for debtor ${debtorId}:`, e.message);
      }
    }

    await mongoose.disconnect();
    console.log('🏁 Done.');
  } catch (e) {
    console.error('❌ Repair failed:', e);
    process.exitCode = 1;
  }
})();
