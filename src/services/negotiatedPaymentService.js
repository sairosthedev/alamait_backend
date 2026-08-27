const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Debtor = require('../models/Debtor');
const Application = require('../models/Application');
const User = require('../models/User');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve debtor for negotiation — mirrors finance transactionController fallbacks.
 */
async function resolveDebtorForNegotiation({
    studentId,
    studentName,
    applicationId,
    debtorId,
    originalAccrual
}) {
    let actualUserId = studentId?.toString?.() || studentId;
    const studentIdObj = mongoose.Types.ObjectId.isValid(studentId)
        ? new mongoose.Types.ObjectId(studentId)
        : null;

    if (debtorId && mongoose.Types.ObjectId.isValid(debtorId)) {
        const byId = await Debtor.findById(debtorId).lean();
        if (byId) {
            return {
                debtor: byId,
                actualUserId: byId.user?.toString() || actualUserId
            };
        }
    }

    let debtor = await Debtor.findOne({ user: studentId }).lean();
    if (!debtor && studentIdObj) {
        debtor = await Debtor.findOne({ user: studentIdObj }).lean();
    }

    if (!debtor && applicationId) {
        debtor = await Debtor.findOne({ application: applicationId }).lean();
        if (debtor?.user) actualUserId = debtor.user.toString();
    }

    if (!debtor) {
        debtor = await Debtor.findOne({ application: studentId }).lean();
        if (debtor?.user) actualUserId = debtor.user.toString();
    }

    if (!debtor) {
        const appQuery = applicationId
            ? Application.findById(applicationId)
            : Application.findOne({ student: studentIdObj || studentId }).sort({ endDate: -1 });
        const app = await appQuery.lean();
        if (app) {
            debtor = await Debtor.findOne({ application: app._id }).lean();
            if (!debtor && app.student) {
                debtor = await Debtor.findOne({ user: app.student }).lean();
            }
            if (app.student) actualUserId = app.student.toString();
        }
    }

    if (!debtor && studentIdObj) {
        const appById = await Application.findById(studentIdObj).select('student').lean();
        if (appById?.student) {
            actualUserId = appById.student.toString();
            debtor = await Debtor.findOne({ user: appById.student }).lean()
                || await Debtor.findOne({ application: studentIdObj }).lean();
        }
    }

    if (!debtor && studentId) {
        debtor = await Debtor.findOne({ accountCode: `1100-${studentId}` }).lean();
    }

    if (!debtor && originalAccrual?.metadata?.debtorId) {
        debtor = await Debtor.findById(originalAccrual.metadata.debtorId).lean();
        if (debtor?.user) actualUserId = debtor.user.toString();
    }

    if (!debtor && originalAccrual?.entries?.length) {
        const arEntry = originalAccrual.entries.find(
            e => e.accountCode?.startsWith('1100-') && e.accountCode !== '1100'
        );
        if (arEntry) {
            const idFromCode = arEntry.accountCode.replace('1100-', '');
            if (mongoose.Types.ObjectId.isValid(idFromCode)) {
                debtor = await Debtor.findById(idFromCode).lean()
                    || await Debtor.findOne({ accountCode: arEntry.accountCode }).lean();
                if (debtor?.user) actualUserId = debtor.user.toString();
            }
        }
    }

    if (!debtor) {
        const userDoc = studentIdObj
            ? await User.findById(studentIdObj).select('firstName lastName email').lean()
            : null;
        const firstName = userDoc?.firstName || (studentName ? String(studentName).split(' ')[0] : null);
        const lastName = userDoc?.lastName || (studentName ? String(studentName).split(' ').slice(1).join(' ') : null);
        const email = userDoc?.email || null;
        const fallbackOr = [];

        if (email) {
            fallbackOr.push({
                'contactInfo.email': { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
            });
        }
        if (studentName) {
            fallbackOr.push({
                'contactInfo.name': { $regex: new RegExp(`^${escapeRegex(studentName)}$`, 'i') }
            });
        }
        if (firstName && lastName) {
            const fullName = `${firstName} ${lastName}`.trim();
            fallbackOr.push({
                'contactInfo.name': { $regex: new RegExp(`^${escapeRegex(fullName)}$`, 'i') }
            });
        }

        if (fallbackOr.length > 0) {
            debtor = await Debtor.findOne({ $or: fallbackOr }).sort({ updatedAt: -1 }).lean();
            if (debtor?.user) actualUserId = debtor.user.toString();
        }
    }

    if (!debtor && (applicationId || studentId)) {
        const app = applicationId
            ? await Application.findById(applicationId).populate('student').lean()
            : await Application.findOne({ student: studentIdObj || studentId })
                .sort({ endDate: -1 })
                .populate('student')
                .lean();

        const studentUser = app?.student;
        const userId = studentUser?._id || studentUser;
        if (userId) {
            try {
                const { createDebtorForExistingStudent } = require('./debtorService');
                const created = await createDebtorForExistingStudent(userId, {
                    application: app._id,
                    residenceId: app.residence?._id || app.residence,
                    roomNumber: app.allocatedRoom || app.roomNumber,
                    startDate: app.startDate,
                    endDate: app.endDate
                });
                if (created?._id) {
                    debtor = await Debtor.findById(created._id).lean();
                    actualUserId = userId.toString();
                }
            } catch (error) {
                console.warn(`Could not auto-create debtor for ${studentName}:`, error.message);
            }
        }
    }

    return { debtor, actualUserId };
}

/**
 * Create a negotiated rent adjustment (shared by finance transactions API and reconciliation).
 */
async function createRentNegotiationAdjustment({
    studentId,
    studentName,
    originalAmount,
    negotiatedAmount,
    accrualMonth,
    accrualYear,
    accrualTransactionId,
    applicationId,
    debtorId,
    residenceId,
    negotiationReason,
    description,
    user
}) {
    const original = parseFloat(originalAmount);
    const negotiated = parseFloat(negotiatedAmount);

    if (!studentId || !studentName || !Number.isFinite(original) || !Number.isFinite(negotiated)) {
        return { success: false, error: 'studentId, studentName, originalAmount, and negotiatedAmount are required' };
    }
    if (Math.abs(negotiated - original) < 0.01) {
        return { success: false, error: 'Negotiated amount must differ from the current ledger amount' };
    }

    const isIncrease = negotiated > original;
    const adjustmentAmount = Math.round(Math.abs(original - negotiated) * 100) / 100;
    const monthNum = parseInt(accrualMonth, 10);
    const yearNum = parseInt(accrualYear, 10);

    let originalAccrual = null;
    if (accrualTransactionId) {
        originalAccrual = await TransactionEntry.findById(accrualTransactionId);
    } else if (monthNum && yearNum) {
        const studentIdObj = mongoose.Types.ObjectId.isValid(studentId)
            ? new mongoose.Types.ObjectId(studentId)
            : null;

        let debtorForAccrual = await Debtor.findOne({ user: studentId }).lean();
        if (!debtorForAccrual && studentIdObj) {
            debtorForAccrual = await Debtor.findOne({ user: studentIdObj }).lean();
        }

        const matchOr = [
            { 'metadata.studentId': studentId },
            { sourceId: studentIdObj }
        ];
        if (applicationId) {
            matchOr.push(
                { 'metadata.applicationId': applicationId },
                { sourceId: applicationId }
            );
        }
        if (debtorId) {
            matchOr.push({ 'metadata.debtorId': debtorId });
        }
        if (debtorForAccrual) {
            matchOr.push({ 'metadata.debtorId': debtorForAccrual._id.toString() });
        }

        originalAccrual = await TransactionEntry.findOne({
            source: 'rental_accrual',
            status: { $nin: ['deleted', 'reversed'] },
            'metadata.accrualMonth': monthNum,
            'metadata.accrualYear': yearNum,
            $or: matchOr
        }).sort({ date: -1 });
    }

    const { debtor, actualUserId } = await resolveDebtorForNegotiation({
        studentId,
        studentName,
        applicationId,
        debtorId,
        originalAccrual
    });

    if (!debtor) {
        return {
            success: false,
            error: `Debtor not found for ${studentName}. Ensure tenant has a debtor account or pass applicationId from compare result.`
        };
    }

    const resolvedStudentId = actualUserId || studentId;

    const existing = await TransactionEntry.findOne({
        status: 'posted',
        'metadata.transactionType': 'negotiated_payment_adjustment',
        'metadata.accrualMonth': monthNum,
        'metadata.accrualYear': yearNum,
        'metadata.debtorId': debtor._id.toString(),
        'metadata.negotiatedAmount': negotiated
    }).lean();

    if (existing) {
        return {
            success: true,
            skipped: true,
            message: 'Negotiation already exists for this amount',
            transactionId: existing._id.toString()
        };
    }

    const debtorAccountCode = debtor.accountCode || `1100-${debtor._id.toString()}`;
    let studentARAccount = await Account.findOne({ code: debtorAccountCode, type: 'Asset' });
    if (!studentARAccount) {
        const mainAR = await Account.findOne({ code: '1100' });
        if (!mainAR) {
            return { success: false, error: 'Main AR account (1100) not found' };
        }
        studentARAccount = await Account.create({
            code: debtorAccountCode,
            name: `Accounts Receivable - ${studentName}`,
            type: 'Asset',
            category: 'Current Assets',
            subcategory: 'Accounts Receivable',
            description: `Accounts receivable for ${studentName}`,
            isActive: true,
            parentAccount: mainAR._id,
            level: 2
        });
    }

    let incomeAccount = await Account.findOne({
        $or: [
            { code: '4001', type: 'Income' },
            { code: '4000', type: 'Income' },
            { name: /rent/i, type: 'Income' }
        ]
    });
    if (!incomeAccount) {
        incomeAccount = await Account.create({
            code: '4001',
            name: 'Student Accommodation Rent',
            type: 'Income',
            category: 'Operating Revenue',
            isActive: true
        });
    }

    const accrualDate = originalAccrual?.date ? new Date(originalAccrual.date) : new Date(yearNum, monthNum - 1, 1);
    const userId = user?._id || user?.id;

    const adjustmentMetadata = {
        studentName,
        studentId: resolvedStudentId,
        debtorId: debtor._id.toString(),
        transactionType: 'negotiated_payment_adjustment',
        paymentType: 'rent',
        originalAmount: original,
        negotiatedAmount: negotiated,
        adjustmentAmount,
        adjustmentDirection: isIncrease ? 'increase' : 'decrease',
        discountAmount: isIncrease ? 0 : adjustmentAmount,
        negotiationReason: negotiationReason || (isIncrease
            ? 'Reconciliation — room rate increase for month'
            : 'Reconciliation — adjusted to actual amount'),
        accrualMonth: monthNum,
        accrualYear: yearNum,
        originalAccrualId: originalAccrual?._id
    };

    const incomeEntry = isIncrease
        ? {
            accountCode: incomeAccount.code,
            accountName: incomeAccount.name,
            accountType: incomeAccount.type,
            debit: 0,
            credit: adjustmentAmount,
            description: `Rent income increase - negotiated adjustment - ${studentName}`,
            metadata: adjustmentMetadata
        }
        : {
            accountCode: incomeAccount.code,
            accountName: incomeAccount.name,
            accountType: incomeAccount.type,
            debit: adjustmentAmount,
            credit: 0,
            description: `Rent income reduction - negotiated discount - ${studentName}`,
            metadata: adjustmentMetadata
        };

    const arEntry = isIncrease
        ? {
            accountCode: debtorAccountCode,
            accountName: studentARAccount.name,
            accountType: 'Asset',
            debit: adjustmentAmount,
            credit: 0,
            description: `A/R increase - negotiated rent - ${studentName}`,
            metadata: adjustmentMetadata
        }
        : {
            accountCode: debtorAccountCode,
            accountName: studentARAccount.name,
            accountType: 'Asset',
            debit: 0,
            credit: adjustmentAmount,
            description: `A/R reduction - negotiated rent - ${studentName}`,
            metadata: adjustmentMetadata
        };

    const transaction = await TransactionEntry.create({
        description: description || `Negotiated rent adjustment for ${studentName} - ${monthNum}/${yearNum}`,
        reference: `NEG-RENT-${Date.now()}`,
        date: accrualDate,
        source: 'manual',
        sourceModel: 'TransactionEntry',
        sourceId: userId,
        status: 'posted',
        createdBy: userId,
        transactionId: `NEG-RENT-${Date.now()}`,
        residence: residenceId ? new mongoose.Types.ObjectId(residenceId) : originalAccrual?.residence,
        totalDebit: adjustmentAmount,
        totalCredit: adjustmentAmount,
        entries: [incomeEntry, arEntry],
        metadata: {
            ...adjustmentMetadata,
            type: 'negotiated_payment_adjustment',
            residenceId: residenceId || originalAccrual?.metadata?.residenceId,
            isNegotiated: true,
            isAdjustment: true,
            createdBy: userId,
            createdByEmail: user?.email
        }
    });

    const { syncDebtorTotalsWithAR } = require('./debtorService');
    await syncDebtorTotalsWithAR(debtor._id.toString());

    return {
        success: true,
        transactionId: transaction._id.toString(),
        adjustmentAmount,
        adjustmentDirection: isIncrease ? 'increase' : 'decrease',
        discountAmount: isIncrease ? 0 : adjustmentAmount,
        originalAmount: original,
        negotiatedAmount: negotiated
    };
}

module.exports = {
    createRentNegotiationAdjustment
};
