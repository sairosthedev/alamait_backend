const Application = require('../models/Application');

/**
 * Find an approved application for this student whose lease window overlaps
 * [rangeStart, rangeEnd] (inclusive calendar days; same rule as Booking overlap).
 */
async function findOverlappingApprovedApplication(emailLower, studentId, rangeStart, rangeEnd) {
  const s = new Date(rangeStart);
  const e = new Date(rangeEnd);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) {
    return null;
  }

  const orClause = [];
  if (emailLower) {
    orClause.push({ email: String(emailLower).toLowerCase().trim() });
  }
  if (studentId) {
    orClause.push({ student: studentId });
  }
  if (orClause.length === 0) {
    return null;
  }

  return Application.findOne({
    status: 'approved',
    startDate: { $exists: true, $ne: null, $lte: e },
    endDate: { $exists: true, $ne: null, $gte: s },
    $or: orClause,
  }).lean();
}

/** True when the lease has already ended (end strictly before now). Used to skip snapshot-based capacity rules when backfilling history. */
function isLeasePeriodFullyEnded(endDate, now = new Date()) {
  const e = new Date(endDate);
  if (Number.isNaN(e.getTime())) return false;
  return e < now;
}

module.exports = { findOverlappingApprovedApplication, isLeasePeriodFullyEnded };
