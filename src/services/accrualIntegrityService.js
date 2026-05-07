const mongoose = require('mongoose');
const RentalAccrualService = require('./rentalAccrualService');
const TransactionEntry = require('../models/TransactionEntry');

class AccrualIntegrityService {
  static _running = false;

  /**
   * Strong integrity job:
   * - Ensures lease_start + monthly accruals exist for all approved applications within lease periods
   * - Respects lease-end cutoff rule implemented in RentalAccrualService
   * - Detects monthly accrual duplicates and reverses extras
   */
  static async run({ fixDuplicates = true } = {}) {
    if (AccrualIntegrityService._running) {
      console.log('⏭️ AccrualIntegrityService already running - skipping');
      return { skipped: true };
    }

    AccrualIntegrityService._running = true;
    const startedAt = new Date();
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log('⏭️ DB not connected - skipping accrual integrity run');
        return { skipped: true, reason: 'db_not_connected' };
      }

      console.log('🧾 AccrualIntegrityService starting...');

      const ensureResult = await RentalAccrualService.ensureAllAccrualsForActiveStudents({
        includeFutureMonths: false,
        dryRun: false,
      });

      let duplicates = { groups: 0, reversed: 0 };
      if (fixDuplicates) {
        duplicates = await this.reverseDuplicateMonthlyAccruals();
      }

      const finishedAt = new Date();
      console.log('🧾 AccrualIntegrityService finished', {
        ms: finishedAt.getTime() - startedAt.getTime(),
        ensureSummary: ensureResult?.summary,
        duplicates,
      });

      return { success: true, ensureResult, duplicates };
    } catch (err) {
      console.error('❌ AccrualIntegrityService failed:', err);
      return { success: false, error: err.message };
    } finally {
      AccrualIntegrityService._running = false;
    }
  }

  // Group by (monthKey + 1100-* AR code), keep earliest, reverse the rest.
  static async reverseDuplicateMonthlyAccruals({ limit = 30000 } = {}) {
    const cursor = TransactionEntry.find({
      source: 'rental_accrual',
      status: { $ne: 'reversed' },
      $or: [
        { 'metadata.type': 'monthly_rent_accrual' },
        { description: { $regex: /Monthly.*accrual/i } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .cursor();

    const groups = new Map();
    const getMonthKey = (tx) => {
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
    };

    const getAr = (tx) => {
      const entries = Array.isArray(tx?.entries) ? tx.entries : [];
      const ar = entries.find((e) => typeof e?.accountCode === 'string' && e.accountCode.startsWith('1100-') && (Number(e.debit) || 0) > 0);
      return ar?.accountCode || entries.find((e) => typeof e?.accountCode === 'string' && e.accountCode.startsWith('1100-'))?.accountCode || null;
    };

    let scanned = 0;
    for (let tx = await cursor.next(); tx != null; tx = await cursor.next()) {
      scanned++;
      const monthKey = getMonthKey(tx);
      const arCode = getAr(tx);
      if (!monthKey || !arCode) continue;
      const key = `${monthKey}::${arCode}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tx);
    }

    const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
    let reversed = 0;
    for (const [, list] of dupGroups) {
      const sorted = [...list].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      const keep = sorted[0];
      const toReverse = sorted.slice(1);
      for (const dup of toReverse) {
        dup.status = 'reversed';
        dup.metadata = {
          ...(dup.metadata || {}),
          voidedDuplicate: true,
          voidedAt: new Date().toISOString(),
          keptTransactionId: keep.transactionId || String(keep._id),
        };
        await dup.save();
        reversed++;
      }
    }

    return { scanned, groups: groups.size, duplicateGroups: dupGroups.length, reversed };
  }
}

module.exports = AccrualIntegrityService;

