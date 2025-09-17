/*
 * Scan transactions for student AR accounts (1100-*) that don't have a matching Debtor record.
 *
 * Usage:
 *   MONGO_URI="mongodb://localhost:27017/alamait" node scripts/find-missing-debtors.js
 */

const mongoose = require('mongoose');

// Models
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';

function extractStudentIdFromAccountCode(accountCode) {
  // Supported formats:
  // 1) 1100-{studentId}
  // 2) 1100-YYYY-MM-{studentId}
  // 3) Fallback: use last hyphen-separated token if 24-hex
  if (!accountCode || !accountCode.startsWith('1100-')) return null;
  const parts = accountCode.split('-');
  // 1100-<id>
  if (parts.length === 2 && /^[a-f0-9]{24}$/i.test(parts[1])) {
    return parts[1];
  }
  // 1100-YYYY-MM-<id>
  if (parts.length >= 4 && /^[0-9]{4}$/.test(parts[1]) && /^[0-9]{2}$/.test(parts[2]) && /^[a-f0-9]{24}$/i.test(parts[3])) {
    return parts[3];
  }
  // Fallback: last token looks like ObjectId
  const last = parts[parts.length - 1];
  if (/^[a-f0-9]{24}$/i.test(last)) {
    return last;
  }
  return null;
}

async function main() {
  const start = Date.now();
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  console.log('🔍 Scanning transactions for AR accounts without matching Debtors...');

  // Find transactions that touch AR accounts (1100-*)
  const cursor = TransactionEntry.find({ 'entries.accountCode': { $regex: '^1100-' } })
    .sort({ date: 1 })
    .cursor();

  const missingByStudent = new Map(); // studentId -> { studentId, accountCodes:Set, transactions:[] }
  let scannedTransactions = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scannedTransactions++;
    const arEntries = (doc.entries || []).filter(e => typeof e.accountCode === 'string' && e.accountCode.startsWith('1100-'));
    for (const entry of arEntries) {
      const studentId = extractStudentIdFromAccountCode(entry.accountCode);
      if (!studentId) {
        continue;
      }

      // Check for matching debtor by user or accountCode
      const debtor = await Debtor.findOne({
        $or: [
          { user: studentId },
          { accountCode: `1100-${studentId}` }
        ]
      }).select('_id user accountCode');

      if (!debtor) {
        if (!missingByStudent.has(studentId)) {
          missingByStudent.set(studentId, {
            studentId,
            accountCodes: new Set(),
            transactions: []
          });
        }
        const bucket = missingByStudent.get(studentId);
        bucket.accountCodes.add(entry.accountCode);
        bucket.transactions.push({
          transactionId: doc._id,
          transactionRef: doc.transactionId || null,
          date: doc.date,
          description: doc.description || '',
          arAccountCode: entry.accountCode,
          debit: entry.debit || 0,
          credit: entry.credit || 0
        });
      }
    }
  }

  // Print summary
  const missingStudents = Array.from(missingByStudent.values()).map(v => ({
    studentId: v.studentId,
    accountCodes: Array.from(v.accountCodes),
    transactions: v.transactions
  }));

  console.log('');
  console.log('===== RESULTS =====');
  console.log(`Scanned transactions: ${scannedTransactions}`);
  console.log(`Students with AR transactions but missing Debtor: ${missingStudents.length}`);

  if (missingStudents.length) {
    for (const s of missingStudents) {
      console.log('');
      console.log(`• StudentId: ${s.studentId}`);
      console.log(`  AR Accounts: ${s.accountCodes.join(', ')}`);
      console.log(`  Transactions referencing missing debtor: ${s.transactions.length}`);
      s.transactions.slice(0, 10).forEach(t => {
        console.log(`   - ${t.transactionId} | ${new Date(t.date).toISOString().slice(0,10)} | ${t.arAccountCode} | ${t.debit ? 'DR '+t.debit : 'CR '+t.credit} | ${t.description}`);
      });
      if (s.transactions.length > 10) {
        console.log(`   ... and ${s.transactions.length - 10} more`);
      }
    }

    // Optionally write JSON report
    const fs = require('fs');
    const outPath = `missing-debtors-report-${new Date().toISOString().slice(0,10)}.json`;
    fs.writeFileSync(outPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      scannedTransactions,
      missingStudents
    }, null, 2));
    console.log('');
    console.log(`📝 Full report written to ${outPath}`);
  } else {
    console.log('✅ No issues found. All AR transactions reference existing Debtors.');
  }

  await mongoose.disconnect();
  console.log(`Done in ${(Date.now() - start)}ms`);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});


