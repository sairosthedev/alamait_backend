/**
 * Fix duplicate monthly rental accruals.
 *
 * What it does:
 * - Scans TransactionEntry documents for monthly rent accruals (source: rental_accrual)
 * - Groups by (monthKey + AR accountCode 1100-*) to find duplicates
 * - Keeps the earliest created accrual per group
 * - For the rest:
 *    - default: mark as reversed (status='reversed' + metadata.voided*)
 *    - with --reverse: creates a reversing TransactionEntry and marks original as 'reversed'
 *
 * Usage (from project root):
 *   node scripts/fixDuplicateAccruals.js --dry
 *   node scripts/fixDuplicateAccruals.js --live
 *
 * Options:
 *   --dry       : no writes, just logs (recommended first)
 *   --live      : apply changes
 *   --reverse   : create reversing entries (plus mark original reversed)
 *   --limit=500 : max accruals to scan (default: 20000)
 */
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TransactionEntry = require('../src/models/TransactionEntry');

const DRY_RUN = process.argv.includes('--dry');
const LIVE = process.argv.includes('--live');
const REVERSE = process.argv.includes('--reverse');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Math.max(1, Number(LIMIT_ARG.split('=')[1]) || 0) : 20000;

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  if (!uri) {
    console.error('❌ No MongoDB connection string found in env (MONGODB_URI / MONGO_URI / DB_URI)');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');
}

function getMonthKey(tx) {
  const m = tx?.metadata?.month;
  if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) return m;
  const mo = tx?.metadata?.accrualMonth;
  const yr = tx?.metadata?.accrualYear;
  if (mo != null && yr != null) {
    const monthNum = Number(mo);
    const yearNum = Number(yr);
    if (Number.isFinite(monthNum) && Number.isFinite(yearNum) && monthNum >= 1 && monthNum <= 12) {
      return `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    }
  }
  if (tx?.date) {
    const d = new Date(tx.date);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }
  return null;
}

function getArAccountCode(tx) {
  const entries = Array.isArray(tx?.entries) ? tx.entries : [];
  const ar = entries.find((e) => typeof e?.accountCode === 'string' && e.accountCode.startsWith('1100-') && (Number(e.debit) || 0) > 0);
  if (ar?.accountCode) return ar.accountCode;
  const anyAr = entries.find((e) => typeof e?.accountCode === 'string' && e.accountCode.startsWith('1100-'));
  return anyAr?.accountCode || null;
}

function isMonthlyAccrual(tx) {
  const t = tx?.metadata?.type;
  if (t === 'monthly_rent_accrual') return true;
  const desc = String(tx?.description || '');
  return /monthly/i.test(desc) && /accrual/i.test(desc);
}

function cloneEntriesReversed(entries) {
  return entries.map((e) => ({
    accountCode: e.accountCode,
    accountName: e.accountName,
    accountType: e.accountType,
    debit: Number(e.credit || 0),
    credit: Number(e.debit || 0),
    description: e.description,
  }));
}

async function main() {
  if (!DRY_RUN && !LIVE) {
    console.error('❌ Please pass --dry or --live');
    process.exit(1);
  }

  await connect();

  console.log(`🔍 Scanning up to ${LIMIT} monthly accruals...`);

  const cursor = TransactionEntry.find({
    source: 'rental_accrual',
    status: { $ne: 'reversed' },
    $or: [
      { 'metadata.type': 'monthly_rent_accrual' },
      { description: { $regex: /Monthly.*accrual/i } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(LIMIT)
    .cursor();

  const groups = new Map(); // key -> [tx]
  let scanned = 0;
  let skippedNoKey = 0;

  for (let tx = await cursor.next(); tx != null; tx = await cursor.next()) {
    scanned += 1;
    if (!isMonthlyAccrual(tx)) continue;

    const monthKey = getMonthKey(tx);
    const arCode = getArAccountCode(tx);
    if (!monthKey || !arCode) {
      skippedNoKey += 1;
      continue;
    }
    const key = `${monthKey}::${arCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`📊 Scanned: ${scanned}, groups: ${groups.size}, duplicate groups: ${dupGroups.length}, skipped(no key): ${skippedNoKey}`);

  let duplicatesFound = 0;
  let duplicatesFixed = 0;
  let reversalsCreated = 0;

  for (const [key, list] of dupGroups) {
    duplicatesFound += (list.length - 1);
    const sorted = [...list].sort((a, b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0));
    const keep = sorted[0];
    const toFix = sorted.slice(1);

    console.log(`\n⚠️ Duplicate accruals for ${key}`);
    console.log(`   ✅ Keep: ${keep.transactionId || keep._id} (createdAt=${keep.createdAt || 'n/a'})`);

    for (const dup of toFix) {
      console.log(`   ${DRY_RUN ? '🧪 [DRY]' : '🔧'} Fix: ${dup.transactionId || dup._id} (createdAt=${dup.createdAt || 'n/a'})`);

      if (DRY_RUN) continue;

      if (REVERSE) {
        const reversedEntries = cloneEntriesReversed(dup.entries || []);
        const reversal = new TransactionEntry({
          transactionId: `REV-${dup.transactionId || dup._id}`,
          date: dup.date || new Date(),
          description: `Reversal of duplicate monthly accrual: ${dup.description || ''}`.trim(),
          reference: dup.reference || `REV-${dup.transactionId || dup._id}`,
          entries: reversedEntries,
          totalDebit: Number(dup.totalCredit || dup.totalDebit || 0),
          totalCredit: Number(dup.totalDebit || dup.totalCredit || 0),
          source: 'manual',
          sourceId: dup._id,
          sourceModel: 'TransactionEntry',
          residence: dup.residence,
          status: 'posted',
          metadata: {
            ...(dup.metadata || {}),
            reversalOf: String(dup._id),
            voidedDuplicate: true,
            voidedAt: new Date().toISOString(),
          },
        });

        await reversal.save();
        reversalsCreated += 1;

        dup.status = 'reversed';
        dup.metadata = {
          ...(dup.metadata || {}),
          voidedDuplicate: true,
          voidedAt: new Date().toISOString(),
          reversedByTransactionId: reversal.transactionId,
        };
        await dup.save();
      } else {
        dup.status = 'reversed';
        dup.metadata = {
          ...(dup.metadata || {}),
          voidedDuplicate: true,
          voidedAt: new Date().toISOString(),
          voidReason: 'Duplicate monthly accrual (script cleanup)',
          keptTransactionId: keep.transactionId || String(keep._id),
        };
        await dup.save();
      }

      duplicatesFixed += 1;
    }
  }

  console.log('\n✅ Done');
  console.log(`   - Duplicates found: ${duplicatesFound}`);
  console.log(`   - Duplicates fixed: ${duplicatesFixed}`);
  console.log(`   - Reversals created: ${reversalsCreated}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});

