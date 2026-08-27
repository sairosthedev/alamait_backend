const mongoose = require('mongoose');
const Application = require('../models/Application');
const Debtor = require('../models/Debtor');
const TransactionEntry = require('../models/TransactionEntry');
const { Residence } = require('../models/Residence');
const RentalAccrualService = require('./rentalAccrualService');
const TenantAccrualCheckService = require('./tenantAccrualCheckService');
const AccrualCorrectionService = require('./accrualCorrectionService');
const { backfillTransactionsForDebtor } = require('./transactionBackfillService');
const { syncDebtorTotalsWithAR } = require('./debtorService');
const { isHeaderLikeName } = require('../utils/accrualListParser');

/**
 * Unified billing discrepancy detection and repair for admin use.
 * Combines missing accruals, early departures, debtor sync, and external list comparison.
 */
class BillingDiscrepancyService {
    static normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static nameTokens(name) {
        return BillingDiscrepancyService.normalizeName(name).split(' ').filter(Boolean);
    }

    static nameMatchScore(a, b) {
        const tokensA = BillingDiscrepancyService.nameTokens(a);
        const tokensB = BillingDiscrepancyService.nameTokens(b);
        if (!tokensA.length || !tokensB.length) return 0;

        const normA = BillingDiscrepancyService.normalizeName(a);
        const normB = BillingDiscrepancyService.normalizeName(b);
        if (normA === normB) return 1;

        const firstA = tokensA[0];
        const firstB = tokensB[0];
        const lastA = tokensA[tokensA.length - 1];
        const lastB = tokensB[tokensB.length - 1];

        let score = 0;

        if (firstA === firstB) {
            score += 0.45;
        } else if (firstA.length >= 3 && firstB.length >= 3
            && (firstA.startsWith(firstB) || firstB.startsWith(firstA))) {
            score += 0.35;
        }

        if (lastA === lastB) {
            score += 0.45;
        } else if (lastA.length >= 3 && lastB.length >= 3
            && (lastA.startsWith(lastB) || lastB.startsWith(lastA))) {
            score += 0.35;
        }

        return Math.min(1, score);
    }

    static findBestNameMatch(name, candidates, threshold = 0.7) {
        let best = null;
        let bestScore = 0;
        const normSearch = BillingDiscrepancyService.normalizeName(name);

        for (const candidate of candidates) {
            const score = BillingDiscrepancyService.nameMatchScore(name, candidate.studentName);
            const normCandidate = BillingDiscrepancyService.normalizeName(candidate.studentName);
            const effectiveScore = normSearch === normCandidate ? 1 : score;

            if (effectiveScore > bestScore) {
                bestScore = effectiveScore;
                best = { ...candidate, matchScore: effectiveScore };
            }
        }
        return bestScore >= threshold ? best : null;
    }

    /** Prefer the lease active for (or ending just before) the compare month when names duplicate. */
    static rankApplicationForComparePeriod(application, month, year) {
        if (!application?.startDate || !application?.endDate) return 0;

        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        const start = new Date(application.startDate);
        const end = new Date(application.endDate);

        let rank = 0;
        if (start <= monthEnd && end >= monthStart) rank += 1000;
        if (end.getUTCFullYear() === year && end.getUTCMonth() + 1 === month) rank += 500;
        if (end.getUTCFullYear() === year && end.getUTCMonth() + 1 === month - 1) rank += 300;
        if (end <= monthEnd && end >= new Date(year, month - 4, 1)) rank += 100;

        rank += end.getTime() / 1e12;
        return rank;
    }

    static findBestNameMatchForPeriod(name, candidates, month, year, threshold = 0.7) {
        let best = null;
        let bestNameScore = 0;
        let bestPeriodRank = -1;
        const normSearch = BillingDiscrepancyService.normalizeName(name);

        for (const candidate of candidates) {
            const score = BillingDiscrepancyService.nameMatchScore(name, candidate.studentName);
            const normCandidate = BillingDiscrepancyService.normalizeName(candidate.studentName);
            const nameScore = normSearch === normCandidate ? 1 : score;
            if (nameScore < threshold) continue;

            const periodRank = BillingDiscrepancyService.rankApplicationForComparePeriod(
                candidate.application,
                month,
                year
            );

            if (
                nameScore > bestNameScore
                || (nameScore === bestNameScore && periodRank > bestPeriodRank)
            ) {
                bestNameScore = nameScore;
                bestPeriodRank = periodRank;
                best = { ...candidate, matchScore: nameScore, periodRank };
            }
        }

        return best;
    }

    /**
     * Resolve residence from ObjectId, exact name, or partial name (e.g. "Belvedere").
     */
    static async resolveResidenceFilter(input) {
        if (input == null || input === '') return null;

        let value = input;
        if (typeof value === 'object') {
            value = value._id || value.id || value.name || null;
        }
        if (value == null) return null;

        const str = String(value).trim();
        if (!str) return null;

        if (mongoose.Types.ObjectId.isValid(str)) {
            const residence = await Residence.findById(str).select('_id name').lean();
            if (residence) {
                return { id: residence._id.toString(), name: residence.name };
            }
        }

        const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let residence = await Residence.findOne({
            name: new RegExp(`^${escaped}$`, 'i')
        }).select('_id name').lean();

        if (!residence) {
            residence = await Residence.findOne({
                name: new RegExp(escaped, 'i')
            }).select('_id name').lean();
        }

        if (!residence) return null;
        return { id: residence._id.toString(), name: residence.name };
    }

    static async getActiveApplications(filters = {}) {
        const { month, year, residenceId } = filters;
        const now = new Date();
        const query = {
            status: { $in: ['approved', 'expired'] },
            paymentStatus: { $ne: 'cancelled' }
        };

        if (residenceId) {
            Object.assign(query, BillingDiscrepancyService.residenceQuery(residenceId));
        }

        if (month && year) {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
            query.startDate = { $lte: monthEnd };
            query.endDate = { $gte: monthStart };
        } else {
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            query.startDate = { $lte: now };
            query.$or = [
                { endDate: { $gte: now } },
                { endDate: { $gte: threeMonthsAgo, $lt: now } }
            ];
        }

        return Application.find(query)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name rooms')
            .lean();
    }

    static getStudentName(application) {
        if (application.student?.firstName) {
            return `${application.student.firstName} ${application.student.lastName}`.trim();
        }
        const fromApp = `${application.firstName || ''} ${application.lastName || ''}`.trim();
        return fromApp || 'Unknown';
    }

    static async getDebtorForApplication(application) {
        const studentId = application.student?._id || application.student;
        if (!studentId) {
            return Debtor.findOne({ application: application._id }).lean();
        }

        let debtor = await Debtor.findOne({ user: studentId }).lean();
        if (!debtor) {
            debtor = await Debtor.findOne({ application: application._id }).lean();
        }
        if (!debtor && application.residence) {
            debtor = await Debtor.findOne({
                user: studentId,
                residence: application.residence._id || application.residence
            }).lean();
        }
        return debtor;
    }

    /**
     * Link or create a User for applications that have tenant details but no student ref.
     */
    static async ensureStudentForApplication(application, adminUser) {
        const existingId = application.student?._id || application.student;
        if (existingId) {
            const User = require('../models/User');
            const user = await User.findById(existingId);
            if (user) return user;
        }

        const User = require('../models/User');
        const firstName = String(application.firstName || '').trim();
        const lastName = String(application.lastName || '').trim();
        const email = application.email
            ? String(application.email).trim().toLowerCase()
            : null;

        const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (email) {
            const byEmail = await User.findOne({ email });
            if (byEmail) {
                await Application.findByIdAndUpdate(application._id, { student: byEmail._id });
                application.student = byEmail;
                return byEmail;
            }
        }

        if (firstName && lastName) {
            const byName = await User.findOne({
                role: 'student',
                firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
                lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i')
            });
            if (byName) {
                await Application.findByIdAndUpdate(application._id, { student: byName._id });
                application.student = byName;
                return byName;
            }
        }

        const TransactionEntry = require('../models/TransactionEntry');
        const appId = application._id.toString();
        const linkedTx = await TransactionEntry.findOne({
            $or: [
                { 'metadata.applicationId': appId },
                { 'metadata.applicationId': application._id }
            ],
            'metadata.studentId': { $exists: true, $ne: null }
        }).sort({ date: -1 }).select('metadata.studentId').lean();

        if (linkedTx?.metadata?.studentId) {
            const fromTx = await User.findById(linkedTx.metadata.studentId);
            if (fromTx) {
                await Application.findByIdAndUpdate(application._id, { student: fromTx._id });
                application.student = fromTx;
                return fromTx;
            }
        }

        const normalizedEmail = email || `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${(lastName || 'tenant').toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now()}@reconcile.alamait.local`;

        const user = new User({
            email: normalizedEmail,
            firstName,
            lastName,
            phone: application.phone || '',
            password: Math.random().toString(36).slice(-12),
            status: 'active',
            role: 'student',
            isVerified: true,
            applicationCode: application.applicationCode,
            residence: application.residence?._id || application.residence,
            currentRoom: application.allocatedRoom
        });
        await user.save();

        await Application.findByIdAndUpdate(application._id, {
            student: user._id,
            ...(email ? {} : { email: normalizedEmail })
        });
        application.student = user;

        return user;
    }

    /** debtor.user must be a User id — repair legacy rows that stored application id on user. */
    static async repairDebtorUserLink(debtor, user, application) {
        if (!debtor?._id || !user?._id) return debtor;

        const userId = user._id.toString();
        const debtorUserId = debtor.user?._id?.toString() || debtor.user?.toString();
        const appId = application?._id?.toString();

        if (!debtorUserId || debtorUserId === appId || debtorUserId !== userId) {
            await Debtor.findByIdAndUpdate(debtor._id, { user: user._id });
            return Debtor.findById(debtor._id).lean();
        }

        return debtor;
    }

    static async syncDebtorApplicationLink(debtor, application, user = null) {
        if (!debtor?._id || !application?._id) return debtor;

        if (user?._id) {
            debtor = await BillingDiscrepancyService.repairDebtorUserLink(debtor, user, application);
        }

        const appId = application._id.toString();
        const linkedAppId = debtor.application?._id?.toString() || debtor.application?.toString();
        if (linkedAppId === appId) return debtor;

        await Debtor.findByIdAndUpdate(debtor._id, {
            application: application._id,
            residence: application.residence?._id || application.residence || debtor.residence,
            roomNumber: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber || debtor.roomNumber,
            startDate: application.startDate || debtor.startDate,
            endDate: application.endDate || debtor.endDate
        });

        return Debtor.findById(debtor._id).lean();
    }

    static async ensureDebtorForApplication(application, adminUser) {
        let studentLinked = false;
        const priorStudentId = (application.student?._id || application.student)?.toString();

        const user = await BillingDiscrepancyService.ensureStudentForApplication(application, adminUser);
        if (!user?._id) {
            return { debtor: null, error: 'Could not create or link student for application' };
        }

        if (!priorStudentId || priorStudentId !== user._id.toString()) {
            studentLinked = true;
        }
        application.student = user;

        let debtor = await BillingDiscrepancyService.getDebtorForApplication(application);
        if (!debtor) {
            debtor = await Debtor.findOne({ user: user._id }).lean();
        }

        if (debtor) {
            debtor = await BillingDiscrepancyService.repairDebtorUserLink(debtor, user, application);
            debtor = await BillingDiscrepancyService.syncDebtorApplicationLink(debtor, application, user);
            return studentLinked ? { debtor, studentLinked } : debtor;
        }

        let lastError = null;

        try {
            const { createDebtorForExistingStudent } = require('./debtorService');
            const created = await createDebtorForExistingStudent(user._id, {
                application: application._id,
                residenceId: application.residence?._id || application.residence,
                roomNumber: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber,
                startDate: application.startDate,
                endDate: application.endDate,
                createdBy: adminUser?._id || adminUser?.id
            });

            if (created?._id) {
                debtor = await Debtor.findById(created._id).lean();
                if (debtor) {
                    debtor = await BillingDiscrepancyService.syncDebtorApplicationLink(debtor, application, user);
                    return { debtor, studentLinked: true };
                }
            }
        } catch (error) {
            lastError = error.message;
            console.warn(
                `Could not auto-create debtor for ${BillingDiscrepancyService.getStudentName(application)}:`,
                error.message
            );
        }

        debtor = await BillingDiscrepancyService.getDebtorForApplication(application);
        if (!debtor) {
            debtor = await Debtor.findOne({ user: user._id }).lean();
        }
        if (debtor) {
            debtor = await BillingDiscrepancyService.repairDebtorUserLink(debtor, user, application);
            debtor = await BillingDiscrepancyService.syncDebtorApplicationLink(debtor, application, user);
        }
        return {
            debtor: debtor || null,
            error: debtor ? null : (lastError || 'Debtor could not be created'),
            studentLinked: debtor ? studentLinked : undefined
        };
    }

    static extractRentAmountFromTransaction(tx) {
        if (!tx) return 0;
        const rentEntry = (tx.entries || []).find(e =>
            e.accountCode === '4001'
            || String(e.accountName || '').toLowerCase().includes('rent')
            || String(e.accountName || '').toLowerCase().includes('accommodation')
        );
        if (rentEntry?.credit) return Math.round(rentEntry.credit * 100) / 100;
        if (tx.totalDebit) return Math.round(tx.totalDebit * 100) / 100;
        return 0;
    }

    static async findMonthlyAccrualTransaction(application, debtor, studentId, month, year) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const applicationId = application._id.toString();
        const debtorId = debtor?._id?.toString();
        const sid = studentId?.toString();
        const studentName = BillingDiscrepancyService.getStudentName(application);

        const identityOr = [
            { 'metadata.applicationId': applicationId },
            { 'metadata.applicationId': application._id },
            ...(sid ? [
                { 'metadata.studentId': sid },
                { 'metadata.userId': sid },
                { sourceId: sid }
            ] : []),
            { 'metadata.studentId': applicationId },
            { sourceId: application._id }
        ];

        if (debtorId) {
            identityOr.push(
                { 'metadata.debtorId': debtorId },
                { sourceModel: 'Debtor', sourceId: debtorId },
                { sourceModel: 'Debtor', sourceId: new mongoose.Types.ObjectId(debtorId) },
                { 'entries.accountCode': `1100-${debtorId}` }
            );
        }
        if (debtor?.accountCode) {
            identityOr.push({ 'entries.accountCode': debtor.accountCode });
        }

        const nameTokens = BillingDiscrepancyService.nameTokens(studentName).filter(t => t.length > 2);
        if (nameTokens.length >= 2) {
            identityOr.push({
                description: new RegExp(
                    `${nameTokens[0]}.*${nameTokens[nameTokens.length - 1]}|${nameTokens[nameTokens.length - 1]}.*${nameTokens[0]}`,
                    'i'
                )
            });
        }

        const monthOr = [
            { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
            { 'metadata.accrualMonth': String(month), 'metadata.accrualYear': String(year) },
            { 'metadata.month': monthKey },
            { description: { $regex: new RegExp(`${monthKey}|\\b${month}\\b[/\\-]\\s*${year}\\b`, 'i') } }
        ];

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const tx = await TransactionEntry.findOne({
            source: 'rental_accrual',
            status: { $nin: ['deleted', 'reversed'] },
            $and: [
                {
                    $or: [
                        { 'metadata.type': 'monthly_rent_accrual' },
                        { description: { $regex: /monthly.*(rent|accrual)/i } }
                    ]
                },
                { $or: monthOr },
                { $or: identityOr }
            ]
        }).sort({ date: -1 }).lean();

        if (tx) return tx;

        return TransactionEntry.findOne({
            source: 'rental_accrual',
            status: { $nin: ['deleted', 'reversed'] },
            date: { $gte: monthStart, $lte: monthEnd },
            $or: identityOr
        }).sort({ date: -1 }).lean();
    }

    static getExpectedMonthlyRent(application) {
        const roomNumber = application.allocatedRoom
            || application.allocatedRoomDetails?.roomNumber
            || application.roomNumber;
        const rooms = application.residence?.rooms || [];
        const room = rooms.find(r =>
            r.roomNumber === roomNumber || r._id?.toString() === roomNumber
        );
        return room?.price || application.monthlyRent || 0;
    }

    static async getAccrualForMonth(application, debtor, month, year) {
        const studentId = application.student?._id?.toString() || application.student?.toString();
        const leaseStartMonth = new Date(application.startDate).getMonth() + 1;
        const leaseStartYear = new Date(application.startDate).getFullYear();

        if (month === leaseStartMonth && year === leaseStartYear) {
            return BillingDiscrepancyService.getLeaseStartAccrual(application, debtor, month, year);
        }

        const existing = await RentalAccrualService.checkExistingMonthlyAccrual(
            studentId,
            month,
            year,
            application._id,
            debtor?._id?.toString()
        );

        const tx = existing || await BillingDiscrepancyService.findMonthlyAccrualTransaction(
            application, debtor, studentId, month, year
        );

        if (!tx) {
            return { type: 'monthly_rent_accrual', exists: false, amount: 0, transaction: null };
        }

        return {
            type: 'monthly_rent_accrual',
            exists: true,
            amount: BillingDiscrepancyService.extractRentAmountFromTransaction(tx),
            transaction: tx
        };
    }

    static async getLeaseStartAccrual(application, debtor, month, year) {
        const debtorId = debtor?._id?.toString();
        const leaseStart = await TransactionEntry.findOne({
            source: 'rental_accrual',
            'metadata.type': 'lease_start',
            status: { $nin: ['deleted', 'reversed'] },
            $or: [
                { 'metadata.applicationId': application._id.toString() },
                { 'metadata.applicationId': application._id },
                { 'metadata.applicationCode': application.applicationCode },
                ...(debtorId ? [{ 'metadata.debtorId': debtorId }] : [])
            ]
        }).lean();

        if (!leaseStart) {
            return { type: 'lease_start', exists: false, amount: 0, transaction: null };
        }

        return {
            type: 'lease_start',
            exists: true,
            amount: BillingDiscrepancyService.extractRentAmountFromTransaction(leaseStart),
            transaction: leaseStart
        };
    }

    static getIssueCategory(issueType) {
        if (issueType === 'extra_accrual') return 'lease';
        if (['missing_lease_start', 'missing_monthly_accrual', 'missing_debtor', 'amount_mismatch', 'debtor_out_of_sync'].includes(issueType)) {
            return 'rent_accrual';
        }
        return 'other';
    }

    static getFixOwner(issueType) {
        if (issueType === 'extra_accrual') return 'admin';
        if (['missing_lease_start', 'missing_monthly_accrual', 'missing_debtor', 'amount_mismatch', 'debtor_out_of_sync'].includes(issueType)) {
            return 'admin_or_finance';
        }
        return 'admin_or_finance';
    }

    static getSuggestedAction(issueType, fixAction) {
        const byAction = {
            add_student: 'Admin: add tenant via Admin → Add Tenant / CSV upload',
            update_lease_end: 'Admin: update lease end date (student left early or not on actual list)',
            extend_lease_end: 'Admin: extend lease to month-end when it was cut short, then accrue rent',
            reconcile_accrual: 'Create missing rent accrual from lease/transaction backfill',
            negotiate: 'Admin or finance: adjust ledger rent to match Excel actual (discount or increase)',
            review: 'Review manually — actual exceeds system accrual'
        };
        if (fixAction && byAction[fixAction]) return byAction[fixAction];

        const actions = {
            missing_debtor: 'Admin or finance: run rent accrual reconciliation (backfill + sync debtor)',
            missing_lease_start: 'Admin or finance: run rent accrual reconciliation to create lease_start entry',
            missing_monthly_accrual: 'Admin or finance: run rent accrual reconciliation to create monthly_rent_accrual',
            extra_accrual: 'Admin: update lease end date, then run rent accrual reconciliation',
            amount_mismatch: 'Admin or finance: negotiate to match Excel actual amount',
            student_not_in_system: 'Admin: add student manually or via CSV import',
            name_mismatch: 'Verify student identity; may be spelling variation',
            debtor_out_of_sync: 'Admin or finance: run rent accrual reconciliation to sync debtor AR totals'
        };
        return actions[issueType] || 'Review and reconcile';
    }

    static buildAvailableActions({ fixAction, status, dbAccrualAmount, actualAmount, dbEffectiveAmount, leaseCutShort = false }) {
        const actions = [];
        if (fixAction === 'add_student') actions.push('add_student');
        if (fixAction === 'update_lease_end') actions.push('update_lease_end');
        if (fixAction === 'reconcile_accrual') actions.push('reconcile_accrual');
        if (leaseCutShort) actions.push('extend_lease_end');
        if (fixAction === 'negotiate') actions.push('negotiate');
        if (fixAction === 'review') actions.push('review');
        if (status === 'match' || status === 'match_after_negotiation' || status === 'name_spelling_variation') {
            actions.push('none');
            return [...new Set(actions)];
        }
        const effective = dbEffectiveAmount ?? dbAccrualAmount;
        if (
            effective != null && actualAmount != null
            && effective > actualAmount + 0.01
            && !actions.includes('negotiate')
        ) {
            actions.push('negotiate');
        }
        if (
            effective != null && actualAmount != null
            && actualAmount > effective + 0.01
            && !actions.includes('negotiate')
        ) {
            actions.push('negotiate');
        }
        return [...new Set(actions)];
    }

    static comparisonUiCategory(comparison) {
        if (comparison.fixAction === 'reconcile_accrual' || comparison.status === 'missing_accrual') {
            return 'reconcile';
        }
        if (comparison.fixAction === 'negotiate'
            || comparison.status === 'amount_higher_in_system'
            || comparison.status === 'amount_lower_in_system') {
            return 'negotiate';
        }
        if (comparison.fixAction === 'add_student') return 'manual';
        if (['match', 'match_after_negotiation', 'name_spelling_variation'].includes(comparison.status)) {
            return 'matched';
        }
        return 'review';
    }

    static gapReasonForComparison(comparison) {
        if (comparison.leaseCutShort) {
            return `Lease ends ${comparison.currentLeaseEnd || 'early in month'} — extend to ${comparison.suggestedLeaseEnd || 'month-end'} or reconcile with actual amount`;
        }
        if (comparison.status === 'missing_accrual') {
            if (comparison.notOnIncomeStatementLedger) {
                return 'Excel expects rent but $0 on income statement — accrual never posted or was reversed (e.g. left-early cleanup)';
            }
            return 'Missing June 4001 accrual for this tenant';
        }
        if (comparison.status === 'amount_lower_in_system') {
            return 'System effective rent is below Excel actual — negotiate up to match monthly room rate';
        }
        if (comparison.status === 'amount_higher_in_system' || comparison.fixAction === 'negotiate') {
            return 'System effective rent is above Excel actual — negotiate down';
        }
        if (comparison.status === 'missing_from_system') {
            return 'Student not found in system — add tenant';
        }
        return null;
    }

    static buildGapBreakdown(comparisons, tolerance = 0.01) {
        const rows = comparisons
            .map(c => {
                const effective = c.dbEffectiveAmount ?? 0;
                const actual = c.actualAmount ?? 0;
                const gapAmount = Math.round((actual - effective) * 100) / 100;
                if (gapAmount <= tolerance) return null;
                return {
                    actualName: c.actualName,
                    dbStudentName: c.dbStudentName,
                    actualAmount: actual,
                    dbEffectiveAmount: effective,
                    dbAccrualAmount: c.dbAccrualAmount,
                    gapAmount,
                    status: c.status,
                    issueType: c.issueType,
                    fixAction: c.fixAction,
                    uiCategory: c.uiCategory || BillingDiscrepancyService.comparisonUiCategory(c),
                    reason: BillingDiscrepancyService.gapReasonForComparison(c),
                    applicationId: c.applicationId,
                    studentId: c.studentId,
                    notOnIncomeStatementLedger: c.notOnIncomeStatementLedger,
                    onIncomeStatementLedger: c.onIncomeStatementLedger
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.gapAmount - a.gapAmount);

        const total = Math.round(rows.reduce((sum, r) => sum + r.gapAmount, 0) * 100) / 100;
        return {
            total,
            rowCount: rows.length,
            explanation: total > 0
                ? `$${total} = Excel actual minus system effective for ${rows.length} tenant(s) not fully on the ledger`
                : 'No gap — Excel matches upload-matched system total',
            formula: 'gapActualVsUploadMatched = actualTotal − uploadMatchedEffectiveTotal = sum(gapAmount per row below)',
            rows
        };
    }

    static async getSystemRentAmountsForMonth(application, debtor, studentId, month, year, rentLedger = null) {
        const { lookupStudentRentFromLedger } = require('../utils/incomeStatementRentUtils');

        if (rentLedger?.lookup) {
            const ledgerHit = lookupStudentRentFromLedger(rentLedger.lookup, {
                studentId: studentId?.toString(),
                applicationId: application._id?.toString(),
                debtorId: debtor?._id?.toString(),
                debtorAccountCode: debtor?.accountCode
            });

            if (ledgerHit) {
                return {
                    hasAccrual: ledgerHit.hasAccrual,
                    accrualTransactionId: ledgerHit.transactionId,
                    dbAccrualAmount: ledgerHit.grossAmount,
                    negotiationDiscount: ledgerHit.negotiationDiscount,
                    dbEffectiveAmount: ledgerHit.netAmount,
                    dbAmount: ledgerHit.netAmount,
                    accrual: ledgerHit.transaction,
                    ledgerSource: 'income_statement_4001'
                };
            }

            // Income-statement ledger is authoritative — raw accruals reversed off the ledger must not count
            return {
                hasAccrual: false,
                accrualTransactionId: null,
                dbAccrualAmount: 0,
                negotiationDiscount: 0,
                dbEffectiveAmount: 0,
                dbAmount: 0,
                accrual: null,
                ledgerSource: 'income_statement_4001_not_on_ledger'
            };
        }

        const accrual = await BillingDiscrepancyService.getAccrualForMonth(
            application, debtor, month, year
        );

        const debtorId = debtor?._id?.toString();
        const sid = studentId?.toString();

        let negotiationDiscount = 0;
        if (sid || debtorId) {
            const negQuery = {
                status: 'posted',
                $or: [
                    { 'metadata.transactionType': 'negotiated_payment_adjustment' },
                    { 'metadata.type': 'negotiated_payment_adjustment' }
                ],
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year
            };
            negQuery.$and = [{
                $or: [
                    ...(sid ? [{ 'metadata.studentId': sid }] : []),
                    ...(debtorId ? [{ 'metadata.debtorId': debtorId }] : [])
                ]
            }];
            const negotiations = await TransactionEntry.find(negQuery).lean();
            for (const n of negotiations) {
                negotiationDiscount += n.metadata?.discountAmount
                    || n.metadata?.negotiatedDiscount
                    || 0;
            }
        }

        const accrualAmount = accrual.exists ? accrual.amount : 0;
        const effectiveAmount = Math.round((accrualAmount - negotiationDiscount) * 100) / 100;

        return {
            hasAccrual: accrual.exists,
            accrualTransactionId: accrual.transaction?._id?.toString() || null,
            dbAccrualAmount: accrualAmount,
            negotiationDiscount: Math.round(negotiationDiscount * 100) / 100,
            dbEffectiveAmount: effectiveAmount,
            dbAmount: effectiveAmount,
            accrual,
            ledgerSource: 'accrual_lookup_fallback'
        };
    }

    static buildIssue(application, issueType, details = {}) {
        const studentId = application.student?._id?.toString() || application.student?.toString();
        const category = BillingDiscrepancyService.getIssueCategory(issueType);
        return {
            issueType,
            category,
            fixedBy: BillingDiscrepancyService.getFixOwner(issueType),
            applicationId: application._id.toString(),
            applicationCode: application.applicationCode,
            studentId,
            studentName: BillingDiscrepancyService.getStudentName(application),
            residence: application.residence?.name || null,
            leaseStart: application.startDate,
            leaseEnd: application.endDate,
            suggestedAction: BillingDiscrepancyService.getSuggestedAction(issueType, details.fixAction),
            ...details
        };
    }

    /**
     * Scan all tenants for billing issues in a given month/year.
     */
    static async scanPeriod({ month, year, residenceId, tolerance = 0.01 } = {}) {
        const now = new Date();
        const scanMonth = month || now.getMonth() + 1;
        const scanYear = year || now.getFullYear();

        const applications = await BillingDiscrepancyService.getActiveApplications({
            month: scanMonth,
            year: scanYear,
            residenceId
        });

        const issues = [];
        const healthy = [];
        let totalExpected = 0;
        let totalActual = 0;

        for (const application of applications) {
            const studentName = BillingDiscrepancyService.getStudentName(application);
            const debtor = await BillingDiscrepancyService.getDebtorForApplication(application);
            const expectedRent = BillingDiscrepancyService.getExpectedMonthlyRent(application);
            const shouldAccrue = RentalAccrualService.shouldAccrueMonthForLease(
                application.startDate,
                application.endDate,
                scanMonth,
                scanYear
            );

            if (!debtor) {
                issues.push(BillingDiscrepancyService.buildIssue(application, 'missing_debtor', {
                    month: scanMonth,
                    year: scanYear,
                    expectedAmount: expectedRent
                }));
                continue;
            }

            if (!shouldAccrue) {
                const accrual = await BillingDiscrepancyService.getAccrualForMonth(
                    application, debtor, scanMonth, scanYear
                );
                if (accrual.exists) {
                    issues.push(BillingDiscrepancyService.buildIssue(application, 'extra_accrual', {
                        month: scanMonth,
                        year: scanYear,
                        actualAmount: accrual.amount,
                        transactionId: accrual.transaction?._id?.toString()
                    }));
                }
                continue;
            }

            const accrual = await BillingDiscrepancyService.getAccrualForMonth(
                application, debtor, scanMonth, scanYear
            );

            if (!accrual.exists) {
                const issueType = accrual.type === 'lease_start' ? 'missing_lease_start' : 'missing_monthly_accrual';
                issues.push(BillingDiscrepancyService.buildIssue(application, issueType, {
                    month: scanMonth,
                    year: scanYear,
                    expectedAmount: expectedRent
                }));
                totalExpected += expectedRent;
                continue;
            }

            totalExpected += expectedRent;
            totalActual += accrual.amount;

            if (Math.abs(accrual.amount - expectedRent) > tolerance && expectedRent > 0) {
                issues.push(BillingDiscrepancyService.buildIssue(application, 'amount_mismatch', {
                    month: scanMonth,
                    year: scanYear,
                    expectedAmount: expectedRent,
                    actualAmount: accrual.amount,
                    difference: Math.round((accrual.amount - expectedRent) * 100) / 100,
                    transactionId: accrual.transaction?._id?.toString()
                }));
            } else {
                healthy.push({
                    studentName,
                    applicationId: application._id.toString(),
                    studentId: application.student?._id?.toString() || application.student?.toString(),
                    expectedAmount: expectedRent,
                    actualAmount: accrual.amount,
                    month: scanMonth,
                    year: scanYear
                });
            }
        }

        const earlyLeaveResult = await AccrualCorrectionService.findStudentsWithIncorrectAccruals(scanYear, scanMonth);
        const earlyLeaveIssues = (earlyLeaveResult.issues || []).map(s => ({
            issueType: 'extra_accrual',
            category: 'lease',
            fixedBy: 'admin',
            applicationId: s.applicationId || s.studentId,
            studentId: s.studentId,
            studentName: s.studentName,
            leaseEnd: s.leaseEndDate,
            incorrectAccrualsCount: s.incorrectAccrualsCount,
            suggestedAction: BillingDiscrepancyService.getSuggestedAction('extra_accrual')
        }));

        const existingIds = new Set(issues.map(i => i.applicationId));
        for (const el of earlyLeaveIssues) {
            const appId = el.applicationId || el.studentId;
            if (!existingIds.has(appId)) {
                issues.push(el);
            }
        }

        const rentAccrualIssues = issues.filter(i => i.category === 'rent_accrual');
        const leaseIssues = issues.filter(i => i.category === 'lease');

        return {
            success: true,
            period: { month: scanMonth, year: scanYear },
            summary: {
                tenantsScanned: applications.length,
                issueCount: issues.length,
                rentAccrualIssueCount: rentAccrualIssues.length,
                leaseIssueCount: leaseIssues.length,
                healthyCount: healthy.length,
                totalExpected: Math.round(totalExpected * 100) / 100,
                totalActual: Math.round(totalActual * 100) / 100,
                difference: Math.round((totalActual - totalExpected) * 100) / 100
            },
            issues,
            rentAccrualIssues,
            leaseIssues,
            healthy,
            workflow: {
                admin: 'Lease dates + rent accrual reconciliation (missing lease_start / monthly_rent_accrual)',
                finance: 'Rent accrual reconciliation + payments + negotiations'
            }
        };
    }

    /**
     * Compare an external list (e.g. spreadsheet) against system accruals.
     * entries: [{ name, amount }]
     */
    static async compareExternalList({ entries, month, year, residenceId, tolerance = 0.01 }) {
        const now = new Date();
        const scanMonth = month || now.getMonth() + 1;
        const scanYear = year || now.getFullYear();

        const scan = await BillingDiscrepancyService.scanPeriod({
            month: scanMonth,
            year: scanYear,
            residenceId,
            tolerance
        });

        const systemStudents = [];
        for (const application of await BillingDiscrepancyService.getActiveApplications({
            month: scanMonth,
            year: scanYear,
            residenceId
        })) {
            const debtor = await BillingDiscrepancyService.getDebtorForApplication(application);
            const accrual = await BillingDiscrepancyService.getAccrualForMonth(
                application, debtor, scanMonth, scanYear
            );
            systemStudents.push({
                applicationId: application._id.toString(),
                studentId: application.student?._id?.toString() || application.student?.toString(),
                studentName: BillingDiscrepancyService.getStudentName(application),
                systemAmount: accrual.exists ? accrual.amount : 0,
                hasAccrual: accrual.exists,
                expectedRent: BillingDiscrepancyService.getExpectedMonthlyRent(application)
            });
        }

        const comparisons = [];
        const matchedSystemIds = new Set();
        let externalTotal = 0;
        let systemMatchedTotal = 0;

        for (const entry of entries || []) {
            const externalAmount = parseFloat(entry.amount) || 0;
            externalTotal += externalAmount;

            const match = BillingDiscrepancyService.findBestNameMatch(entry.name, systemStudents);
            if (!match) {
                comparisons.push({
                    externalName: entry.name,
                    externalAmount,
                    systemName: null,
                    systemAmount: null,
                    status: 'not_in_system',
                    issueType: 'student_not_in_system',
                    suggestedAction: BillingDiscrepancyService.getSuggestedAction('student_not_in_system')
                });
                continue;
            }

            matchedSystemIds.add(match.applicationId);
            systemMatchedTotal += match.systemAmount;

            const nameScore = match.matchScore;
            const amountDiff = Math.round((match.systemAmount - externalAmount) * 100) / 100;
            let status = 'match';
            let issueType = null;

            if (nameScore < 0.95) {
                status = 'name_mismatch';
                issueType = 'name_mismatch';
            } else if (!match.hasAccrual) {
                status = 'missing_accrual';
                issueType = 'missing_monthly_accrual';
            } else if (Math.abs(amountDiff) > tolerance) {
                status = 'amount_mismatch';
                issueType = 'amount_mismatch';
            }

            comparisons.push({
                externalName: entry.name,
                externalAmount,
                systemName: match.studentName,
                systemAmount: match.systemAmount,
                expectedRent: match.expectedRent,
                applicationId: match.applicationId,
                studentId: match.studentId,
                nameMatchScore: Math.round(nameScore * 100) / 100,
                amountDifference: amountDiff,
                status,
                issueType,
                suggestedAction: issueType
                    ? BillingDiscrepancyService.getSuggestedAction(issueType)
                    : null
            });
        }

        const inSystemOnly = systemStudents.filter(s => !matchedSystemIds.has(s.applicationId));

        return {
            success: true,
            period: { month: scanMonth, year: scanYear },
            summary: {
                externalCount: (entries || []).length,
                externalTotal: Math.round(externalTotal * 100) / 100,
                systemMatchedTotal: Math.round(systemMatchedTotal * 100) / 100,
                inSystemOnlyCount: inSystemOnly.length,
                mismatchCount: comparisons.filter(c => c.status !== 'match').length,
                scanIssueCount: scan.summary.issueCount
            },
            comparisons,
            inSystemOnly: inSystemOnly.map(s => ({
                ...s,
                issueType: s.hasAccrual ? null : 'missing_monthly_accrual',
                suggestedAction: s.hasAccrual
                    ? 'Student in system but not on external list'
                    : BillingDiscrepancyService.getSuggestedAction('missing_monthly_accrual')
            })),
            systemScan: scan
        };
    }

    /**
     * Rent accrual reconciliation for one student:
     * backfill transactions, create missing lease_start / monthly_rent_accrual, sync debtor AR.
     */
    /**
     * When the same student has multiple applications, pick the one active in month/year.
     */
    static async resolveApplicationForReconcilePeriod({ application, studentId, month, year }) {
        if (!application || !month || !year) return application;

        const currentRank = BillingDiscrepancyService.rankApplicationForComparePeriod(
            application, month, year
        );
        if (currentRank >= 1000) return application;

        const userStudentId = application.student?._id?.toString()
            || application.student?.toString()
            || studentId?.toString();
        if (!userStudentId) return application;

        const siblings = await Application.find({
            $or: [
                { student: userStudentId },
                {
                    firstName: application.firstName,
                    lastName: application.lastName,
                    email: application.email
                }
            ],
            status: { $in: ['approved', 'expired'] },
            paymentStatus: { $ne: 'cancelled' }
        })
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name rooms')
            .sort({ endDate: -1 });

        let best = application;
        let bestRank = currentRank;
        for (const candidate of siblings) {
            const rank = BillingDiscrepancyService.rankApplicationForComparePeriod(candidate, month, year);
            if (rank > bestRank) {
                bestRank = rank;
                best = candidate;
            }
        }

        return best;
    }

    static async reconcileRentAccruals({
        applicationId,
        studentId,
        actualLeaseEndDate,
        allowLeaseUpdate = false,
        month,
        year,
        actualAmount,
        dryRun = false,
        adminUser
    }) {
        let application = null;

        if (applicationId) {
            application = await Application.findById(applicationId)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name rooms');
        } else if (studentId) {
            application = await Application.findOne({
                student: studentId,
                status: { $in: ['approved', 'expired'] },
                paymentStatus: { $ne: 'cancelled' }
            })
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name rooms')
                .sort({ endDate: -1 });
        }

        if (!application) {
            return { success: false, error: 'Application not found for student' };
        }

        application = await BillingDiscrepancyService.resolveApplicationForReconcilePeriod({
            application,
            studentId,
            month,
            year
        });

        const studentName = BillingDiscrepancyService.getStudentName(application);
        const resolvedApplicationId = application._id.toString();
        const actions = [];
        const errors = [];
        const userStudentId = application.student?._id?.toString()
            || application.student?.toString()
            || studentId?.toString();

        if (dryRun) {
            const validation = await TenantAccrualCheckService.validateTenantAccruals(
                application._id.toString(),
                false
            );
            const scanMonth = month || new Date().getMonth() + 1;
            const scanYear = year || new Date().getFullYear();
            const debtor = await BillingDiscrepancyService.getDebtorForApplication(application);
            const accrual = await BillingDiscrepancyService.getAccrualForMonth(
                application, debtor, scanMonth, scanYear
            );

            return {
                success: true,
                dryRun: true,
                type: 'rent_accrual_reconciliation',
                studentName,
                applicationId: resolvedApplicationId,
                wouldFix: {
                    updateLeaseEnd: !!(allowLeaseUpdate && actualLeaseEndDate),
                    missingLeaseStart: validation.validation && !validation.validation.leaseStartExists,
                    missingMonthly: validation.validation?.monthlyAccruals?.missing || [],
                    missingDebtor: !debtor,
                    missingAccrualForPeriod: !accrual.exists
                },
                validation: validation.validation || validation
            };
        }

        if (applicationId && String(applicationId) !== resolvedApplicationId) {
            actions.push({
                step: 'resolve_application',
                success: true,
                requestedApplicationId: String(applicationId),
                resolvedApplicationId
            });
        }

        if (allowLeaseUpdate && actualLeaseEndDate && userStudentId) {
            const LeaseUpdateService = require('./leaseUpdateService');
            try {
                const leaseResult = await LeaseUpdateService.updateStudentLeaseDates(
                    userStudentId,
                    {
                        startDate: application.startDate,
                        endDate: actualLeaseEndDate
                    },
                    adminUser?._id || adminUser?.id,
                    { applicationId: application._id.toString() }
                );
                actions.push({
                    step: 'update_lease_end',
                    success: true,
                    endDate: actualLeaseEndDate,
                    result: leaseResult
                });
                application = await Application.findById(application._id)
                    .populate('student', 'firstName lastName email')
                    .populate('residence', 'name rooms');
            } catch (leaseError) {
                actions.push({ step: 'update_lease_end', success: false, error: leaseError.message });
                errors.push({ step: 'update_lease_end', error: leaseError.message });
            }
        } else if (allowLeaseUpdate && actualLeaseEndDate) {
            const skipReason = !userStudentId
                ? 'No student linked to application'
                : 'Lease update skipped';
            actions.push({ step: 'update_lease_end', success: false, error: skipReason });
            errors.push({ step: 'update_lease_end', error: skipReason });
        }

        const debtorResult = await BillingDiscrepancyService.ensureDebtorForApplication(application, adminUser);
        const debtor = debtorResult?.debtor ?? debtorResult;

        if (!debtor) {
            errors.push({
                step: 'debtor',
                error: debtorResult?.error || 'No debtor record — add student or create debtor first'
            });
        } else {
            if (debtorResult?.studentLinked) {
                actions.push({
                    step: 'ensure_student',
                    success: true,
                    studentId: (application.student?._id || application.student)?.toString()
                });
            }
            actions.push({ step: 'ensure_debtor', success: true, debtorId: debtor._id.toString() });
            const backfillResult = await backfillTransactionsForDebtor(debtor, { manual: true });
            actions.push({
                step: 'backfill',
                success: backfillResult.success !== false,
                leaseStartCreated: backfillResult.leaseStartCreated || 0,
                monthlyCreated: backfillResult.monthlyTransactionsCreated || 0
            });
        }

        const validationResult = await TenantAccrualCheckService.validateTenantAccruals(
            application._id.toString(),
            true
        );
        actions.push({
            step: 'validate_accruals',
            success: validationResult.success,
            missingBefore: validationResult.validation?.monthlyAccruals?.missing?.length || 0,
            isValid: validationResult.validation?.isValid
        });

        if (month && year && debtor) {
            const shouldAccrue = RentalAccrualService.shouldAccrueMonthForLease(
                application.startDate,
                application.endDate,
                month,
                year
            );
            const parsedActualAmount = actualAmount != null && actualAmount !== ''
                ? Math.round(Number(actualAmount) * 100) / 100
                : null;
            const forceAccrue = !shouldAccrue && parsedActualAmount != null && parsedActualAmount > 0;

            if (shouldAccrue || forceAccrue) {
                const resolvedStudentId = application.student?._id
                    || application.student
                    || debtor?.user?._id
                    || debtor?.user;
                const studentData = {
                    student: resolvedStudentId,
                    firstName: application.student?.firstName || application.firstName,
                    lastName: application.student?.lastName || application.lastName,
                    email: application.student?.email || application.email || '',
                    residence: application.residence?._id || application.residence,
                    allocatedRoom: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    application: application._id,
                    applicationCode: application.applicationCode,
                    debtor: debtor?._id?.toString(),
                    debtorAccountCode: debtor?.accountCode
                };
                const createOptions = forceAccrue
                    ? { forceAccrue: true, rentAmount: parsedActualAmount }
                    : {};
                const createResult = await RentalAccrualService.createStudentRentAccrual(
                    studentData,
                    month,
                    year,
                    createOptions
                );
                actions.push({
                    step: 'create_period_accrual',
                    success: createResult.success,
                    amount: createResult.amount,
                    forced: forceAccrue,
                    message: createResult.error || 'Created'
                });
                if (!createResult.success) {
                    const alreadyExists = String(createResult.error || '')
                        .toLowerCase()
                        .includes('already exists');
                    const existingTxId = createResult.existingTransaction?.toString?.()
                        || createResult.existingTransaction;
                    let voidedByReversal = false;
                    if (alreadyExists && existingTxId) {
                        voidedByReversal = !(await RentalAccrualService.existingAccrualBlocksCreate({
                            _id: existingTxId
                        }));
                    }
                    if (alreadyExists && !voidedByReversal) {
                        actions[actions.length - 1].success = true;
                        actions[actions.length - 1].skipped = true;
                        actions[actions.length - 1].message = createResult.error;
                    } else if (!createResult.success) {
                        errors.push({ step: 'create_period_accrual', error: createResult.error });
                    }
                }
            } else {
                actions.push({
                    step: 'create_period_accrual',
                    success: false,
                    skipped: true,
                    message: `Lease ended early in ${month}/${year} — include actualAmount to accrue from reconciliation`
                });
            }
        }

        if (debtor) {
            try {
                await syncDebtorTotalsWithAR(debtor._id.toString());
                actions.push({ step: 'sync_debtor', success: true });
            } catch (syncError) {
                actions.push({ step: 'sync_debtor', success: false, error: syncError.message });
                errors.push({ step: 'sync_debtor', error: syncError.message });
            }
        }

        const leaseUpdateRequested = allowLeaseUpdate && actualLeaseEndDate;
        const leaseUpdateSucceeded = actions.some(a => a.step === 'update_lease_end' && a.success);
        const leaseUpdateFailed = actions.some(a => a.step === 'update_lease_end' && a.success === false);

        const success = leaseUpdateRequested
            ? leaseUpdateSucceeded && !leaseUpdateFailed
            : errors.length === 0;

        return {
            success,
            type: 'rent_accrual_reconciliation',
            studentName,
            applicationId: application._id.toString(),
            actions,
            errors
        };
    }

    /** @deprecated use reconcileRentAccruals */
    static async reconcileStudent(opts) {
        return BillingDiscrepancyService.reconcileRentAccruals(opts);
    }

    /**
     * Bulk reconcile multiple students or all issues from a scan.
     */
    static async bulkReconcile({
        targets,
        month,
        year,
        dryRun = false,
        allowLeaseUpdate = false,
        adminUser
    }) {
        const results = [];
        let fixed = 0;
        let failed = 0;

        for (const target of targets || []) {
            try {
                const result = await BillingDiscrepancyService.reconcileRentAccruals({
                    applicationId: target.applicationId,
                    studentId: target.studentId,
                    actualLeaseEndDate: target.actualLeaseEndDate,
                    allowLeaseUpdate,
                    month: target.month || month,
                    year: target.year || year,
                    dryRun,
                    adminUser
                });
                results.push(result);
                if (result.success) fixed++;
                else failed++;
            } catch (error) {
                failed++;
                results.push({
                    success: false,
                    applicationId: target.applicationId,
                    studentId: target.studentId,
                    error: error.message
                });
            }
        }

        return {
            success: failed === 0,
            dryRun,
            summary: {
                total: (targets || []).length,
                fixed,
                failed
            },
            results
        };
    }

    /**
     * Auto-fix all fixable issues from a period scan.
     */
    static async autoFixPeriod({ month, year, residenceId, dryRun = false, allowLeaseUpdate = false, adminUser }) {
        const scan = await BillingDiscrepancyService.scanPeriod({ month, year, residenceId });

        const fixableTypes = new Set([
            'missing_lease_start',
            'missing_monthly_accrual',
            'missing_debtor'
        ]);

        // Only rent accrual issues — lease/extra_accrual requires admin lease update first
        const targets = (scan.rentAccrualIssues || scan.issues)
            .filter(i => fixableTypes.has(i.issueType))
            .map(i => ({
                applicationId: i.applicationId,
                studentId: i.studentId,
                month: i.month || month,
                year: i.year || year
            }));

        const uniqueTargets = [];
        const seen = new Set();
        for (const t of targets) {
            const key = t.applicationId || t.studentId;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueTargets.push(t);
            }
        }

        if (dryRun) {
            return {
                success: true,
                dryRun: true,
                scan: scan.summary,
                wouldFixCount: uniqueTargets.length,
                targets: uniqueTargets
            };
        }

        const bulkResult = await BillingDiscrepancyService.bulkReconcile({
            targets: uniqueTargets,
            month,
            year,
            dryRun: false,
            allowLeaseUpdate,
            adminUser
        });

        const rescan = await BillingDiscrepancyService.scanPeriod({ month, year, residenceId });

        return {
            success: bulkResult.success,
            before: scan.summary,
            after: rescan.summary,
            bulkResult
        };
    }

    static defaultEarlyLeaveEndDate(month, year) {
        const { calendarDateUtc } = require('../utils/calendarDate');
        return calendarDateUtc(year, month, 0);
    }

    /** Last calendar day of month/year (e.g. June 2026 → 2026-06-30). */
    static defaultExtendLeaseEndDate(month, year) {
        const { calendarDateUtc } = require('../utils/calendarDate');
        return calendarDateUtc(year, month + 1, 0);
    }

    /**
     * End date for "left early" — day before reconcile month, but never before lease start.
     */
    static resolveEarlyLeaveEndDate(application, month, year, explicitEnd = null) {
        const {
            parseCalendarDate,
            getCalendarParts,
            calendarDateUtc,
            toCalendarIso
        } = require('../utils/calendarDate');

        const start = parseCalendarDate(application?.startDate);
        let candidate = explicitEnd
            ? parseCalendarDate(explicitEnd)
            : (month && year ? calendarDateUtc(year, month, 0) : parseCalendarDate(application?.endDate));

        if (!start || !candidate) {
            return explicitEnd || toCalendarIso(application?.endDate);
        }

        const calendarKey = (parts) => parts.year * 10000 + parts.month * 100 + parts.day;
        const startKey = calendarKey(getCalendarParts(start));
        const candidateKey = calendarKey(getCalendarParts(candidate));

        if (candidateKey < startKey) {
            candidate = start;
        }

        return toCalendarIso(candidate);
    }

    /**
     * Lease ends in the reconcile month but accrual rules skip it (left early / cut short).
     */
    static isLeaseCutShortForMonth(application, month, year) {
        if (!application?.startDate || !application?.endDate) return false;

        if (RentalAccrualService.shouldAccrueMonthForLease(
            application.startDate,
            application.endDate,
            month,
            year
        )) {
            return false;
        }

        const end = new Date(application.endDate);
        const endMonth = end.getUTCMonth() + 1;
        const endYear = end.getUTCFullYear();

        return endYear === year && endMonth === month;
    }

    static buildExtendLeaseParams({ application, applicationId, studentId, month, year, actualAmount }) {
        const currentLeaseEnd = application?.endDate
            ? BillingDiscrepancyService.formatDateOnly(application.endDate)
            : null;
        const suggestedLeaseEnd = BillingDiscrepancyService.formatDateOnly(
            BillingDiscrepancyService.defaultExtendLeaseEndDate(month, year)
        );

        return {
            applicationId,
            studentId,
            month,
            year,
            actualAmount,
            currentLeaseEnd,
            suggestedLeaseEnd,
            actualLeaseEndDate: suggestedLeaseEnd,
            note: 'Extends lease to month-end so June accrual can post; negotiate after if Excel amount differs from room rent'
        };
    }

    static formatDateOnly(date) {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static parseActualStudentName(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return { firstName: '', lastName: '' };
        if (parts.length === 1) return { firstName: parts[0], lastName: '' };
        return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }

    static buildAddStudentParams({ actualName, actualAmount, residenceId, month, year }) {
        const { firstName, lastName } = BillingDiscrepancyService.parseActualStudentName(actualName);
        const scanYear = year || new Date().getFullYear();
        const scanMonth = month || 6;
        return {
            firstName,
            lastName,
            studentName: actualName,
            monthlyRent: actualAmount,
            actualAmount,
            residenceId,
            month: scanMonth,
            year: scanYear,
            suggestedStartDate: `${scanYear}-02-01`,
            suggestedEndDate: `${scanYear}-${String(scanMonth).padStart(2, '0')}-30`,
            requiredFields: ['roomNumber', 'startDate', 'endDate'],
            optionalFields: ['email', 'phone', 'monthlyRent'],
            note: 'Provide roomNumber — monthly rent is taken from the room price. Override with monthlyRent only if needed.'
        };
    }

    static resolveMonthlyRentFromRoom(room, action = {}) {
        if (room?.price != null && room.price !== '') {
            return Math.round(Number(room.price) * 100) / 100;
        }
        const fallback = action.monthlyRent ?? action.actualAmount;
        if (fallback != null && fallback !== '') {
            return Math.round(Number(fallback) * 100) / 100;
        }
        return null;
    }

    static async addStudentFromReconciliation(action, adminUser) {
        const { parseCalendarDate } = require('../utils/calendarDate');
        const User = require('../models/User');
        const { createDebtorForStudent } = require('./debtorService');

        const parsedName = BillingDiscrepancyService.parseActualStudentName(
            action.actualName || action.studentName || ''
        );
        const firstName = action.firstName || parsedName.firstName;
        const lastName = action.lastName || parsedName.lastName;
        const residenceId = action.residenceId;
        const roomNumber = action.roomNumber;
        const startDate = action.startDate;
        const endDate = action.endDate;
        const month = action.month;
        const year = action.year;
        const studentLabel = action.actualName || action.studentName || `${firstName} ${lastName}`.trim();

        const missing = [];
        if (!firstName) missing.push('firstName or actualName');
        if (!residenceId) missing.push('residenceId');
        if (!roomNumber) missing.push('roomNumber');
        if (!startDate) missing.push('startDate');
        if (!endDate) missing.push('endDate');

        if (missing.length) {
            return {
                success: false,
                manual: true,
                skipped: true,
                type: 'add_student',
                action: 'add_student',
                studentName: studentLabel,
                error: `Missing required fields: ${missing.join(', ')}`,
                requiredFields: missing,
                addStudentParams: BillingDiscrepancyService.buildAddStudentParams({
                    actualName: studentLabel,
                    actualAmount: action.actualAmount,
                    residenceId,
                    month,
                    year
                }),
                hint: 'Include roomNumber, startDate, endDate — rent is taken from the room price'
            };
        }

        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return {
                success: false,
                type: 'add_student',
                action: 'add_student',
                studentName: studentLabel,
                error: 'Residence not found'
            };
        }

        const room = residence.rooms?.find(r => r.roomNumber === roomNumber);
        if (!room) {
            return {
                success: false,
                type: 'add_student',
                action: 'add_student',
                studentName: studentLabel,
                error: `Room ${roomNumber} not found in ${residence.name}`
            };
        }

        const monthlyRent = BillingDiscrepancyService.resolveMonthlyRentFromRoom(room, action);
        if (monthlyRent == null) {
            return {
                success: false,
                type: 'add_student',
                action: 'add_student',
                studentName: studentLabel,
                roomNumber,
                error: `Room ${roomNumber} has no price — set room.price on the residence or pass monthlyRent`
            };
        }

        const rentSource = room?.price != null ? 'room_price' : 'action_amount';
        let parsedStartDate;
        let parsedEndDate;
        try {
            parsedStartDate = parseCalendarDate(startDate);
            parsedEndDate = parseCalendarDate(endDate);
            if (parsedEndDate <= parsedStartDate) {
                return {
                    success: false,
                    type: 'add_student',
                    action: 'add_student',
                    studentName: studentLabel,
                    error: 'End date must be after start date'
                };
            }
        } catch (dateError) {
            return {
                success: false,
                type: 'add_student',
                action: 'add_student',
                studentName: studentLabel,
                error: `Invalid lease dates: ${dateError.message}`
            };
        }

        const normalizedEmail = action.email
            ? String(action.email).trim().toLowerCase()
            : require('../utils/studentListParser').buildGmailFromName(firstName, lastName || 'tenant');

        let student = await User.findOne({ email: normalizedEmail });
        if (!student) {
            student = new User({
                email: normalizedEmail,
                firstName,
                lastName: lastName || '',
                phone: action.phone || '',
                password: Math.random().toString(36).slice(-12),
                status: 'active',
                role: 'student',
                isVerified: true
            });
            await student.save();
        }

        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const application = new Application({
            student: student._id,
            email: normalizedEmail,
            firstName,
            lastName: lastName || '',
            phone: action.phone || '',
            requestType: 'new',
            status: 'approved',
            paymentStatus: 'paid',
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            preferredRoom: roomNumber,
            allocatedRoom: roomNumber,
            residence: residenceId,
            applicationCode,
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: adminUser?._id || adminUser?.id
        });
        await application.save();

        student.applicationCode = application.applicationCode;
        student.residence = residenceId;
        student.currentRoom = roomNumber;
        await student.save();

        const debtor = await createDebtorForStudent(student, {
            residenceId,
            roomNumber,
            createdBy: adminUser?._id || adminUser?.id,
            application: application._id,
            applicationCode: application.applicationCode,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            roomPrice: Number(monthlyRent)
        });

        if (debtor?._id) {
            application.debtor = debtor._id;
            await application.save();
        }

        let reconcileResult = null;
        if (month && year) {
            reconcileResult = await BillingDiscrepancyService.reconcileRentAccruals({
                applicationId: application._id.toString(),
                studentId: student._id.toString(),
                month,
                year,
                allowLeaseUpdate: false,
                adminUser
            });
        }

        return {
            success: true,
            type: 'add_student',
            action: 'add_student',
            studentName: studentLabel,
            applicationId: application._id.toString(),
            studentId: student._id.toString(),
            debtorId: debtor?._id?.toString() || null,
            email: normalizedEmail,
            roomNumber,
            monthlyRent: Number(monthlyRent),
            roomPrice: room?.price != null ? Number(room.price) : null,
            rentSource,
            reconcileResult
        };
    }

    static residenceQuery(residenceId) {
        const oid = new mongoose.Types.ObjectId(residenceId);
        return {
            $or: [
                { residence: oid },
                { 'allocatedRoomDetails.residenceId': oid }
            ]
        };
    }

    static getDebtorFromContext(application, context) {
        if (!application || !context) return null;
        const studentId = application.student?._id?.toString() || application.student?.toString();
        const appId = application._id?.toString();

        if (studentId && context.debtorByUserId.has(studentId)) {
            return context.debtorByUserId.get(studentId);
        }
        if (appId && context.debtorByApplicationId.has(appId)) {
            return context.debtorByApplicationId.get(appId);
        }
        return null;
    }

    static filterApplicationsForMonth(applications, month, year) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        return (applications || []).filter(app => {
            if (!app.startDate || !app.endDate) return false;
            const start = new Date(app.startDate);
            const end = new Date(app.endDate);
            return start <= monthEnd && end >= monthStart;
        });
    }

    /**
     * Ledger rows with rent in month but tenant not on Excel upload — includes apps whose
     * lease does not overlap the month (e.g. erroneous May accrual for a June-start lease).
     */
    static appendLedgerOnlyLeftEarlyCandidates({
        leftEarlyCandidates,
        matchedApplicationIds,
        compareContext,
        rentLedger,
        scanMonth,
        scanYear,
        residenceName
    }) {
        const { lookupStudentRentFromLedger, extractRentIncomeAmount } = require('../utils/incomeStatementRentUtils');
        const seenAppIds = new Set([
            ...matchedApplicationIds,
            ...leftEarlyCandidates.map((c) => c.applicationId)
        ]);

        for (const tx of rentLedger.processedTransactions || []) {
            const net = extractRentIncomeAmount(tx, rentLedger.accountCodes);
            if (net <= 0.01) continue;

            let appId = tx.metadata?.applicationId?.toString?.() || tx.metadata?.applicationId;
            let app = appId ? compareContext.appById.get(appId) : null;

            if (!app) {
                const studentId = tx.metadata?.studentId?.toString?.() || tx.metadata?.studentId;
                if (studentId && compareContext.appByStudentId.has(studentId)) {
                    app = compareContext.appByStudentId.get(studentId);
                }
            }

            if (!app) {
                const nameFromTx = BillingDiscrepancyService.extractStudentNameFromTransaction(tx);
                if (nameFromTx) {
                    const match = BillingDiscrepancyService.findStudentInContext(
                        nameFromTx,
                        compareContext
                    );
                    app = match?.application;
                    if (!appId && match?.applicationId) appId = match.applicationId;
                }
            }

            if (!app) continue;
            appId = app._id.toString();
            if (seenAppIds.has(appId)) continue;
            seenAppIds.add(appId);

            const debtor = BillingDiscrepancyService.getDebtorFromContext(app, compareContext);
            const studentIdForApp = app.student?._id?.toString() || app.student?.toString();
            const ledgerHit = lookupStudentRentFromLedger(rentLedger.lookup, {
                studentId: studentIdForApp,
                applicationId: appId,
                debtorId: debtor?._id?.toString(),
                debtorAccountCode: debtor?.accountCode
            });
            const dbAmount = ledgerHit?.netAmount ?? net;

            leftEarlyCandidates.push({
                studentName: BillingDiscrepancyService.getStudentName(app),
                applicationId: appId,
                studentId: studentIdForApp,
                dbAmount,
                hasAccrual: ledgerHit?.hasAccrual ?? true,
                leaseStart: app.startDate,
                leaseEnd: app.endDate,
                residence: app.residence?.name || residenceName,
                status: 'ledger_extra_not_on_upload',
                issueType: 'extra_accrual',
                fixAction: 'update_lease_end',
                availableActions: ['update_lease_end', 'reconcile_accrual'],
                suggestedLeaseEnd: BillingDiscrepancyService.resolveEarlyLeaveEndDate(
                    app,
                    scanMonth,
                    scanYear,
                    BillingDiscrepancyService.formatDateOnly(
                        BillingDiscrepancyService.defaultEarlyLeaveEndDate(scanMonth, scanYear)
                    )
                ),
                suggestedAction: 'Rent on ledger but not on Excel — reverse via update lease end (erroneous accrual)',
                source: 'ledger_scan'
            });
        }
    }

    static async buildComparisonContext(residenceId, month, year, rentLedger) {
        const residenceOid = new mongoose.Types.ObjectId(residenceId);
        const baseAppQuery = {
            status: { $in: ['approved', 'expired'] },
            paymentStatus: { $ne: 'cancelled' },
            ...BillingDiscrepancyService.residenceQuery(residenceId)
        };

        const [applications, debtors] = await Promise.all([
            Application.find(baseAppQuery)
                .select('student firstName lastName startDate endDate residence allocatedRoomDetails applicationCode status paymentStatus')
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name')
                .lean(),
            Debtor.find({ residence: residenceOid })
                .select('user application accountCode')
                .populate('user', 'firstName lastName email')
                .lean()
        ]);

        const appCandidates = applications.map(app => ({
            applicationId: app._id.toString(),
            studentId: app.student?._id?.toString() || app.student?.toString(),
            studentName: BillingDiscrepancyService.getStudentName(app),
            application: app,
            residenceId: app.residence?._id?.toString() || app.residence?.toString()
        }));

        const appById = new Map(applications.map(app => [app._id.toString(), app]));
        const appByStudentId = new Map();
        for (const app of applications) {
            const sid = app.student?._id?.toString() || app.student?.toString();
            if (!sid) continue;
            const existing = appByStudentId.get(sid);
            if (!existing || new Date(app.endDate || 0) > new Date(existing.endDate || 0)) {
                appByStudentId.set(sid, app);
            }
        }

        const debtorByUserId = new Map();
        const debtorByApplicationId = new Map();
        for (const debtor of debtors) {
            const userId = debtor.user?._id?.toString() || debtor.user?.toString();
            if (userId) debtorByUserId.set(userId, debtor);
            const appId = debtor.application?._id?.toString() || debtor.application?.toString();
            if (appId) debtorByApplicationId.set(appId, debtor);
        }

        return {
            residenceId,
            month,
            year,
            rentLedger,
            applications,
            appCandidates,
            appById,
            appByStudentId,
            debtors,
            debtorByUserId,
            debtorByApplicationId
        };
    }

    static resolveApplicationForLedgerMatchSync(dbMatch, context) {
        if (!dbMatch || dbMatch.application) return dbMatch;

        if (dbMatch.applicationId && context.appById.has(dbMatch.applicationId)) {
            dbMatch.application = context.appById.get(dbMatch.applicationId);
            return dbMatch;
        }

        if (dbMatch.studentId && context.appByStudentId.has(dbMatch.studentId)) {
            dbMatch.application = context.appByStudentId.get(dbMatch.studentId);
        }

        return dbMatch;
    }

    static findStudentInContext(name, context) {
        if (!context) return null;

        const month = context.month;
        const year = context.year;
        const matchFn = month && year
            ? (n, c, t) => BillingDiscrepancyService.findBestNameMatchForPeriod(n, c, month, year, t)
            : BillingDiscrepancyService.findBestNameMatch;

        let match = matchFn(name, context.appCandidates, 0.7);
        if (match) {
            return {
                ...match,
                matchSource: 'application',
                application: match.application || context.appById.get(match.applicationId)
            };
        }

        for (const debtor of context.debtors) {
            const userName = debtor.user
                ? `${debtor.user.firstName || ''} ${debtor.user.lastName || ''}`.trim()
                : '';
            const score = BillingDiscrepancyService.nameMatchScore(name, userName);
            if (score < 0.7 || !debtor.user) continue;

            const userId = debtor.user._id.toString();
            let app = context.appByStudentId.get(userId);

            if (app) {
                return {
                    applicationId: app._id.toString(),
                    studentId: userId,
                    studentName: BillingDiscrepancyService.getStudentName(app),
                    matchScore: score,
                    matchSource: 'debtor',
                    application: app
                };
            }
        }

        if (context.rentLedger) {
            const ledgerMatch = BillingDiscrepancyService.findStudentInRentLedger(name, context.rentLedger);
            if (ledgerMatch) {
                return BillingDiscrepancyService.resolveApplicationForLedgerMatchSync(ledgerMatch, context);
            }
        }

        return null;
    }

    static getSystemRentAmountsFromLedgerTransaction(tx, rentLedger) {
        const { extractRentIncomeAmount, extractGrossRentIncomeAmount, getTransactionId } = require('../utils/incomeStatementRentUtils');
        const gross = extractGrossRentIncomeAmount(tx, rentLedger.accountCodes);
        const net = extractRentIncomeAmount(tx, rentLedger.accountCodes);
        return {
            hasAccrual: gross > 0 || net > 0,
            accrualTransactionId: getTransactionId(tx),
            dbAccrualAmount: gross,
            negotiationDiscount: Math.round((gross - net) * 100) / 100,
            dbEffectiveAmount: net,
            dbAmount: net,
            accrual: tx,
            ledgerSource: 'income_statement_4001'
        };
    }

    static getSystemRentAmountsFromLedger(application, debtor, studentId, rentLedger) {
        const { lookupStudentRentFromLedger } = require('../utils/incomeStatementRentUtils');
        if (!rentLedger?.lookup) return null;

        const ledgerHit = lookupStudentRentFromLedger(rentLedger.lookup, {
            studentId: studentId?.toString(),
            applicationId: application?._id?.toString(),
            debtorId: debtor?._id?.toString(),
            debtorAccountCode: debtor?.accountCode
        });

        if (!ledgerHit) return null;

        return {
            hasAccrual: ledgerHit.hasAccrual,
            accrualTransactionId: ledgerHit.transactionId,
            dbAccrualAmount: ledgerHit.grossAmount,
            negotiationDiscount: ledgerHit.negotiationDiscount,
            dbEffectiveAmount: ledgerHit.netAmount,
            dbAmount: ledgerHit.netAmount,
            accrual: ledgerHit.transaction,
            ledgerSource: 'income_statement_4001'
        };
    }

    static extractStudentNameFromTransaction(tx) {
        if (tx?.metadata?.studentName) return tx.metadata.studentName.trim();
        const desc = tx?.description || '';
        const patterns = [
            /(?:monthly rent accrual|lease start|rent accrual)[:\s-]+(.+?)(?:\s*-\s*\d{1,2}\/\d{4}|\s*-\s*\d{4}-\d{2}|\s*$)/i,
            /negotiated rent adjustment for\s+(.+?)(?:\s*-\s*\d|$)/i
        ];
        for (const pattern of patterns) {
            const match = desc.match(pattern);
            if (match?.[1]) return match[1].trim();
        }
        return null;
    }

    static findStudentInRentLedger(name, rentLedger) {
        if (!rentLedger?.processedTransactions?.length) return null;

        const candidates = rentLedger.processedTransactions.map(tx => ({
            studentName: BillingDiscrepancyService.extractStudentNameFromTransaction(tx),
            studentId: tx.metadata?.studentId?.toString?.() || tx.metadata?.studentId,
            applicationId: tx.metadata?.applicationId?.toString?.() || tx.metadata?.applicationId,
            debtorId: tx.metadata?.debtorId?.toString?.() || tx.metadata?.debtorId,
            ledgerTransaction: tx
        })).filter(c => c.studentName);

        const match = BillingDiscrepancyService.findBestNameMatch(name, candidates, 0.65);
        if (!match) return null;

        return {
            studentId: match.studentId,
            applicationId: match.applicationId,
            studentName: match.studentName,
            matchScore: match.matchScore,
            matchSource: 'ledger',
            ledgerTransaction: match.ledgerTransaction,
            application: null
        };
    }

    static async resolveApplicationForLedgerMatch(dbMatch, residenceId) {
        if (!dbMatch || dbMatch.application) return dbMatch;

        if (dbMatch.applicationId) {
            dbMatch.application = await Application.findById(dbMatch.applicationId)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name rooms')
                .lean();
            if (dbMatch.application) return dbMatch;
        }

        if (dbMatch.studentId) {
            dbMatch.application = await Application.findOne({
                student: dbMatch.studentId,
                status: { $in: ['approved', 'expired'] },
                paymentStatus: { $ne: 'cancelled' },
                ...BillingDiscrepancyService.residenceQuery(residenceId)
            })
                .sort({ endDate: -1 })
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name rooms')
                .lean();
        }

        return dbMatch;
    }

    static async findStudentForComparison(name, residenceId, month, year, rentLedger = null) {
        const residenceOid = new mongoose.Types.ObjectId(residenceId);
        const baseAppQuery = {
            status: { $in: ['approved', 'expired'] },
            paymentStatus: { $ne: 'cancelled' },
            ...BillingDiscrepancyService.residenceQuery(residenceId)
        };

        const applications = await Application.find(baseAppQuery)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name rooms')
            .lean();

        const candidates = applications.map(app => ({
            applicationId: app._id.toString(),
            studentId: app.student?._id?.toString() || app.student?.toString(),
            studentName: BillingDiscrepancyService.getStudentName(app),
            application: app,
            residenceId: app.residence?._id?.toString() || app.residence?.toString()
        }));

        let match = BillingDiscrepancyService.findBestNameMatch(name, candidates, 0.7);
        if (match) {
            return {
                ...match,
                matchSource: 'application',
                application: match.application || applications.find(a => a._id.toString() === match.applicationId)
            };
        }

        const debtors = await Debtor.find({ residence: residenceOid })
            .populate('user', 'firstName lastName email')
            .lean();

        for (const debtor of debtors) {
            const userName = debtor.user
                ? `${debtor.user.firstName || ''} ${debtor.user.lastName || ''}`.trim()
                : '';
            const score = BillingDiscrepancyService.nameMatchScore(name, userName);
            if (score < 0.7 || !debtor.user) continue;

            let app = applications.find(a =>
                (a.student?._id?.toString() || a.student?.toString()) === debtor.user._id.toString()
            );

            if (!app) {
                app = await Application.findOne({
                    student: debtor.user._id,
                    status: { $in: ['approved', 'expired'] },
                    paymentStatus: { $ne: 'cancelled' }
                })
                    .sort({ endDate: -1 })
                    .populate('student', 'firstName lastName email')
                    .populate('residence', 'name rooms')
                    .lean();
            }

            if (app) {
                return {
                    applicationId: app._id.toString(),
                    studentId: debtor.user._id.toString(),
                    studentName: BillingDiscrepancyService.getStudentName(app),
                    matchScore: score,
                    matchSource: 'debtor',
                    application: app
                };
            }
        }

        const tokens = BillingDiscrepancyService.nameTokens(name);
        if (tokens.length >= 1) {
            const namePattern = tokens.length >= 2
                ? new RegExp(`${tokens[0]}.*${tokens[tokens.length - 1]}|${tokens[tokens.length - 1]}.*${tokens[0]}`, 'i')
                : new RegExp(tokens[0], 'i');

            const accrual = await TransactionEntry.findOne({
                source: 'rental_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                description: namePattern,
                status: { $nin: ['deleted', 'reversed'] }
            }).lean();

            if (accrual) {
                const debtorId = accrual.metadata?.debtorId;
                let app = null;

                if (debtorId) {
                    const debtor = await Debtor.findById(debtorId).populate('user', 'firstName lastName email').lean();
                    if (debtor?.user) {
                        app = await Application.findOne({
                            student: debtor.user._id,
                            status: { $in: ['approved', 'expired'] }
                        })
                            .sort({ endDate: -1 })
                            .populate('student', 'firstName lastName email')
                            .populate('residence', 'name rooms')
                            .lean();
                    }
                }

                if (app) {
                    const appResidence = app.residence?._id?.toString() || app.residence?.toString();
                    const atResidence = appResidence === residenceId
                        || String(app.allocatedRoomDetails?.residenceId) === residenceId;

                    return {
                        applicationId: app._id.toString(),
                        studentId: app.student?._id?.toString() || app.student?.toString(),
                        studentName: BillingDiscrepancyService.getStudentName(app),
                        matchScore: 0.9,
                        matchSource: 'accrual',
                        wrongResidence: !atResidence,
                        application: app
                    };
                }
            }
        }

        if (rentLedger) {
            const ledgerMatch = BillingDiscrepancyService.findStudentInRentLedger(name, rentLedger);
            if (ledgerMatch) {
                return BillingDiscrepancyService.resolveApplicationForLedgerMatch(ledgerMatch, residenceId);
            }
        }

        return null;
    }

    /** @deprecated use findStudentForComparison */
    static async findApplicationByName(name, residenceId) {
        return BillingDiscrepancyService.findStudentForComparison(name, residenceId, new Date().getMonth() + 1, new Date().getFullYear());
    }

    /**
     * Compare uploaded actual amounts against live system transactions (accruals + negotiations).
     * Upload list = what should be correct; DB transactions = what the system has.
     */
    static async compareActualVsSystemList({
        rows,
        month,
        year,
        residenceId,
        residenceName,
        tolerance = 0.01
    }) {
        const now = new Date();
        const scanMonth = month || now.getMonth() + 1;
        const scanYear = year || now.getFullYear();

        const resolvedResidence = residenceId
            ? await BillingDiscrepancyService.resolveResidenceFilter(residenceId)
            : (residenceName ? await BillingDiscrepancyService.resolveResidenceFilter(residenceName) : null);

        if (!resolvedResidence) {
            return {
                success: false,
                error: 'residence_required',
                message: 'A valid residence is required (select Belvedere or pass residenceId). Without it, left-early and name matching scan the entire portfolio.'
            };
        }

        const scopedResidenceId = resolvedResidence.id;
        const dataRows = (rows || []).filter(r => r.actualName && !isHeaderLikeName(r.actualName));

        const { loadProcessedRentTransactionsForPeriod, extractRentIncomeAmount, extractGrossRentIncomeAmount } = require('../utils/incomeStatementRentUtils');
        const rentLedger = await loadProcessedRentTransactionsForPeriod({
            month: scanMonth,
            year: scanYear,
            residenceId: scopedResidenceId
        });
        const ledgerNetTotal = Math.round(
            rentLedger.processedTransactions.reduce(
                (sum, tx) => sum + extractRentIncomeAmount(tx, rentLedger.accountCodes),
                0
            ) * 100
        ) / 100;
        const ledgerGrossTotal = Math.round(
            rentLedger.processedTransactions.reduce(
                (sum, tx) => sum + extractGrossRentIncomeAmount(tx, rentLedger.accountCodes),
                0
            ) * 100
        ) / 100;

        const compareContext = await BillingDiscrepancyService.buildComparisonContext(
            scopedResidenceId,
            scanMonth,
            scanYear,
            rentLedger
        );

        const comparisons = [];
        const matchedApplicationIds = new Set();
        let actualTotal = 0;
        let dbAccrualTotal = 0;
        let dbEffectiveTotal = 0;

        for (const row of dataRows) {
            if (!row.actualName) continue;

            actualTotal += row.actualAmount || 0;

            const dbMatch = BillingDiscrepancyService.findStudentInContext(row.actualName, compareContext);

            let dbAccrualAmount = null;
            let dbEffectiveAmount = null;
            let negotiationDiscount = 0;
            let hasAccrual = false;
            let accrualTransactionId = null;
            let applicationId = null;
            let studentId = null;
            let debtorId = null;
            let dbStudentName = null;
            let ledgerSource = null;

            if (dbMatch?.application) {
                const app = dbMatch.application;
                applicationId = app._id.toString();
                studentId = dbMatch.studentId || app.student?._id?.toString() || app.student?.toString();
                dbStudentName = dbMatch.studentName || BillingDiscrepancyService.getStudentName(app);
                matchedApplicationIds.add(applicationId);

                const debtor = BillingDiscrepancyService.getDebtorFromContext(app, compareContext);
                if (debtor?._id) debtorId = debtor._id.toString();
                let txAmounts = BillingDiscrepancyService.getSystemRentAmountsFromLedger(
                    app, debtor, studentId, rentLedger
                );

                if (!txAmounts || (txAmounts.ledgerSource === 'income_statement_4001_not_on_ledger' && row.actualAmount > 0)) {
                    const ledgerByName = BillingDiscrepancyService.findStudentInRentLedger(row.actualName, rentLedger);
                    if (ledgerByName?.ledgerTransaction) {
                        txAmounts = BillingDiscrepancyService.getSystemRentAmountsFromLedgerTransaction(
                            ledgerByName.ledgerTransaction,
                            rentLedger
                        );
                    }
                }

                if (!txAmounts) {
                    txAmounts = await BillingDiscrepancyService.getSystemRentAmountsForMonth(
                        app, debtor, studentId, scanMonth, scanYear, rentLedger
                    );
                }
                hasAccrual = txAmounts.hasAccrual;
                dbAccrualAmount = txAmounts.dbAccrualAmount;
                dbEffectiveAmount = txAmounts.dbEffectiveAmount;
                negotiationDiscount = txAmounts.negotiationDiscount;
                accrualTransactionId = txAmounts.accrualTransactionId;
                ledgerSource = txAmounts.ledgerSource || null;
                dbAccrualTotal += dbAccrualAmount || 0;
                dbEffectiveTotal += dbEffectiveAmount || 0;
            } else if (dbMatch?.matchSource === 'ledger' && dbMatch.ledgerTransaction) {
                studentId = dbMatch.studentId;
                applicationId = dbMatch.applicationId;
                dbStudentName = dbMatch.studentName;
                if (applicationId) matchedApplicationIds.add(applicationId);

                const { extractRentIncomeAmount, extractGrossRentIncomeAmount, getTransactionId } = require('../utils/incomeStatementRentUtils');
                const tx = dbMatch.ledgerTransaction;
                dbAccrualAmount = extractGrossRentIncomeAmount(tx, rentLedger.accountCodes);
                dbEffectiveAmount = extractRentIncomeAmount(tx, rentLedger.accountCodes);
                negotiationDiscount = Math.round((dbAccrualAmount - dbEffectiveAmount) * 100) / 100;
                hasAccrual = dbEffectiveAmount > 0 || dbAccrualAmount > 0;
                accrualTransactionId = getTransactionId(tx);
                ledgerSource = 'income_statement_4001';
                dbAccrualTotal += dbAccrualAmount || 0;
                dbEffectiveTotal += dbEffectiveAmount || 0;
            }

            const systemAmount = dbEffectiveAmount;
            let status = 'match';
            let issueType = null;
            let fixAction = null;

            if (!dbMatch) {
                status = 'missing_from_system';
                issueType = 'student_not_in_system';
                fixAction = 'add_student';
            } else if (dbMatch.wrongResidence) {
                status = 'wrong_residence';
                issueType = 'student_not_in_system';
                fixAction = 'add_student';
            } else if (!hasAccrual && (row.actualAmount || 0) > 0) {
                status = 'missing_accrual';
                issueType = 'missing_monthly_accrual';
                fixAction = 'reconcile_accrual';
            } else if (
                systemAmount != null
                && row.actualAmount != null
                && systemAmount > row.actualAmount + tolerance
            ) {
                status = 'amount_higher_in_system';
                issueType = 'amount_mismatch';
                fixAction = 'negotiate';
            } else if (
                systemAmount != null
                && row.actualAmount != null
                && row.actualAmount > systemAmount + tolerance
            ) {
                status = 'amount_lower_in_system';
                issueType = 'amount_mismatch';
                fixAction = 'negotiate';
            } else if (
                dbAccrualAmount != null
                && row.actualAmount != null
                && Math.abs(dbAccrualAmount - row.actualAmount) > tolerance
                && negotiationDiscount > 0
                && Math.abs(systemAmount - row.actualAmount) <= tolerance
            ) {
                status = 'match_after_negotiation';
            }

            if (dbMatch && dbMatch.matchScore < 0.95 && status === 'match') {
                status = 'name_spelling_variation';
            }

            let matchedApplication = dbMatch?.application || null;
            if (!matchedApplication && applicationId && compareContext.appById?.has(applicationId)) {
                matchedApplication = compareContext.appById.get(applicationId);
            }

            const leaseCutShort = matchedApplication && status === 'missing_accrual'
                ? BillingDiscrepancyService.isLeaseCutShortForMonth(
                    matchedApplication,
                    scanMonth,
                    scanYear
                )
                : false;

            const currentLeaseEnd = leaseCutShort && matchedApplication?.endDate
                ? BillingDiscrepancyService.formatDateOnly(matchedApplication.endDate)
                : null;
            const suggestedLeaseEnd = leaseCutShort
                ? BillingDiscrepancyService.formatDateOnly(
                    BillingDiscrepancyService.defaultExtendLeaseEndDate(scanMonth, scanYear)
                )
                : null;

            const availableActions = BillingDiscrepancyService.buildAvailableActions({
                fixAction,
                status,
                dbAccrualAmount,
                actualAmount: row.actualAmount,
                dbEffectiveAmount: systemAmount,
                leaseCutShort
            });

            const gapAmount = systemAmount != null && row.actualAmount != null
                ? Math.round((row.actualAmount - (systemAmount || 0)) * 100) / 100
                : null;

            const comparisonRow = {
                actualName: row.actualName,
                actualAmount: row.actualAmount,
                dbStudentName,
                dbAccrualAmount,
                negotiationDiscount,
                dbEffectiveAmount: systemAmount,
                dbAmount: systemAmount,
                accrualTransactionId,
                hasAccrual,
                ledgerSource,
                onIncomeStatementLedger: ledgerSource === 'income_statement_4001'
                    && (dbEffectiveAmount || 0) > 0,
                notOnIncomeStatementLedger: ledgerSource === 'income_statement_4001_not_on_ledger',
                applicationId,
                studentId,
                debtorId,
                nameMatchScore: dbMatch?.matchScore ?? null,
                matchSource: dbMatch?.matchSource ?? null,
                amountDifference: systemAmount != null && row.actualAmount != null
                    ? Math.round((systemAmount - row.actualAmount) * 100) / 100
                    : null,
                accrualVsActualDifference: dbAccrualAmount != null && row.actualAmount != null
                    ? Math.round((dbAccrualAmount - row.actualAmount) * 100) / 100
                    : null,
                status,
                issueType,
                fixAction,
                availableActions,
                negotiateParams: fixAction === 'negotiate' && row.actualAmount != null
                    && (systemAmount != null || dbAccrualAmount != null)
                    ? {
                        originalAmount: systemAmount ?? dbAccrualAmount,
                        negotiatedAmount: row.actualAmount,
                        accrualMonth: scanMonth,
                        accrualYear: scanYear,
                        accrualTransactionId,
                        applicationId,
                        studentId,
                        studentName: dbStudentName,
                        debtorId,
                        reason: row.actualAmount > (systemAmount ?? dbAccrualAmount)
                            ? 'Reconciliation — room rate increase for month'
                            : 'Reconciliation — adjusted to actual amount'
                    }
                    : null,
                reconcileParams: fixAction === 'reconcile_accrual' && applicationId
                    ? {
                        applicationId,
                        studentId,
                        month: scanMonth,
                        year: scanYear,
                        actualAmount: row.actualAmount
                    }
                    : null,
                extendLeaseParams: leaseCutShort && applicationId
                    ? BillingDiscrepancyService.buildExtendLeaseParams({
                        application: matchedApplication,
                        applicationId,
                        studentId,
                        month: scanMonth,
                        year: scanYear,
                        actualAmount: row.actualAmount
                    })
                    : null,
                leaseCutShort,
                currentLeaseEnd,
                suggestedLeaseEnd,
                addStudentParams: fixAction === 'add_student'
                    ? BillingDiscrepancyService.buildAddStudentParams({
                        actualName: row.actualName,
                        actualAmount: row.actualAmount,
                        residenceId: scopedResidenceId,
                        month: scanMonth,
                        year: scanYear
                    })
                    : null,
                fixedBy: fixAction === 'add_student' || fixAction === 'update_lease_end'
                    ? 'admin'
                    : 'admin_or_finance',
                suggestedAction: BillingDiscrepancyService.getSuggestedAction(issueType, fixAction),
                gapAmount: gapAmount > 0.01 ? gapAmount : 0,
                gapReason: gapAmount > 0.01
                    ? BillingDiscrepancyService.gapReasonForComparison({
                        status,
                        issueType,
                        fixAction,
                        leaseCutShort,
                        currentLeaseEnd,
                        suggestedLeaseEnd,
                        notOnIncomeStatementLedger: ledgerSource === 'income_statement_4001_not_on_ledger'
                    })
                    : null,
                uiCategory: null
            };

            comparisonRow.uiCategory = BillingDiscrepancyService.comparisonUiCategory(comparisonRow);
            comparisons.push(comparisonRow);
        }

        const { lookupStudentRentFromLedger } = require('../utils/incomeStatementRentUtils');
        const activeApps = BillingDiscrepancyService.filterApplicationsForMonth(
            compareContext.applications,
            scanMonth,
            scanYear
        );

        const leftEarlyCandidates = [];
        for (const app of activeApps) {
            const appId = app._id.toString();
            if (matchedApplicationIds.has(appId)) continue;

            const debtor = BillingDiscrepancyService.getDebtorFromContext(app, compareContext);
            const studentIdForApp = app.student?._id?.toString() || app.student?.toString();
            const ledgerHit = lookupStudentRentFromLedger(rentLedger.lookup, {
                studentId: studentIdForApp,
                applicationId: appId,
                debtorId: debtor?._id?.toString(),
                debtorAccountCode: debtor?.accountCode
            });

            leftEarlyCandidates.push({
                studentName: BillingDiscrepancyService.getStudentName(app),
                applicationId: appId,
                studentId: studentIdForApp,
                dbAmount: ledgerHit?.netAmount ?? 0,
                hasAccrual: ledgerHit?.hasAccrual ?? false,
                leaseStart: app.startDate,
                leaseEnd: app.endDate,
                residence: app.residence?.name || resolvedResidence.name,
                status: 'left_early_or_not_on_actual_list',
                issueType: 'extra_accrual',
                fixAction: 'update_lease_end',
                availableActions: ['update_lease_end', 'reconcile_accrual'],
                suggestedLeaseEnd: BillingDiscrepancyService.resolveEarlyLeaveEndDate(
                    app,
                    scanMonth,
                    scanYear,
                    BillingDiscrepancyService.formatDateOnly(
                        BillingDiscrepancyService.defaultEarlyLeaveEndDate(scanMonth, scanYear)
                    )
                ),
                suggestedAction: 'Admin: update lease end date (student not on actual list — likely left early)'
            });
        }

        BillingDiscrepancyService.appendLedgerOnlyLeftEarlyCandidates({
            leftEarlyCandidates,
            matchedApplicationIds,
            compareContext,
            rentLedger,
            scanMonth,
            scanYear,
            residenceName: resolvedResidence.name
        });

        const leftEarlyWithLedger = leftEarlyCandidates.filter((c) => (c.dbAmount ?? 0) > 0.01);

        const fixable = comparisons.filter(c =>
            ['reconcile_accrual', 'negotiate'].includes(c.fixAction) && c.applicationId
        );
        const needsManual = comparisons.filter(c => c.fixAction === 'add_student');

        const uploadMatchedEffective = Math.round(dbEffectiveTotal * 100) / 100;
        const uploadMatchedGross = Math.round(dbAccrualTotal * 100) / 100;
        const actualRounded = Math.round(actualTotal * 100) / 100;
        const gapBreakdown = BillingDiscrepancyService.buildGapBreakdown(comparisons, tolerance);
        const reconcileCandidates = comparisons.filter(c => c.uiCategory === 'reconcile');
        const negotiateCandidates = comparisons.filter(c => c.uiCategory === 'negotiate');
        const matchedRows = comparisons.filter(c => c.uiCategory === 'matched');

        return {
            success: true,
            period: { month: scanMonth, year: scanYear },
            residence: resolvedResidence,
            compareMode: 'actual_vs_system_transactions',
            ledgerSource: 'income_statement_4001',
            ledgerSummary: {
                accountCode: '4001',
                residenceId: scopedResidenceId,
                rawTransactionCount: rentLedger.rawCount,
                filteredTransactionCount: rentLedger.filteredCount,
                processedTransactionCount: rentLedger.processedCount,
                totalGrossRent: ledgerGrossTotal,
                totalNetRent: ledgerNetTotal,
                incomeStatementUrl: `/api/financial-reports/income-statement/account-details?period=${scanYear}&month=${['january','february','march','april','may','june','july','august','september','october','november','december'][scanMonth - 1]}&accountCode=4001&residenceId=${scopedResidenceId}`,
                note: 'totalNetRent is the full Belvedere June 4001 on the income statement (all tenants). uploadMatchedEffectiveTotal sums only Excel rows — should equal ledger when every upload tenant appears on the statement.'
            },
            summary: {
                rowCount: dataRows.length,
                actualTotal: actualRounded,
                dbAccrualTotal: uploadMatchedGross,
                dbEffectiveTotal: uploadMatchedEffective,
                uploadMatchedSystemTotal: uploadMatchedEffective,
                systemTotal: uploadMatchedEffective,
                uploadMatchedGrossAccrual: uploadMatchedGross,
                uploadMatchedEffectiveTotal: uploadMatchedEffective,
                ledgerTotalNetRent: ledgerNetTotal,
                ledgerTotalGrossRent: ledgerGrossTotal,
                gapActualVsUploadMatched: Math.round((actualRounded - uploadMatchedEffective) * 100) / 100,
                gapActualVsLedger: Math.round((actualRounded - ledgerNetTotal) * 100) / 100,
                ledgerMinusUploadMatched: Math.round((ledgerNetTotal - uploadMatchedEffective) * 100) / 100,
                gapBreakdown,
                summaryExplanation: {
                    actualTotal: 'Excel upload total — your target for the month',
                    ledgerTotalNetRent: 'Full 4001 net rent on income statement / account details (all tenants)',
                    uploadMatchedEffectiveTotal: 'Sum of effective 4001 per matched upload row (same rules as account details)',
                    uploadMatchedGrossAccrual: 'Gross accrual before negotiations, upload rows only',
                    gapActualVsUploadMatched: 'Excel minus upload-matched system — reconcile/negotiate/add to close',
                    gapActualVsLedger: 'Excel minus full ledger — includes tenants not on your upload',
                    ledgerMinusUploadMatched: 'Ledger tenants not counted in upload rows (or upload rows at $0 on ledger)'
                },
                matchCount: comparisons.filter(c =>
                    c.status === 'match' || c.status === 'match_after_negotiation' || c.status === 'name_spelling_variation'
                ).length,
                issueCount: comparisons.filter(c =>
                    !['match', 'match_after_negotiation', 'name_spelling_variation'].includes(c.status)
                ).length,
                missingFromSystemCount: needsManual.length,
                missingAccrualCount: comparisons.filter(c => c.status === 'missing_accrual').length,
                negotiateCount: negotiateCandidates.length,
                matchedCount: matchedRows.length,
                reconcileCount: reconcileCandidates.length,
                wrongAmountCount: comparisons.filter(c => c.issueType === 'amount_mismatch').length,
                leftEarlyCount: leftEarlyWithLedger.length,
                leftEarlyLedgerTotal: Math.round(
                    leftEarlyWithLedger.reduce((sum, c) => sum + (c.dbAmount || 0), 0) * 100
                ) / 100,
                fixableCount: fixable.length + leftEarlyWithLedger.filter(c => c.fixAction === 'update_lease_end').length
            },
            comparisons,
            gapBreakdown,
            reconcileCandidates,
            negotiateCandidates,
            matchedRows,
            leftEarlyCandidates: leftEarlyWithLedger,
            needsManualAdd: needsManual,
            actionGuide: {
                add_student: { roles: ['admin'], endpoint: 'POST .../apply-actions { type: add_student, roomNumber, startDate, endDate } — rent from room price' },
                update_lease_end: { roles: ['admin'], endpoint: 'PUT /api/admin/leases/students/:studentId/lease' },
                extend_lease_end: {
                    roles: ['admin'],
                    endpoint: 'POST .../apply-actions { type: extend_lease_end, applicationId, actualLeaseEndDate, month, year, actualAmount? }'
                },
                reconcile_accrual: { roles: ['admin', 'finance_admin', 'finance_user', 'ceo'], endpoint: 'POST .../reconcile' },
                negotiate: { roles: ['admin', 'finance_admin', 'finance_user', 'ceo'], endpoint: 'POST .../apply-actions { type: negotiate }' }
            },
            workflow: {
                step1: 'Upload actual amounts for the month (what should be correct)',
                step2: 'System compares against live accrual transactions (+ existing negotiations)',
                step3: 'Missing student → admin adds tenant',
                step4: 'Missing accrual → reconcile (or admin extends cut-short lease to month-end)',
                step5: 'Ledger differs from Excel → negotiate to actual (discount or increase)',
                step6: 'Not on actual list → admin shortens lease end'
            }
        };
    }

    static async updateLeaseEndFromReconciliation(action, adminUser) {
        const application = await Application.findById(action.applicationId)
            .populate('student', 'firstName lastName email')
            .lean();

        if (!application) {
            return {
                success: false,
                type: 'update_lease_end',
                action: 'update_lease_end',
                error: 'Application not found'
            };
        }

        const studentName = BillingDiscrepancyService.getStudentName(application);
        const userStudentId = action.studentId
            || application.student?._id?.toString()
            || application.student?.toString();
        const endDateRaw = action.actualLeaseEndDate
            || action.leaseEndDate
            || action.suggestedLeaseEnd
            || (action.month && action.year
                ? BillingDiscrepancyService.defaultEarlyLeaveEndDate(action.month, action.year)
                : null);
        const endDate = BillingDiscrepancyService.resolveEarlyLeaveEndDate(
            application,
            action.month,
            action.year,
            typeof endDateRaw === 'string'
                ? endDateRaw
                : BillingDiscrepancyService.formatDateOnly(endDateRaw)
        );

        if (!endDate) {
            return {
                success: false,
                type: 'update_lease_end',
                action: 'update_lease_end',
                studentName,
                applicationId: application._id.toString(),
                error: 'actualLeaseEndDate is required'
            };
        }

        const LeaseUpdateService = require('./leaseUpdateService');
        const { parseCalendarDate } = require('../utils/calendarDate');

        try {
            const result = await LeaseUpdateService.updateApplicationLeaseById(
                application._id.toString(),
                {
                    startDate: parseCalendarDate(application.startDate),
                    endDate: parseCalendarDate(endDate)
                },
                adminUser?._id || adminUser?.id,
                { adminUser }
            );

            const AccrualCorrectionService = require('./accrualCorrectionService');
            let accrualReversal = null;
            try {
                accrualReversal = await AccrualCorrectionService.correctAccrualsForEarlyLeaseEnd(
                    application._id.toString(),
                    endDate,
                    adminUser,
                    action.reason || 'Lease end date updated - student left early',
                    false
                );
            } catch (reversalError) {
                accrualReversal = { success: false, error: reversalError.message };
            }

            const reversedCount = accrualReversal?.correctedAccruals?.filter((r) => !r.alreadyExisted && !r.alreadyReversed)?.length
                ?? accrualReversal?.correctedAccruals?.length
                ?? 0;

            return {
                success: true,
                type: 'update_lease_end',
                action: 'update_lease_end',
                studentName,
                applicationId: application._id.toString(),
                endDate,
                result,
                accrualReversal,
                reversedCount
            };
        } catch (error) {
            return {
                success: false,
                type: 'update_lease_end',
                action: 'update_lease_end',
                studentName,
                applicationId: application._id.toString(),
                error: error.message
            };
        }
    }

    /**
     * Extend a lease that was cut short (end moved earlier than month-end), then reconcile the period.
     */
    static async extendLeaseEndFromReconciliation(action, adminUser) {
        const application = await Application.findById(action.applicationId)
            .populate('student', 'firstName lastName email')
            .lean();

        if (!application) {
            return {
                success: false,
                type: 'extend_lease_end',
                action: 'extend_lease_end',
                error: 'Application not found'
            };
        }

        const studentName = BillingDiscrepancyService.getStudentName(application);
        const currentEnd = application.endDate ? new Date(application.endDate) : null;
        const endDateRaw = action.actualLeaseEndDate
            || action.suggestedLeaseEnd
            || (action.month && action.year
                ? BillingDiscrepancyService.formatDateOnly(
                    BillingDiscrepancyService.defaultExtendLeaseEndDate(action.month, action.year)
                )
                : null);
        const newEndDate = typeof endDateRaw === 'string'
            ? endDateRaw
            : BillingDiscrepancyService.formatDateOnly(endDateRaw);

        if (!newEndDate) {
            return {
                success: false,
                type: 'extend_lease_end',
                action: 'extend_lease_end',
                studentName,
                applicationId: application._id.toString(),
                error: 'actualLeaseEndDate is required (or pass month/year for month-end default)'
            };
        }

        if (currentEnd && new Date(newEndDate) <= currentEnd) {
            return {
                success: false,
                type: 'extend_lease_end',
                action: 'extend_lease_end',
                studentName,
                applicationId: application._id.toString(),
                currentLeaseEnd: BillingDiscrepancyService.formatDateOnly(currentEnd),
                requestedLeaseEnd: newEndDate,
                error: 'New lease end must be after the current end date to extend'
            };
        }

        const updateResult = await BillingDiscrepancyService.updateLeaseEndFromReconciliation({
            ...action,
            actualLeaseEndDate: newEndDate
        }, adminUser);

        if (!updateResult.success) {
            return {
                ...updateResult,
                type: 'extend_lease_end',
                action: 'extend_lease_end'
            };
        }

        let reconcileResult = null;
        if (action.reconcileAfterExtend !== false && action.month && action.year) {
            reconcileResult = await BillingDiscrepancyService.reconcileRentAccruals({
                applicationId: application._id.toString(),
                studentId: action.studentId
                    || application.student?._id?.toString()
                    || application.student?.toString(),
                month: action.month,
                year: action.year,
                actualAmount: action.actualAmount,
                adminUser
            });
        }

        const negotiateNeeded = action.actualAmount != null
            && reconcileResult?.actions?.some(a =>
                a.step === 'create_period_accrual'
                && a.success
                && a.amount != null
                && Math.abs(a.amount - Number(action.actualAmount)) > 0.01
            );

        const accrualAlreadyExists = reconcileResult?.actions?.some(a =>
            a.step === 'create_period_accrual'
            && !a.success
            && String(a.message || '').toLowerCase().includes('already exists')
        );

        return {
            success: updateResult.success
                && (reconcileResult?.success !== false || accrualAlreadyExists),
            type: 'extend_lease_end',
            action: 'extend_lease_end',
            studentName,
            applicationId: application._id.toString(),
            previousLeaseEnd: currentEnd
                ? BillingDiscrepancyService.formatDateOnly(currentEnd)
                : null,
            newLeaseEnd: newEndDate,
            updateResult,
            reconcileResult,
            negotiateNeeded,
            hint: negotiateNeeded
                ? 'Lease extended and accrual created at room rent — run negotiate if Excel actual differs'
                : undefined
        };
    }

    static async applyReconciliationAction(action, { adminUser, residenceId, allowLeaseUpdate = false }) {
        const { createRentNegotiationAdjustment } = require('./negotiatedPaymentService');
        const type = action.type || action.action;

        switch (type) {
            case 'negotiate': {
                const result = await createRentNegotiationAdjustment({
                    studentId: action.studentId,
                    studentName: action.studentName,
                    originalAmount: action.originalAmount,
                    negotiatedAmount: action.negotiatedAmount,
                    accrualMonth: action.month || action.accrualMonth,
                    accrualYear: action.year || action.accrualYear,
                    accrualTransactionId: action.accrualTransactionId,
                    applicationId: action.applicationId,
                    debtorId: action.debtorId,
                    residenceId: action.residenceId || residenceId,
                    negotiationReason: action.reason || 'Reconciliation — adjusted to actual amount',
                    user: adminUser
                });
                return { type: 'negotiate', ...result };
            }
            case 'reconcile_accrual':
            case 'reconcile': {
                return BillingDiscrepancyService.reconcileRentAccruals({
                    applicationId: action.applicationId,
                    studentId: action.studentId,
                    month: action.month,
                    year: action.year,
                    actualAmount: action.actualAmount,
                    allowLeaseUpdate: false,
                    adminUser
                });
            }
            case 'update_lease_end': {
                if (!allowLeaseUpdate) {
                    return { success: false, error: 'Only admin can update lease end dates' };
                }
                return BillingDiscrepancyService.updateLeaseEndFromReconciliation(action, adminUser);
            }
            case 'extend_lease_end': {
                if (!allowLeaseUpdate) {
                    return { success: false, error: 'Only admin can extend lease end dates' };
                }
                return BillingDiscrepancyService.extendLeaseEndFromReconciliation(action, adminUser);
            }
            case 'add_student': {
                if (!allowLeaseUpdate) {
                    return {
                        success: false,
                        manual: true,
                        skipped: true,
                        error: 'Only admin can add students from reconciliation'
                    };
                }
                const payload = {
                    ...action,
                    residenceId: action.residenceId || residenceId
                };
                return BillingDiscrepancyService.addStudentFromReconciliation(payload, adminUser);
            }
            default:
                return { success: false, error: `Unknown action type: ${type}` };
        }
    }

    static async applyReconciliationActions({
        actions,
        residenceId,
        dryRun = false,
        allowLeaseUpdate = false,
        adminUser
    }) {
        if (dryRun) {
            return {
                success: true,
                dryRun: true,
                wouldApply: actions.length,
                actions
            };
        }

        const results = [];
        let applied = 0;
        let failed = 0;
        let skippedManual = 0;

        for (const action of actions || []) {
            try {
                const result = await BillingDiscrepancyService.applyReconciliationAction(action, {
                    adminUser,
                    residenceId,
                    allowLeaseUpdate
                });
                results.push({ action: action.type || action.action, ...result });
                if (result.skipped && result.manual) skippedManual++;
                else if (result.success !== false) applied++;
                else failed++;
            } catch (error) {
                failed++;
                results.push({ action: action.type || action.action, success: false, error: error.message });
            }
        }

        return {
            success: failed === 0,
            summary: { total: actions.length, applied, failed, skippedManual },
            results
        };
    }

    /**
     * Apply fixes from an upload comparison (admin).
     */
    static async fixFromUploadComparison({
        comparisonResult,
        month,
        year,
        dryRun = false,
        allowLeaseUpdate = true,
        fixLeftEarly = true,
        fixMissingAccruals = true,
        fixCutShortLeases = false,
        fixNegotiations = true,
        adminUser
    }) {
        const scanMonth = month || comparisonResult?.period?.month;
        const scanYear = year || comparisonResult?.period?.year;
        const comparisons = comparisonResult?.comparisons || [];
        const leftEarlyCandidates = comparisonResult?.leftEarlyCandidates || [];

        const targets = [];

        if (fixMissingAccruals || fixNegotiations) {
            for (const row of comparisons) {
                if (
                    fixMissingAccruals
                    && row.leaseCutShort
                    && row.extendLeaseParams
                    && allowLeaseUpdate
                    && fixCutShortLeases
                ) {
                    targets.push({
                        type: 'extend_lease_end',
                        ...row.extendLeaseParams,
                        reason: 'lease_cut_short'
                    });
                } else if (fixMissingAccruals && row.fixAction === 'reconcile_accrual' && row.applicationId) {
                    targets.push({
                        type: 'reconcile_accrual',
                        applicationId: row.applicationId,
                        studentId: row.studentId,
                        month: scanMonth,
                        year: scanYear,
                        actualAmount: row.actualAmount,
                        reason: row.status
                    });
                }
                if (fixNegotiations && row.fixAction === 'negotiate' && row.negotiateParams && row.studentId) {
                    targets.push({
                        type: 'negotiate',
                        studentId: row.studentId,
                        studentName: row.dbStudentName || row.actualName,
                        applicationId: row.applicationId,
                        debtorId: row.debtorId,
                        ...row.negotiateParams,
                        month: scanMonth,
                        year: scanYear,
                        residenceId: comparisonResult?.residence?.id,
                        reason: row.status
                    });
                }
            }
        }

        if (fixLeftEarly && allowLeaseUpdate) {
            for (const row of leftEarlyCandidates) {
                const endDate = BillingDiscrepancyService.resolveEarlyLeaveEndDate(
                    { startDate: row.leaseStart, endDate: row.leaseEnd },
                    scanMonth,
                    scanYear,
                    row.suggestedLeaseEnd
                        ? (typeof row.suggestedLeaseEnd === 'string'
                            ? row.suggestedLeaseEnd
                            : BillingDiscrepancyService.formatDateOnly(row.suggestedLeaseEnd))
                        : BillingDiscrepancyService.formatDateOnly(
                            BillingDiscrepancyService.defaultEarlyLeaveEndDate(scanMonth, scanYear)
                        )
                );
                targets.push({
                    type: 'update_lease_end',
                    applicationId: row.applicationId,
                    studentId: row.studentId,
                    month: scanMonth,
                    year: scanYear,
                    actualLeaseEndDate: endDate,
                    reason: 'left_early_or_not_on_actual_list'
                });
            }
        }

        if (dryRun) {
            return {
                success: true,
                dryRun: true,
                wouldFixCount: targets.length,
                targets,
                skippedManual: (comparisonResult?.needsManualAdd || []).map(r => ({
                    actualName: r.actualName,
                    reason: 'Student not found — admin adds via Add Tenant / CSV'
                }))
            };
        }

        return BillingDiscrepancyService.applyReconciliationActions({
            actions: targets,
            residenceId: comparisonResult?.residence?.id,
            dryRun: false,
            allowLeaseUpdate,
            adminUser
        });
    }
}

module.exports = BillingDiscrepancyService;
