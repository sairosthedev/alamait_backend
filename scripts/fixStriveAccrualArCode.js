/**
 * One-off fix: align Strive Shasha's March 2026 accrual AR code
 * to match the lease start (debtor-based).
 *
 * Wrong (monthly accrual): 1100-68f81673a15253cdeb63741d
 * Correct (lease start):  1100-699da5ede37e048fc4c049ee
 *
 * Usage (from project root):
 *   node scripts/fixStriveAccrualArCode.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TransactionEntry = require('../src/models/TransactionEntry');

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

  const legacyCode = '1100-68f81673a15253cdeb63741d';
  const correctCode = '1100-699da5ede37e048fc4c049ee';

  console.log(`🔍 Finding Strive Shasha March accruals with legacy AR ${legacyCode}...`);

  const txs = await TransactionEntry.find({
    source: 'rental_accrual',
    'entries.accountCode': legacyCode,
    status: { $ne: 'reversed' },
    description: /Strive Shasha - 3\/2026/i,
  });

  if (!txs.length) {
    console.log('ℹ️ No matching Strive March accruals found. Nothing to update.');
    await mongoose.disconnect();
    return;
  }

  for (const tx of txs) {
    console.log(`🔧 Fixing transaction ${tx.transactionId} (${tx._id})`);
    tx.entries.forEach((e) => {
      if (e.accountCode === legacyCode) {
        e.accountCode = correctCode;
      }
    });
    await tx.save();
    console.log(`✅ Updated AR code on ${tx.transactionId}: ${legacyCode} → ${correctCode}`);
  }

  await mongoose.disconnect();
  console.log('✅ Strive accrual AR code fix completed.');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
