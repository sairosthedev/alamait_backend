/**
 * Fix rental accrual AR codes from legacy 1100-{userId} to 1100-{debtorId}.
 *
 * Usage (from project root):
 *   node scripts/fixRentalAccrualArCodes.js
 *
 * Optional flags:
 *   --dry   : run in dry‑run mode (log what would change, no writes)
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Models are required via project src path
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');

const DRY_RUN = process.argv.includes('--dry');

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  if (!uri) {
    console.error('❌ No MongoDB connection string found in env (MONGODB_URI / MONGO_URI / DB_URI)');
    process.exit(1);
  }
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB');
}

async function main() {
  await connect();

  console.log('🔍 Searching for rental accruals with legacy AR codes (1100-{userId})...');

  const cursor = TransactionEntry.find({
    source: 'rental_accrual',
    'entries.accountCode': /^1100-[0-9a-f]{24}$/, // looks like 1100-{ObjectId}
    status: { $ne: 'reversed' },
  }).cursor();

  let checked = 0;
  let fixed = 0;

  for (let tx = await cursor.next(); tx != null; tx = await cursor.next()) {
    checked += 1;

    const arEntry = tx.entries.find(
      (e) => e.accountCode && e.accountCode.startsWith('1100-') && e.debit > 0
    );
    if (!arEntry) continue;

    const legacyCode = arEntry.accountCode; // 1100-{something}
    const legacyId = legacyCode.slice('1100-'.length);

    // Try to resolve debtor by this legacyId in any reasonable way
    let debtor = null;
    // Direct debtor _id
    if (mongoose.Types.ObjectId.isValid(legacyId)) {
      debtor = await Debtor.findById(legacyId).select('accountCode debtorCode').lean();
    }

    if (!debtor) {
      // Try by user
      debtor = await Debtor.findOne({ user: legacyId }).select('accountCode debtorCode').lean();
    }

    if (!debtor || !debtor.accountCode || !debtor.accountCode.startsWith('1100-')) {
      console.log(
        `⚠️  ${tx.transactionId}: could not resolve stable debtor AR for legacy code ${legacyCode}`
      );
      continue;
    }

    const correctCode = debtor.accountCode;
    if (correctCode === legacyCode) {
      continue; // already correct
    }

    console.log(
      `${DRY_RUN ? '🧪 [DRY‑RUN]' : '🔧'} ${tx.transactionId}: ${legacyCode} → ${correctCode} (Debtor ${
        debtor.debtorCode || 'N/A'
      })`
    );

    // Update all entries with the legacyCode
    tx.entries.forEach((e) => {
      if (e.accountCode === legacyCode) {
        e.accountCode = correctCode;
      }
    });

    if (!DRY_RUN) {
      await tx.save();
    }
    fixed += 1;
  }

  console.log(`✅ Done. Checked ${checked} accrual transactions, fixed ${fixed}.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});

