require('dotenv').config();

const connectDB = require('../src/config/database');
const TransactionEntry = require('../src/models/TransactionEntry');

async function main() {
  await connectDB();

  const debtorId = '69fcf21cf05a5024d7bb5a63';
  const ar = `1100-${debtorId}`;
  const studentId = '69fcf215f05a5024d7bb5a2a';
  const appCode = 'APP1778184726593X3FFD';

  const start = new Date('2026-04-01T00:00:00.000Z');
  const end = new Date('2026-04-02T00:00:00.000Z');

  const arCount = await TransactionEntry.countDocuments({
    status: { $ne: 'reversed' },
    $or: [
      { 'entries.accountCode': ar },
      { 'metadata.debtorId': debtorId },
      { sourceModel: 'Debtor', sourceId: debtorId },
    ],
  });

  const arTx = await TransactionEntry.find({
    status: { $ne: 'reversed' },
    'entries.accountCode': ar,
  })
    .select('_id date description source sourceModel sourceId metadata totalDebit totalCredit entries')
    .sort({ date: -1 })
    .limit(10)
    .lean();

  const leaseStart = await TransactionEntry.findOne({
    status: { $ne: 'reversed' },
    source: 'rental_accrual',
    'metadata.type': 'lease_start',
    $or: [
      { 'metadata.applicationCode': appCode },
      { 'metadata.studentId': studentId },
      { 'metadata.debtorId': debtorId },
      { sourceModel: 'Debtor', sourceId: debtorId },
    ],
    date: { $gte: start, $lt: end },
  })
    .select('_id date description source sourceModel sourceId metadata totalDebit totalCredit entries')
    .lean();

  // Also search any lease_start for this appCode regardless of date (to see what exists)
  const leaseStartAny = await TransactionEntry.find({
    status: { $ne: 'reversed' },
    source: 'rental_accrual',
    'metadata.type': 'lease_start',
    $or: [{ 'metadata.applicationCode': appCode }, { 'metadata.applicationId': { $exists: true } }],
  })
    .select('_id date description sourceModel sourceId metadata totalDebit totalCredit entries')
    .sort({ date: -1 })
    .limit(10)
    .lean();

  console.log(
    JSON.stringify(
      {
        debtorId,
        ar,
        studentId,
        appCode,
        arCount,
        arTx,
        leaseStart,
        leaseStartAny,
      },
      null,
      2
    )
  );
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

