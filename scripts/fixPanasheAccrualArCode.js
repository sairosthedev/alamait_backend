/**
 * One-off fix: align Panashe Shaya's March 2026 accrual AR code
 * so it matches the lease start AR (debtor-based).
 *
 * Usage (from project root):
 *   node scripts/fixPanasheAccrualArCode.js
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

  // Legacy wrong AR code on March accrual for Panashe
  const legacyCode = '1100-6996cbd8f38ba7050d06f267';
  // Correct debtor-based AR code from lease start
  const correctCode = '1100-68f081ac9fa1a23cea9de312';

  console.log(`🔍 Finding Panashe March accruals with legacy AR ${legacyCode}...`);

  const query = {
    source: 'rental_accrual',
    'entries.accountCode': legacyCode,
    status: { $ne: 'reversed' },
    description: /Panashe Shaya - 3\/2026/i,
  };

  const txs = await TransactionEntry.find(query);

  if (!txs.length) {
    console.log('ℹ️ No matching Panashe March accruals found. Nothing to update.');
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
  console.log('✅ Panashe accrual AR code fix completed.');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});

