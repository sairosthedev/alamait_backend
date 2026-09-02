/**
 * Compare an external payment list (CSV/Excel/spreadsheet) against system journals
 * or a second list, with fuzzy tenant name matching and discrepancy reporting.
 */
const ExcelJS = require('exceljs');
const TransactionEntry = require('../models/TransactionEntry');
const {
    resolveDebtorForCustomer,
    buildExcelPaymentDedupKey,
    scorePersonNameMatch,
    detectAndParseSheet,
    loadWorkbookFromBuffer,
    resolveSheetsToProcess,
    normalizeSheetName,
    isMonthSheetName,
    toNumber
} = require('./journalExcelUploadService');

const AMOUNT_TOLERANCE = 0.01;

const MONTH_ABBR_LIST = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_FULL_LIST = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];

function parseMonthYearFromSheetName(sheetName) {
    const n = normalizeSheetName(sheetName);
    if (!n) return { month: null, year: null };

    let idx = MONTH_ABBR_LIST.indexOf(n);
    if (idx < 0) idx = MONTH_FULL_LIST.indexOf(n);
    if (idx >= 0) return { month: idx + 1, year: null };

    const abbrMatch = n.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{2,4})$/);
    if (abbrMatch) {
        const yRaw = abbrMatch[2];
        const y = parseInt(yRaw.length === 2 ? `20${yRaw}` : yRaw, 10);
        return { month: MONTH_ABBR_LIST.indexOf(abbrMatch[1]) + 1, year: y };
    }

    const fullMatch = n.match(
        /^(january|february|march|april|may|june|july|august|september|october|november|december)(\d{2,4})$/
    );
    if (fullMatch) {
        const yRaw = fullMatch[2];
        const y = parseInt(yRaw.length === 2 ? `20${yRaw}` : yRaw, 10);
        return { month: MONTH_FULL_LIST.indexOf(fullMatch[1]) + 1, year: y };
    }

    return { month: null, year: null };
}

function resolvePaymentPeriodFilter({ sheetName, month, year }) {
    let m = month != null && month !== '' ? parseInt(month, 10) : null;
    let y = year != null && year !== '' ? parseInt(year, 10) : null;
    let filterMode = 'all';

    if (sheetName && isMonthSheetName(sheetName)) {
        const parsed = parseMonthYearFromSheetName(sheetName);
        if (parsed.month) m = parsed.month;
        if (parsed.year) y = parsed.year;
        filterMode = 'transaction_date';
    } else if (m && y) {
        filterMode = 'transaction_date';
    } else if (sheetName) {
        filterMode = 'metadata_sheet_name';
    }

    if (m && !y) {
        y = new Date().getFullYear();
    }

    return {
        month: Number.isNaN(m) ? null : m,
        year: Number.isNaN(y) ? null : y,
        filterMode,
        sheetName: sheetName || null
    };
}

const PAYMENT_SOURCE_OR = [
    { 'metadata.invoiceRowType': 'payment' },
    {
        source: 'payment',
        'metadata.transactionType': {
            $in: [
                'manual_double_entry_excel_invoice',
                'manual_double_entry_excel',
                'manual_double_entry_csv'
            ]
        }
    },
    {
        'metadata.transactionType': {
            $in: [
                'manual_double_entry_excel_invoice',
                'manual_double_entry_excel',
                'manual_double_entry_csv'
            ]
        }
    }
];

function roundAmount(n) {
    return Math.round(Number(n) * 100) / 100;
}

function amountsEqual(a, b) {
    return Math.abs(roundAmount(a) - roundAmount(b)) <= AMOUNT_TOLERANCE;
}

function normalizeRow(row) {
    const name = String(row.name || row.customer || row.studentName || '').trim();
    const amount = roundAmount(
        row.amount ?? row.paymentTotal ?? row.payment ?? row.total ?? row.value ?? 0
    );
    return {
        name,
        amount,
        room: row.room || row.roomNumber || null,
        sheetName: row.sheetName || null,
        transactionId: row.transactionId || null,
        _id: row._id || null,
        debtorId: row.debtorId || null,
        studentId: row.studentId || null,
        date: row.date || null,
        description: row.description || null
    };
}

function cellRaw(cell) {
    if (!cell || cell.value == null) return null;
    if (typeof cell.value === 'object' && cell.value.result != null) return cell.value.result;
    if (typeof cell.value === 'object' && cell.value.text != null) return cell.value.text;
    return cell.value;
}

async function parseSimpleNameAmountFromBuffer(buffer, { sheetName = null } = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws =
        (sheetName && workbook.getWorksheet(sheetName)) ||
        workbook.worksheets.find((s) => !/^instructions?$/i.test(s.name)) ||
        workbook.worksheets[0];
    if (!ws) return [];

    const rows = [];
    ws.eachRow((row, rowNumber) => {
        const a = String(cellRaw(row.getCell(1)) ?? '').trim();
        const b = toNumber(cellRaw(row.getCell(2)));
        if (!a || b === 0) return;
        if (rowNumber === 1 && /^(name|customer|tenant|student)/i.test(a)) return;
        rows.push(normalizeRow({ name: a, amount: b, sheetName: ws.name }));
    });
    return rows;
}

async function parseUploadRowsFromExcel(buffer, { sheetName, defaultDate } = {}) {
    const workbook = await loadWorkbookFromBuffer(buffer);
    const resolved = resolveSheetsToProcess(workbook, sheetName || 'all');
    const rows = [];

    for (const sheet of resolved.sheets || []) {
        const parsed = detectAndParseSheet(sheet, {
            defaultDate,
            mode: 'payments',
            sheetName: sheet.name
        });
        for (const row of parsed.proposed || []) {
            if (row.type !== 'payment') continue;
            const total =
                (row.payments || []).reduce((s, p) => s + (Number(p) || 0), 0) ||
                row.paymentTotal ||
                0;
            if (total <= 0) continue;
            rows.push(
                normalizeRow({
                    name: row.customer,
                    amount: total,
                    room: row.roomNumber,
                    sheetName: sheet.name
                })
            );
        }
    }
    return rows;
}

async function parseRowsFromUploadFile(buffer, { format = 'auto', sheetName, defaultDate } = {}) {
    if (format === 'simple') {
        return parseSimpleNameAmountFromBuffer(buffer, { sheetName });
    }
    if (format === 'journal') {
        return parseUploadRowsFromExcel(buffer, { sheetName, defaultDate });
    }

    const journalRows = await parseUploadRowsFromExcel(buffer, { sheetName, defaultDate });
    if (journalRows.length) return journalRows;
    return parseSimpleNameAmountFromBuffer(buffer, { sheetName });
}

async function fetchSystemPayments({ residenceId, sheetName, month, year }) {
    const period = resolvePaymentPeriodFilter({ sheetName, month, year });

    const query = {
        residence: residenceId,
        status: { $ne: 'reversed' },
        totalDebit: { $gt: 0 },
        $or: PAYMENT_SOURCE_OR
    };

    if (period.filterMode === 'transaction_date' && period.month && period.year) {
        query.date = {
            $gte: new Date(period.year, period.month - 1, 1),
            $lte: new Date(period.year, period.month, 0, 23, 59, 59, 999)
        };
    } else if (period.filterMode === 'metadata_sheet_name' && sheetName) {
        query['metadata.sheetName'] = new RegExp(`^${normalizeSheetName(sheetName)}$`, 'i');
    }

    const txns = await TransactionEntry.find(query)
        .select('transactionId totalDebit date description metadata residence source status')
        .sort({ date: 1, createdAt: 1 })
        .lean();

    const rows = txns.map((t) =>
        normalizeRow({
            name: t.metadata?.customer || '',
            amount: t.totalDebit,
            room: t.metadata?.roomNumber,
            transactionId: t.transactionId,
            _id: t._id?.toString(),
            debtorId: t.metadata?.debtorId,
            studentId: t.metadata?.studentId,
            date: t.date,
            description: t.description,
            sheetName: t.metadata?.sheetName
        })
    );

    return { rows, period };
}

async function enrichWithDebtor(rows, residenceId, cache) {
    const enriched = [];
    for (const row of rows) {
        if (!row.name) {
            enriched.push({ ...row, resolveError: 'Empty name' });
            continue;
        }
        const resolved = await resolveDebtorForCustomer(row.name, {
            roomNumber: row.room,
            residenceId,
            cache
        });
        enriched.push({
            ...row,
            debtorId: resolved.ok ? resolved.debtorId : row.debtorId || null,
            studentId: resolved.ok ? resolved.studentId : row.studentId || null,
            systemName: resolved.ok ? resolved.matchedName : null,
            matchMethod: resolved.ok ? resolved.matchMethod : null,
            nameMatchedAs: resolved.ok ? resolved.nameMatchedAs : null,
            resolveError: resolved.ok ? null : resolved.error
        });
    }
    return enriched;
}

function pickUnused(candidates, usedSystemIndices) {
    return (candidates || []).filter((c) => !usedSystemIndices.has(c.idx));
}

function matchRows(externalRows, systemRows) {
    const matched = [];
    const amountMismatch = [];
    const missingInSystem = [];
    const extraInSystem = [];
    const unmatchedExternal = [];

    const systemByDebtorAmount = new Map();
    const systemByDedupKey = new Map();
    const usedSystemIndices = new Set();

    systemRows.forEach((row, idx) => {
        if (row.debtorId) {
            const key = `${row.debtorId}|${roundAmount(row.amount).toFixed(2)}`;
            if (!systemByDebtorAmount.has(key)) systemByDebtorAmount.set(key, []);
            systemByDebtorAmount.get(key).push({ row, idx });
        }
        const dk = buildExcelPaymentDedupKey({
            customer: row.name,
            amount: row.amount,
            date: row.date,
            sheetName: row.sheetName
        });
        if (dk) {
            if (!systemByDedupKey.has(dk)) systemByDedupKey.set(dk, []);
            systemByDedupKey.get(dk).push({ row, idx });
        }
    });

    for (const ext of externalRows) {
        if (!ext.name) {
            unmatchedExternal.push({ ...ext, reason: 'Empty name' });
            continue;
        }

        let systemMatch = null;
        let matchMethod = null;
        let systemIdx = -1;

        if (ext.debtorId) {
            const key = `${ext.debtorId}|${roundAmount(ext.amount).toFixed(2)}`;
            const candidates = pickUnused(systemByDebtorAmount.get(key), usedSystemIndices);
            if (candidates.length === 1) {
                systemMatch = candidates[0].row;
                systemIdx = candidates[0].idx;
                matchMethod = 'debtor_id_amount';
            }
        }

        if (!systemMatch) {
            const dk = buildExcelPaymentDedupKey({
                customer: ext.name,
                amount: ext.amount,
                sheetName: ext.sheetName
            });
            const candidates = pickUnused(systemByDedupKey.get(dk), usedSystemIndices);
            if (candidates.length === 1) {
                systemMatch = candidates[0].row;
                systemIdx = candidates[0].idx;
                matchMethod = 'name_amount_key';
            }
        }

        if (!systemMatch && ext.debtorId) {
            for (let i = 0; i < systemRows.length; i++) {
                if (usedSystemIndices.has(i)) continue;
                if (systemRows[i].debtorId === ext.debtorId) {
                    systemMatch = systemRows[i];
                    systemIdx = i;
                    matchMethod = 'debtor_id';
                    break;
                }
            }
        }

        if (!systemMatch) {
            let best = null;
            for (let i = 0; i < systemRows.length; i++) {
                if (usedSystemIndices.has(i)) continue;
                const sys = systemRows[i];
                const score = scorePersonNameMatch(ext.name, sys.name);
                if (score >= 0.82 && amountsEqual(ext.amount, sys.amount)) {
                    if (!best || score > best.score) best = { row: sys, idx: i, score };
                }
            }
            if (best) {
                systemMatch = best.row;
                systemIdx = best.idx;
                matchMethod = `fuzzy_name_amount_${best.score.toFixed(2)}`;
            }
        }

        if (!systemMatch) {
            let best = null;
            for (let i = 0; i < systemRows.length; i++) {
                if (usedSystemIndices.has(i)) continue;
                const sys = systemRows[i];
                const score =
                    ext.debtorId && sys.debtorId && ext.debtorId === sys.debtorId
                        ? 1
                        : scorePersonNameMatch(ext.name, sys.name);
                if (score >= 0.82) {
                    if (!best || score > best.score) best = { row: sys, idx: i, score };
                }
            }
            if (best) {
                systemMatch = best.row;
                systemIdx = best.idx;
                matchMethod =
                    best.score >= 0.99 ? 'debtor_or_fuzzy_name' : `fuzzy_name_${best.score.toFixed(2)}`;
            }
        }

        if (!systemMatch) {
            if (!ext.debtorId) {
                unmatchedExternal.push({
                    ...ext,
                    reason: ext.resolveError || 'No debtor match for this name'
                });
            } else {
                missingInSystem.push({
                    ...ext,
                    reason: 'On upload list but no matching system payment'
                });
            }
            continue;
        }

        usedSystemIndices.add(systemIdx);

        const nameNote =
            ext.nameMatchedAs ||
            (ext.systemName && ext.systemName.toLowerCase() !== ext.name.toLowerCase()
                ? `${ext.name} → ${ext.systemName}`
                : systemMatch.name &&
                    systemMatch.name.toLowerCase() !== ext.name.toLowerCase()
                  ? `${ext.name} → ${systemMatch.name}`
                  : null);

        if (amountsEqual(ext.amount, systemMatch.amount)) {
            matched.push({
                status: 'matched',
                external: ext,
                system: systemMatch,
                matchMethod,
                nameNote
            });
        } else {
            amountMismatch.push({
                status: 'amount_mismatch',
                external: ext,
                system: systemMatch,
                matchMethod,
                externalAmount: ext.amount,
                systemAmount: systemMatch.amount,
                difference: roundAmount(ext.amount - systemMatch.amount),
                nameNote
            });
        }
    }

    systemRows.forEach((row, idx) => {
        if (!usedSystemIndices.has(idx)) {
            extraInSystem.push({
                ...row,
                reason: 'In system but not on external/upload list'
            });
        }
    });

    const externalTotal = roundAmount(externalRows.reduce((s, r) => s + (r.amount || 0), 0));
    const systemTotal = roundAmount(systemRows.reduce((s, r) => s + (r.amount || 0), 0));

    return {
        summary: {
            externalCount: externalRows.length,
            systemCount: systemRows.length,
            externalTotal,
            systemTotal,
            totalDifference: roundAmount(externalTotal - systemTotal),
            matched: matched.length,
            amountMismatch: amountMismatch.length,
            missingInSystem: missingInSystem.length,
            extraInSystem: extraInSystem.length,
            unmatchedExternal: unmatchedExternal.length
        },
        matched,
        amountMismatch,
        missingInSystem,
        extraInSystem,
        unmatchedExternal
    };
}

async function reconcilePayments({
    residenceId,
    externalRows,
    compareRows = null,
    sheetName = null,
    month = null,
    year = null
}) {
    const cache = new Map();
    const normalizedExternal = (externalRows || []).map(normalizeRow);
    const enrichedExternal = await enrichWithDebtor(normalizedExternal, residenceId, cache);

    let systemRows;
    if (compareRows && compareRows.length) {
        const normalizedCompare = compareRows.map(normalizeRow);
        const rawCompare = normalizedCompare.map((r) => ({ ...r }));
        const enriched = await enrichWithDebtor(normalizedCompare, residenceId, cache);
        systemRows = enriched.map((r, i) => ({ ...rawCompare[i], ...r }));
    } else {
        const rawSystem = await fetchSystemPayments({ residenceId, sheetName, month, year });
        const enriched = await enrichWithDebtor(rawSystem.rows, residenceId, cache);
        systemRows = enriched.map((r, i) => ({ ...rawSystem.rows[i], ...r }));
    }

    const report = matchRows(enrichedExternal, systemRows);
    report.filters = {
        residenceId,
        sheetName: sheetName || null,
        month: month != null ? parseInt(month, 10) : null,
        year: year != null ? parseInt(year, 10) : null,
        compareMode: compareRows?.length ? 'list_vs_list' : 'list_vs_system'
    };
    return report;
}

module.exports = {
    reconcilePayments,
    parseRowsFromUploadFile,
    parseSimpleNameAmountFromBuffer,
    parseUploadRowsFromExcel,
    fetchSystemPayments,
    resolvePaymentPeriodFilter,
    normalizeRow,
    roundAmount,
    amountsEqual
};
