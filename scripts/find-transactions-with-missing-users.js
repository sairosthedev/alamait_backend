/*
 * Scan TransactionEntry documents for referenced user IDs that do not exist in the User collection.
 *
 * Sources checked per transaction:
 * - metadata.studentId
 * - sourceId (when looks like ObjectId)
 * - entries.accountCode patterns that embed studentId (1100-{id} or 1100-YYYY-MM-{id})
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="mongodb://localhost:27017/alamait"; node scripts/find-transactions-with-missing-users.js
 */

const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';

function isObjectIdLike(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function extractStudentIdFromAccountCode(accountCode) {
  if (!accountCode || !accountCode.startsWith('1100-')) return null;
  const parts = accountCode.split('-');
  // 1100-<id>
  if (parts.length === 2 && isObjectIdLike(parts[1])) return parts[1];
  // 1100-YYYY-MM-<id>
  if (parts.length >= 4 && /^[0-9]{4}$/.test(parts[1]) && /^[0-9]{2}$/.test(parts[2]) && isObjectIdLike(parts[3])) return parts[3];
  // fallback last token
  const last = parts[parts.length - 1];
  return isObjectIdLike(last) ? last : null;
}

async function main() {
  const start = Date.now();
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('🔍 Scanning transactions for missing referenced users...');

  const cursor = TransactionEntry.find({}).sort({ date: 1 }).cursor();
  let scanned = 0;
  const missingMap = new Map(); // userId -> { userId, occurrences: [] }

  for (let tx = await cursor.next(); tx != null; tx = await cursor.next()) {
    scanned++;
    const candidates = new Set();

    // metadata.studentId
    const msid = tx?.metadata?.studentId;
    if (isObjectIdLike(String(msid || ''))) candidates.add(String(msid));

    // sourceId
    const sid = tx?.sourceId;
    if (isObjectIdLike(String(sid || ''))) candidates.add(String(sid));

    // entries.accountCode with embedded student id
    (tx.entries || []).forEach(e => {
      const sidFromAcc = extractStudentIdFromAccountCode(e.accountCode);
      if (sidFromAcc) candidates.add(sidFromAcc);
    });

    // Check each candidate in Users
    for (const uid of candidates) {
      const userExists = await User.exists({ _id: uid });
      if (!userExists) {
        if (!missingMap.has(uid)) missingMap.set(uid, { userId: uid, occurrences: [] });
        missingMap.get(uid).occurrences.push({
          transactionId: tx._id,
          transactionRef: tx.transactionId || null,
          date: tx.date,
          source: tx.source,
          description: tx.description || ''
        });
      }
    }
  }

  const results = Array.from(missingMap.values());
  console.log('');
  console.log('===== RESULTS =====');
  console.log(`Scanned transactions: ${scanned}`);
  console.log(`Distinct missing user IDs: ${results.length}`);

  results.slice(0, 20).forEach(r => {
    console.log('');
    console.log(`• Missing user: ${r.userId} | occurrences: ${r.occurrences.length}`);
    r.occurrences.slice(0, 5).forEach(o => {
      console.log(`   - ${o.transactionId} | ${new Date(o.date).toISOString().slice(0,10)} | ${o.source} | ${o.transactionRef || ''} | ${o.description}`);
    });
    if (r.occurrences.length > 5) console.log(`   ... and ${r.occurrences.length - 5} more`);
  });

  const fs = require('fs');
  const outPath = `missing-users-in-transactions-${new Date().toISOString().slice(0,10)}.json`;
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scannedTransactions: scanned,
    missingUsers: results
  }, null, 2));
  console.log('');
  console.log(`📝 Full report written to ${outPath}`);

  await mongoose.disconnect();
  console.log(`Done in ${(Date.now() - start)}ms`);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});







