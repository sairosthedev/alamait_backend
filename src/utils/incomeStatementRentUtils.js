const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

const RENT_INCOME_ACCOUNT = '4001';

function getTransactionId(transaction) {
    if (!transaction) return null;
    if (transaction._id) return transaction._id.toString();
    if (transaction.id) return transaction.id.toString();
    if (transaction.transactionId) return transaction.transactionId;
    return null;
}

function isAccrualTransaction(transaction = {}) {
    const source = transaction.source || '';
    const metadataType = transaction.metadata?.type || '';
    return source === 'rental_accrual'
        || metadataType === 'monthly_rent_accrual'
        || metadataType === 'lease_start';
}

function isReversalTransaction(transaction = {}) {
    const source = (transaction.source || '').toLowerCase();
    const metadataType = (transaction.metadata?.type || '').toLowerCase();
    const transactionType = (transaction.metadata?.transactionType || '').toLowerCase();
    const description = (transaction.description || '').toLowerCase();

    return source.includes('reversal')
        || metadataType.includes('reversal')
        || transactionType.includes('reversal')
        || description.includes('reversal');
}

function isNegotiationAdjustment(transaction = {}) {
    const transactionType = (transaction.metadata?.transactionType || '').toLowerCase();
    const description = (transaction.description || '').toLowerCase();
    return transactionType === 'negotiated_payment_adjustment'
        || description.includes('negotiated payment')
        || description.includes('negotiated rent')
        || description.includes('negotiated discount');
}

function mergeNegotiatedAccrual(accrualTransaction, adjustmentTransactions = [], accountCode) {
    if (!accrualTransaction) return null;

    const mergedTransaction = {
        ...accrualTransaction,
        metadata: {
            ...accrualTransaction.metadata,
            negotiatedAdjustmentCount: adjustmentTransactions.length,
            negotiatedDiscountTotal: 0,
            negotiatedNetAmount: 0
        },
        entries: (accrualTransaction.entries || []).map(entry => ({ ...entry }))
    };

    const adjustmentTotalsByAccount = new Map();

    adjustmentTransactions.forEach(adj => {
        (adj.entries || []).forEach(entry => {
            const key = entry.accountCode;
            if (!key) return;
            const netEffect = (entry.debit || 0) - (entry.credit || 0);
            adjustmentTotalsByAccount.set(key, (adjustmentTotalsByAccount.get(key) || 0) + netEffect);
        });
    });

    mergedTransaction.entries = mergedTransaction.entries.map(entry => {
        const adjustment = adjustmentTotalsByAccount.get(entry.accountCode);
        if (!adjustment) return entry;

        const adjustedEntry = { ...entry };
        adjustedEntry.debit = adjustedEntry.debit || 0;
        adjustedEntry.credit = adjustedEntry.credit || 0;

        if (adjustment > 0) {
            if (adjustedEntry.credit >= adjustment) {
                adjustedEntry.credit -= adjustment;
            } else {
                const remaining = adjustment - adjustedEntry.credit;
                adjustedEntry.credit = 0;
                adjustedEntry.debit += remaining;
            }
        } else if (adjustment < 0) {
            const creditAmount = Math.abs(adjustment);
            if (adjustedEntry.debit >= creditAmount) {
                adjustedEntry.debit -= creditAmount;
            } else {
                const remaining = creditAmount - adjustedEntry.debit;
                adjustedEntry.debit = 0;
                adjustedEntry.credit += remaining;
            }
        }

        return adjustedEntry;
    });

    if (accountCode) {
        const netEntry = mergedTransaction.entries.find(entry =>
            entry.accountCode === accountCode || entry.accountCode?.startsWith(`${accountCode}-`)
        );

        if (netEntry) {
            mergedTransaction.metadata.negotiatedNetAmount = (netEntry.credit || 0) - (netEntry.debit || 0);
            mergedTransaction.description = `${mergedTransaction.description || ''} (Negotiated to $${mergedTransaction.metadata.negotiatedNetAmount || 0})`.trim();
        }
    }

    mergedTransaction.metadata.negotiatedDiscountTotal = Array.from(adjustmentTotalsByAccount.values())
        .filter(value => value > 0)
        .reduce((sum, value) => sum + value, 0);

    return mergedTransaction;
}

function removeReversalsAndCollapseNegotiations(transactions = [], accountCode = RENT_INCOME_ACCOUNT) {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];

    const accrualTransactions = new Map();
    const negotiationAdjustments = new Map();
    const reversalAccrualIds = new Set();
    const remainingTransactions = [];

    transactions.forEach(transaction => {
        const txId = getTransactionId(transaction);
        const originalAccrualId = transaction?.metadata?.originalAccrualId
            ? String(transaction.metadata.originalAccrualId)
            : null;

        if (isReversalTransaction(transaction)) {
            if (originalAccrualId) reversalAccrualIds.add(originalAccrualId);
            return;
        }

        if (isNegotiationAdjustment(transaction) && originalAccrualId) {
            if (!negotiationAdjustments.has(originalAccrualId)) {
                negotiationAdjustments.set(originalAccrualId, []);
            }
            negotiationAdjustments.get(originalAccrualId).push(transaction);
            return;
        }

        if (isAccrualTransaction(transaction) && txId) {
            accrualTransactions.set(txId, transaction);
            return;
        }

        remainingTransactions.push(transaction);
    });

    for (const [accrualId, accrualTransaction] of accrualTransactions.entries()) {
        if (reversalAccrualIds.has(accrualId)) {
            negotiationAdjustments.delete(accrualId);
            continue;
        }

        if (negotiationAdjustments.has(accrualId)) {
            const merged = mergeNegotiatedAccrual(
                accrualTransaction,
                negotiationAdjustments.get(accrualId),
                accountCode
            );
            if (merged) remainingTransactions.push(merged);
            negotiationAdjustments.delete(accrualId);
        } else {
            remainingTransactions.push(accrualTransaction);
        }
    }

    negotiationAdjustments.forEach(adjustments => {
        adjustments.forEach(adj => remainingTransactions.push(adj));
    });

    remainingTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    return remainingTransactions;
}

function matchesAccrualPeriod(metadata = {}, month, year) {
    const accrualMonth = metadata.accrualMonth != null ? Number(metadata.accrualMonth) : null;
    const accrualYear = metadata.accrualYear != null ? Number(metadata.accrualYear) : null;
    if (accrualMonth === month && accrualYear === year) {
        return true;
    }
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    return metadata.month === monthKey || metadata.monthSettled === monthKey;
}

function transactionBelongsToMonth(transaction, month, year) {
    const metadata = transaction.metadata || {};

    if (isReversalTransaction(transaction) && matchesAccrualPeriod(metadata, month, year)) {
        return true;
    }

    if (isNegotiationAdjustment(transaction) && matchesAccrualPeriod(metadata, month, year)) {
        return true;
    }

    if (metadata.originalAccrualId && matchesAccrualPeriod(metadata, month, year)) {
        return true;
    }

    if (metadata.type === 'monthly_rent_accrual') {
        if (matchesAccrualPeriod(metadata, month, year)) return true;
        const transactionDate = new Date(transaction.date);
        return transactionDate.getFullYear() === year
            && transactionDate.getMonth() + 1 === month;
    }

    if (metadata.type === 'lease_start'
        || (transaction.description && transaction.description.toLowerCase().includes('lease start'))) {
        if (metadata.accrualMonth && metadata.accrualYear) {
            return metadata.accrualMonth === month && metadata.accrualYear === year;
        }
        const transactionDate = new Date(transaction.date);
        return transactionDate.getFullYear() === year
            && transactionDate.getMonth() + 1 === month;
    }

    if (metadata.transactionType === 'negotiated_payment_adjustment') {
        return metadata.accrualMonth === month && metadata.accrualYear === year;
    }

    const transactionDate = new Date(transaction.date);
    return transactionDate.getFullYear() === year
        && transactionDate.getMonth() + 1 === month;
}

function filterTransactionsForMonth(transactions, month, year) {
    return transactions.filter(transaction => transactionBelongsToMonth(transaction, month, year));
}

function bucketTransactionsByYearMonth(transactions, year) {
    const buckets = Array.from({ length: 13 }, () => []);
    for (const transaction of transactions) {
        for (let month = 1; month <= 12; month++) {
            if (transactionBelongsToMonth(transaction, month, year)) {
                buckets[month].push(transaction);
            }
        }
    }
    return buckets;
}

function buildResidenceOr(residenceId) {
    const residenceOr = [
        { residence: residenceId },
        { 'metadata.residenceId': String(residenceId) },
        { 'metadata.residence': residenceId }
    ];

    if (mongoose.Types.ObjectId.isValid(residenceId)) {
        const oid = new mongoose.Types.ObjectId(residenceId);
        residenceOr.push(
            { residence: oid },
            { 'metadata.residenceId': oid },
            { 'metadata.residence': oid }
        );
    }

    return residenceOr;
}

function applyResidenceFilter(condition, residenceId) {
    if (!residenceId) return condition;
    return { $and: [condition, { $or: buildResidenceOr(residenceId) }] };
}

function buildAccountMonthQuery({ month, year, accountCodes, residenceId }) {
    const monthIndex = month - 1;
    const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    // Scoped to one residence: single indexed-friendly query instead of many $or branches.
    if (residenceId) {
        return {
            status: 'posted',
            'entries.accountCode': { $in: accountCodes },
            $and: [
                { $or: buildResidenceOr(residenceId) },
                {
                    $or: [
                        { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
                        { 'metadata.month': monthKey },
                        { 'metadata.monthSettled': monthKey },
                        { date: { $gte: startOfMonth, $lte: endOfMonth } }
                    ]
                }
            ]
        };
    }

    const baseConditions = [
        {
            date: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            'metadata.monthSettled': monthKey,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            source: 'rental_accrual',
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            source: 'rental_accrual',
            'metadata.type': 'lease_start',
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            source: 'rental_accrual',
            description: { $regex: /lease start/i },
            date: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            source: 'rental_accrual',
            'metadata.type': 'monthly_rent_accrual',
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            'metadata.month': monthKey,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            'metadata.originalAccrualId': { $exists: true },
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        },
        {
            source: 'manual',
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            status: 'posted',
            'entries.accountCode': { $in: accountCodes }
        }
    ];

    return {
        $or: baseConditions.map(condition => applyResidenceFilter(condition, residenceId))
    };
}

async function resolveAccountCodes(accountCode = RENT_INCOME_ACCOUNT) {
    const mainAccount = await Account.findOne({ code: accountCode });
    if (!mainAccount || (!accountCode.startsWith('400') && !accountCode.startsWith('500'))) {
        return [accountCode];
    }

    const childAccounts = await Account.find({
        parentAccount: mainAccount._id,
        isActive: true,
        type: mainAccount.type
    }).select('code').lean();

    return [accountCode, ...childAccounts.map(child => child.code)];
}

function extractRentIncomeAmount(transaction, accountCodes = [RENT_INCOME_ACCOUNT]) {
    let credit = 0;
    let debit = 0;
    for (const entry of transaction.entries || []) {
        if (!accountCodes.includes(entry.accountCode)) continue;
        credit += entry.credit || 0;
        debit += entry.debit || 0;
    }
    return Math.round((credit - debit) * 100) / 100;
}

function extractGrossRentIncomeAmount(transaction, accountCodes = [RENT_INCOME_ACCOUNT]) {
    const net = extractRentIncomeAmount(transaction, accountCodes);
    const discount = transaction.metadata?.negotiatedDiscountTotal || 0;
    if (discount > 0) return Math.round((net + discount) * 100) / 100;
    return net;
}

function collectTransactionLookupKeys(transaction) {
    const keys = new Set();
    const meta = transaction.metadata || {};

    if (meta.studentId) keys.add(String(meta.studentId));
    if (meta.userId) keys.add(String(meta.userId));
    if (meta.applicationId) {
        keys.add(String(meta.applicationId));
        keys.add(`app:${meta.applicationId}`);
    }
    if (meta.debtorId) keys.add(`debtor:${meta.debtorId}`);

    for (const entry of transaction.entries || []) {
        if (entry.accountCode?.startsWith('1100-') && entry.accountCode !== '1100') {
            keys.add(`ar:${entry.accountCode.replace('1100-', '')}`);
            keys.add(entry.accountCode);
        }
    }

    return keys;
}

function buildStudentRentLookup(processedTransactions, accountCodes = [RENT_INCOME_ACCOUNT]) {
    const lookup = new Map();

    for (const tx of processedTransactions) {
        const netAmount = extractRentIncomeAmount(tx, accountCodes);
        const grossAmount = extractGrossRentIncomeAmount(tx, accountCodes);
        const payload = {
            netAmount,
            grossAmount,
            negotiationDiscount: Math.round((grossAmount - netAmount) * 100) / 100,
            transactionId: getTransactionId(tx),
            transaction: tx,
            hasAccrual: isAccrualTransaction(tx) || netAmount > 0
        };

        for (const key of collectTransactionLookupKeys(tx)) {
            lookup.set(key, payload);
        }
    }

    return lookup;
}

function lookupStudentRentFromLedger(lookup, { studentId, applicationId, debtorId, debtorAccountCode }) {
    const tryKeys = [
        studentId,
        applicationId,
        applicationId && `app:${applicationId}`,
        debtorId && `debtor:${debtorId}`,
        debtorAccountCode,
        debtorAccountCode && `ar:${debtorAccountCode.replace('1100-', '')}`,
        debtorId && `ar:${debtorId}`
    ].filter(Boolean);

    for (const key of tryKeys) {
        if (lookup.has(key)) return lookup.get(key);
    }
    return null;
}

async function loadProcessedRentTransactionsForPeriod({
    month,
    year,
    residenceId,
    accountCode = RENT_INCOME_ACCOUNT
}) {
    const accountCodes = await resolveAccountCodes(accountCode);
    const query = buildAccountMonthQuery({ month, year, accountCodes, residenceId });
    const transactions = await TransactionEntry.find(query)
        .select('description date entries metadata source status transactionId residence')
        .sort({ date: 1 })
        .lean();
    const filtered = filterTransactionsForMonth(transactions, month, year);
    const processed = removeReversalsAndCollapseNegotiations(filtered, accountCode);

    return {
        accountCodes,
        rawCount: transactions.length,
        filteredCount: filtered.length,
        processedCount: processed.length,
        processedTransactions: processed,
        lookup: buildStudentRentLookup(processed, accountCodes)
    };
}

/**
 * Sum net rent income from processed transactions (matches account-details drill-down).
 */
function aggregateProcessedRentRevenue(processedTransactions, accountCodes = [RENT_INCOME_ACCOUNT]) {
    const byAccountCode = {};
    const byAccountName = {};
    let total = 0;

    for (const tx of processedTransactions || []) {
        const net = extractRentIncomeAmount(tx, accountCodes);
        if (!net) continue;
        total += net;

        const incomeEntry = (tx.entries || []).find(e =>
            accountCodes.includes(e.accountCode)
        );
        const code = incomeEntry?.accountCode || accountCodes[0];
        byAccountCode[code] = Math.round(((byAccountCode[code] || 0) + net) * 100) / 100;

        const nameKey = `${code} - ${incomeEntry?.accountName || code}`;
        byAccountName[nameKey] = Math.round(((byAccountName[nameKey] || 0) + net) * 100) / 100;
    }

    return {
        total: Math.round(total * 100) / 100,
        byAccountCode,
        byAccountName
    };
}

function buildAccountYearQuery({ year, accountCodes, residenceId }) {
    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const timeOr = [
        { 'metadata.accrualYear': year },
        { date: { $gte: startOfYear, $lte: endOfYear } }
    ];

    if (residenceId) {
        return {
            status: 'posted',
            'entries.accountCode': { $in: accountCodes },
            $and: [
                { $or: buildResidenceOr(residenceId) },
                { $or: timeOr }
            ]
        };
    }

    return {
        status: 'posted',
        'entries.accountCode': { $in: accountCodes },
        $or: timeOr
    };
}

/**
 * Load all months for a year in two DB queries (4001 + 4002) instead of 24.
 */
async function loadYearMonthlyRentRevenue({ year, residenceId, accountCodes = ['4001', '4002'] }) {
    const monthly = {};
    for (let month = 1; month <= 12; month++) {
        monthly[month] = {
            total: 0,
            byAccountCode: {},
            byAccountName: {},
            transactionCount: 0
        };
    }

    const resolvedByRoot = new Map();
    const allCodesSet = new Set();
    for (const accountCode of accountCodes) {
        const codes = await resolveAccountCodes(accountCode);
        resolvedByRoot.set(accountCode, codes);
        codes.forEach(code => allCodesSet.add(code));
    }

    const query = buildAccountYearQuery({
        year,
        accountCodes: [...allCodesSet],
        residenceId
    });
    const transactions = await TransactionEntry.find(query)
        .select('description date entries metadata source status transactionId residence')
        .sort({ date: 1 })
        .lean();

    const buckets = bucketTransactionsByYearMonth(transactions, year);

    for (let month = 1; month <= 12; month++) {
        const monthTransactions = buckets[month];
        for (const accountCode of accountCodes) {
            const codes = resolvedByRoot.get(accountCode);
            const processed = removeReversalsAndCollapseNegotiations(monthTransactions, accountCode);
            const agg = aggregateProcessedRentRevenue(processed, codes);

            monthly[month].transactionCount += processed.length;
            monthly[month].total += agg.total;

            for (const [code, amount] of Object.entries(agg.byAccountCode)) {
                monthly[month].byAccountCode[code] = Math.round(
                    ((monthly[month].byAccountCode[code] || 0) + amount) * 100
                ) / 100;
            }
            for (const [key, amount] of Object.entries(agg.byAccountName)) {
                monthly[month].byAccountName[key] = Math.round(
                    ((monthly[month].byAccountName[key] || 0) + amount) * 100
                ) / 100;
            }
        }
    }

    for (let month = 1; month <= 12; month++) {
        monthly[month].total = Math.round(monthly[month].total * 100) / 100;
    }

    return monthly;
}

/**
 * Load and aggregate 4001 + 4002 for one calendar month (same pipeline as account-details).
 */
async function loadMonthlyRentRevenue({ month, year, residenceId, accountCodes = ['4001', '4002'] }) {
    const combined = {
        total: 0,
        byAccountCode: {},
        byAccountName: {},
        transactionCount: 0
    };

    for (const accountCode of accountCodes) {
        const ledger = await loadProcessedRentTransactionsForPeriod({
            month,
            year,
            residenceId,
            accountCode
        });
        combined.transactionCount += ledger.processedCount;
        const agg = aggregateProcessedRentRevenue(ledger.processedTransactions, ledger.accountCodes);
        combined.total += agg.total;
        for (const [code, amount] of Object.entries(agg.byAccountCode)) {
            combined.byAccountCode[code] = Math.round(((combined.byAccountCode[code] || 0) + amount) * 100) / 100;
        }
        for (const [key, amount] of Object.entries(agg.byAccountName)) {
            combined.byAccountName[key] = Math.round(((combined.byAccountName[key] || 0) + amount) * 100) / 100;
        }
    }

    combined.total = Math.round(combined.total * 100) / 100;
    return combined;
}

module.exports = {
    RENT_INCOME_ACCOUNT,
    getTransactionId,
    isAccrualTransaction,
    isReversalTransaction,
    isNegotiationAdjustment,
    mergeNegotiatedAccrual,
    removeReversalsAndCollapseNegotiations,
    filterTransactionsForMonth,
    transactionBelongsToMonth,
    bucketTransactionsByYearMonth,
    buildAccountMonthQuery,
    resolveAccountCodes,
    extractRentIncomeAmount,
    extractGrossRentIncomeAmount,
    collectTransactionLookupKeys,
    buildStudentRentLookup,
    lookupStudentRentFromLedger,
    loadProcessedRentTransactionsForPeriod,
    aggregateProcessedRentRevenue,
    loadMonthlyRentRevenue,
    loadYearMonthlyRentRevenue
};
