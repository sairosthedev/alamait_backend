/**
 * Repair Brian Munyanyi's ledger:
 * - Reverse duplicate April 2026 monthly rent accrual
 * - Backfill missing levy accruals ($50/mo) for April + May 2026
 * - Mark deposit as paid (March $300 payment)
 * - Reverse incorrect May (and optionally April) payment allocation transactions
 * - Re-run Smart FIFO allocation on affected payments
 *
 * Usage:
 *   node scripts/repair-brian-munyanyi-ledger.js --dry
 *   node scripts/repair-brian-munyanyi-ledger.js --live
 */
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Debtor = require('../src/models/Debtor');
const EnhancedPaymentAllocationService = require('../src/services/enhancedPaymentAllocationService');

const DRY_RUN = process.argv.includes('--dry');
const LIVE = process.argv.includes('--live');

const BRIAN_USER_ID = '69a54517848efafd166ee275';
const BRIAN_DEBTOR_ID = '69a5451e848efafd166ee4df';
const BRIAN_AR_CODE = `1100-${BRIAN_DEBTOR_ID}`;
const LEVY_AMOUNT = 50;
const MONTHS_NEEDING_LEVIES = ['2026-04', '2026-05'];
const PAYMENTS_TO_REALLOCATE = [
  'PAY-1776411290000',
  'PAY-1781855643081',
];
const MARCH_DEPOSIT_PAYMENT = 'PAY-1773680955289';

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  if (!uri) {
    console.error('❌ No MongoDB connection string found');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');
}

function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return {
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

async function reverseDuplicateAprilAccrual() {
  const { start, end } = monthBounds('2026-04');
  const accruals = await TransactionEntry.find({
    source: 'rental_accrual',
    status: { $ne: 'reversed' },
    'metadata.type': 'monthly_rent_accrual',
    'entries.accountCode': BRIAN_AR_CODE,
    date: { $gte: start, $lte: end },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (accruals.length <= 1) {
    console.log(`ℹ️ April accruals: ${accruals.length} (no duplicate to fix)`);
    return;
  }

  const keep = accruals[0];
  const duplicates = accruals.slice(1);
  console.log(`⚠️ Found ${duplicates.length} duplicate April accrual(s); keeping ${keep.transactionId}`);

  for (const dup of duplicates) {
    console.log(`   ${DRY_RUN ? '[DRY]' : '🔧'} Reverse duplicate: ${dup.transactionId}`);
    if (!LIVE || DRY_RUN) continue;
    await TransactionEntry.findByIdAndUpdate(dup._id, {
      $set: {
        status: 'reversed',
        'metadata.voidedDuplicate': true,
        'metadata.voidedAt': new Date().toISOString(),
        'metadata.voidedReason': 'repair-brian-munyanyi-ledger',
      },
    });
  }
}

async function hasLevyAccrualForMonth(monthKey) {
  const { start, end } = monthBounds(monthKey);
  const existing = await TransactionEntry.findOne({
    source: 'rental_accrual',
    status: { $ne: 'reversed' },
    'entries.accountCode': BRIAN_AR_CODE,
    date: { $gte: start, $lte: end },
  }).lean();

  if (!existing) return false;

  const levyEntry = (existing.entries || []).find(
    (e) => e.accountCode === '4010' && Number(e.credit) > 0
  );
  return Number(levyEntry?.credit || 0) >= LEVY_AMOUNT;
}

async function createLevyAccrual(monthKey, residenceId) {
  if (await hasLevyAccrualForMonth(monthKey)) {
    console.log(`ℹ️ Levy accrual already exists for ${monthKey}`);
    return;
  }

  const [year, month] = monthKey.split('-').map(Number);
  const { end } = monthBounds(monthKey);
  const txId = `TXN-LEVY-REPAIR-${monthKey}-${Date.now()}`;

  console.log(`   ${DRY_RUN ? '[DRY]' : '➕'} Create levy accrual ${monthKey}: $${LEVY_AMOUNT}`);

  if (!LIVE || DRY_RUN) return;

  const tx = new TransactionEntry({
    transactionId: txId,
    date: end,
    description: `Monthly levies accrual (repair) - ${monthKey}`,
    reference: `LEVY-REPAIR-${monthKey}-${BRIAN_USER_ID}`,
    entries: [
      {
        accountCode: BRIAN_AR_CODE,
        accountName: 'Accounts Receivable - Brian Munyanyi',
        accountType: 'Asset',
        debit: LEVY_AMOUNT,
        credit: 0,
        description: `Levies due ${monthKey}`,
      },
      {
        accountCode: '4010',
        accountName: 'Levies Income',
        accountType: 'Income',
        debit: 0,
        credit: LEVY_AMOUNT,
        description: `Levies income ${monthKey}`,
      },
    ],
    totalDebit: LEVY_AMOUNT,
    totalCredit: LEVY_AMOUNT,
    source: 'rental_accrual',
    sourceModel: 'Debtor',
    sourceId: BRIAN_DEBTOR_ID,
    residence: residenceId || null,
    createdBy: 'repair-script',
    status: 'posted',
    metadata: {
      type: 'monthly_levy_accrual',
      studentId: BRIAN_USER_ID,
      month: monthKey,
      accrualMonth: month,
      accrualYear: year,
      levies: LEVY_AMOUNT,
      repairScript: 'repair-brian-munyanyi-ledger',
    },
  });

  await tx.save();
}

async function fixDepositFlag() {
  const payment = await Payment.findOne({ paymentId: MARCH_DEPOSIT_PAYMENT }).lean();
  const debtor = await Debtor.findOne({ accountCode: BRIAN_AR_CODE }).lean();
  if (!debtor) {
    console.warn('⚠️ Debtor not found for deposit flag update');
    return;
  }

  const depositAmount = Number(payment?.deposit) || 300;
  console.log(`   ${DRY_RUN ? '[DRY]' : '🔧'} Set deposit paid: $${depositAmount} (payment ${MARCH_DEPOSIT_PAYMENT})`);

  if (!LIVE || DRY_RUN) return;

  await Debtor.findByIdAndUpdate(debtor._id, {
    $set: {
      'onceOffCharges.deposit.isPaid': true,
      'onceOffCharges.deposit.paidDate': payment?.date || new Date('2026-03-03'),
      'onceOffCharges.deposit.paidAmount': depositAmount,
      'onceOffCharges.deposit.paymentId': payment?._id?.toString() || MARCH_DEPOSIT_PAYMENT,
    },
  });
}

async function reversePaymentAllocations(paymentDoc) {
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
  }).lean();

  console.log(`   Found ${txs.length} allocation tx(s) for ${paymentDoc.paymentId}`);
  for (const tx of txs) {
    console.log(`   ${DRY_RUN ? '[DRY]' : '↩️'} Reverse ${tx.transactionId} (${tx.source}, $${tx.metadata?.amount || '?'})`);
    if (!LIVE || DRY_RUN) continue;
    await TransactionEntry.findByIdAndUpdate(tx._id, {
      $set: {
        status: 'reversed',
        'metadata.reversedByRepair': true,
        'metadata.reversedAt': new Date().toISOString(),
      },
    });
  }
}

async function reallocatePayment(paymentDoc) {
  const payments = [];
  if (Number(paymentDoc.rentAmount) > 0) {
    payments.push({ type: 'rent', amount: Number(paymentDoc.rentAmount), date: paymentDoc.date });
  }
  if (Number(paymentDoc.levies) > 0) {
    payments.push({ type: 'levies', amount: Number(paymentDoc.levies), date: paymentDoc.date });
  }
  if (Number(paymentDoc.deposit) > 0) {
    payments.push({ type: 'deposit', amount: Number(paymentDoc.deposit), date: paymentDoc.date });
  }
  if (Number(paymentDoc.adminFee) > 0) {
    payments.push({ type: 'admin', amount: Number(paymentDoc.adminFee), date: paymentDoc.date });
  }
  if (payments.length === 0 && Array.isArray(paymentDoc.payments)) {
    payments.push(
      ...EnhancedPaymentAllocationService.normalizePaymentComponents(paymentDoc.payments, {
        totalAmount: paymentDoc.totalAmount,
        rentAmount: paymentDoc.rentAmount,
        adminFee: paymentDoc.adminFee,
        deposit: paymentDoc.deposit,
        levies: paymentDoc.levies,
        date: paymentDoc.date,
      })
    );
  }

  const allocationData = {
    paymentId: paymentDoc._id.toString(),
    studentId: paymentDoc.student || paymentDoc.user,
    totalAmount: Number(paymentDoc.totalAmount),
    payments,
    residence: paymentDoc.residence,
    paymentMonth: paymentDoc.paymentMonth,
    rentAmount: paymentDoc.rentAmount || 0,
    adminFee: paymentDoc.adminFee || 0,
    deposit: paymentDoc.deposit || 0,
    levies: paymentDoc.levies || 0,
    method: paymentDoc.method,
    date: paymentDoc.date,
    debtorAccountCode: paymentDoc.debtorAccountCode || paymentDoc.accountCode || BRIAN_AR_CODE,
  };

  console.log(`   ${DRY_RUN ? '[DRY]' : '🎯'} Re-run Smart FIFO for ${paymentDoc.paymentId}`, allocationData);

  if (!LIVE || DRY_RUN) return null;

  await Payment.findByIdAndUpdate(paymentDoc._id, {
    $unset: {
      'metadata.smartFIFOAllocationCalled': '',
      'metadata.smartFIFOAllocationCalledAt': '',
    },
  });

  const result = await EnhancedPaymentAllocationService.smartFIFOAllocation(allocationData);
  if (result?.success) {
    await Payment.findByIdAndUpdate(paymentDoc._id, {
      $set: {
        'metadata.smartFIFOAllocationCalled': true,
        'metadata.smartFIFOAllocationCalledAt': new Date(),
        'metadata.repairedByScript': 'repair-brian-munyanyi-ledger',
      },
    });
  }
  return result;
}

async function main() {
  if (!DRY_RUN && !LIVE) {
    console.error('❌ Pass --dry or --live');
    process.exit(1);
  }

  await connect();
  console.log(`\n🩺 Repair Brian Munyanyi ledger (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);

  console.log('1️⃣ Reverse duplicate April 2026 rent accrual');
  await reverseDuplicateAprilAccrual();

  const samplePayment = await Payment.findOne({ paymentId: PAYMENTS_TO_REALLOCATE[0] }).lean();
  const residenceId = samplePayment?.residence;

  console.log('\n2️⃣ Backfill levy accruals');
  for (const monthKey of MONTHS_NEEDING_LEVIES) {
    await createLevyAccrual(monthKey, residenceId);
  }

  console.log('\n3️⃣ Fix March deposit once-off charge flag');
  await fixDepositFlag();

  console.log('\n4️⃣ Reverse + re-allocate payments');
  for (const paymentId of PAYMENTS_TO_REALLOCATE) {
    let paymentDoc = await Payment.findOne({ paymentId }).lean();
    if (!paymentDoc) {
      console.warn(`⚠️ Payment not found: ${paymentId}`);
      continue;
    }

    if (paymentId === 'PAY-1776411290000') {
      console.log('   🔧 Correct April payment breakdown: $650 rent + $50 levies');
      if (LIVE && !DRY_RUN) {
        await Payment.findByIdAndUpdate(paymentDoc._id, {
          $set: {
            rentAmount: 650,
            levies: 50,
            payments: [
              { type: 'rent', amount: 650, date: paymentDoc.date },
              { type: 'levies', amount: 50, date: paymentDoc.date },
            ],
          },
        });
        paymentDoc = await Payment.findById(paymentDoc._id).lean();
      } else {
        paymentDoc = {
          ...paymentDoc,
          rentAmount: 650,
          levies: 50,
          payments: [
            { type: 'rent', amount: 650, date: paymentDoc.date },
            { type: 'levies', amount: 50, date: paymentDoc.date },
          ],
        };
      }
    }

    console.log(`\n📦 ${paymentId} (month ${paymentDoc.paymentMonth})`);
    await reversePaymentAllocations(paymentDoc);
    const result = await reallocatePayment(paymentDoc);
    if (result && !result.success) {
      console.error(`❌ Re-allocation failed for ${paymentId}:`, result.message || result);
    } else if (result?.allocation?.summary) {
      console.log('   ✅ Summary:', result.allocation.summary);
    }
  }

  console.log('\n✅ Repair script finished');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
