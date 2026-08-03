/**
 * Parse Excel workbooks for bulk journal upload.
 * Supports:
 *  1) Classic double-entry rows (journal_key + account_code + debit/credit)
 *  2) Invoice / payment billing sheets (Customer, Rental, Admin Fee, Payment 1/2/3)
 */
const ExcelJS = require('exceljs');

function normalizeHeader(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function cellRaw(cell) {
    if (!cell) return null;
    let v = cell.value;
    if (v && typeof v === 'object') {
        if (v.result != null) v = v.result;
        else if (v.text != null) v = v.text;
        else if (v instanceof Date) return v;
        else if (Array.isArray(v.richText)) v = v.richText.map((t) => t.text).join('');
    }
    return v;
}

function toNumber(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v).replace(/[$,\s]/g, '').trim());
    return Number.isFinite(n) ? n : 0;
}

function toDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    if (typeof v === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + v * 86400000);
    }
    const s = String(v).trim();
    // MM/DD/YY or M/D/YYYY
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (mdy) {
        let year = parseInt(mdy[3], 10);
        if (year < 100) year += 2000;
        const d = new Date(year, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
        if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function findLabelDate(sheet, labelNeedle, maxRows = 8, maxCols = 20) {
    const needle = normalizeHeader(labelNeedle);
    for (let r = 1; r <= Math.min(maxRows, sheet.rowCount || maxRows); r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= maxCols; c++) {
            const key = normalizeHeader(cellRaw(row.getCell(c)));
            if (!key) continue;
            if (key === needle || key.includes(needle) || needle.includes(key)) {
                // value usually on next row same column, or next cell
                const below = cellRaw(sheet.getRow(r + 1).getCell(c));
                const right = cellRaw(row.getCell(c + 1));
                return toDate(below) || toDate(right);
            }
        }
    }
    return null;
}

function scoreHeaderRow(normalizedKeys) {
    const joined = normalizedKeys.join('|');
    let score = 0;
    if (normalizedKeys.some((k) => k.includes('journal_key') || k === 'journal')) score += 5;
    if (normalizedKeys.some((k) => k.includes('account_code') || k === 'account' || k === 'code')) score += 5;
    if (normalizedKeys.some((k) => k.includes('debit'))) score += 3;
    if (normalizedKeys.some((k) => k.includes('credit'))) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('invoice') || k.includes('invoice'))) score += 4;
    if (normalizedKeys.some((k) => k.startsWith('custome') || k.includes('customer') || k.includes('student'))) score += 4;
    if (normalizedKeys.some((k) => k === 'rental' || k === 'rent')) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('admin'))) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('payment') || k === 'payment')) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('room'))) score += 2;
    if (joined.includes('current_date') || joined.includes('reporting_date')) score -= 2;
    return score;
}

function detectHeaderRow(sheet, maxScan = 15) {
    let best = { rowNumber: 1, score: -1, headers: {} };
    const last = Math.min(maxScan, sheet.rowCount || maxScan);
    for (let r = 1; r <= last; r++) {
        const row = sheet.getRow(r);
        const headers = {};
        const keys = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const key = normalizeHeader(cellRaw(cell));
            if (!key) return;
            keys.push(key);
            // keep first occurrence; later duplicates get suffix
            if (headers[key] == null) headers[key] = colNumber;
            else {
                let i = 2;
                while (headers[`${key}_${i}`] != null) i += 1;
                headers[`${key}_${i}`] = colNumber;
            }
        });
        const score = scoreHeaderRow(keys);
        if (score > best.score) best = { rowNumber: r, score, headers, keys };
    }
    return best;
}

function matchCol(headers, candidates) {
    const entries = Object.entries(headers);
    for (const cand of candidates) {
        const c = normalizeHeader(cand);
        for (const [key, col] of entries) {
            if (key === c || key.startsWith(c) || c.startsWith(key)) return col;
        }
    }
    return null;
}

function collectPaymentCols(headers) {
    // Prefer explicit payment / payment_2 / payment_3, else any key starting with payment in column order
    const paymentEntries = Object.entries(headers)
        .filter(([k]) => k === 'payment' || /^payment_?\d*$/.test(k) || k.startsWith('payment'))
        .sort((a, b) => a[1] - b[1]);
    return paymentEntries.map(([, col]) => col);
}

function isClassicJournalHeaders(headers) {
    const hasKey = matchCol(headers, ['journal_key', 'journal', 'journal_id', 'group', 'key']);
    const hasAccount = matchCol(headers, ['account_code', 'account', 'code', 'gl_code']);
    const hasDebit = matchCol(headers, ['debit', 'dr', 'debit_amount']);
    const hasCredit = matchCol(headers, ['credit', 'cr', 'credit_amount']);
    return Boolean(hasKey && hasAccount && (hasDebit || hasCredit));
}

function isInvoicePaymentHeaders(headers) {
    const hasCustomer = matchCol(headers, ['customer', 'custome', 'student', 'name', 'tenant']);
    const hasRental = matchCol(headers, ['rental', 'rent']);
    const hasPayment = collectPaymentCols(headers).length > 0;
    const hasInvoice = matchCol(headers, ['invoice_date', 'invoice_d', 'invoice_number', 'invoice_n', 'invoice_no']);
    const hasAdmin = matchCol(headers, ['admin_fee', 'admin_fe', 'admin']);
    return Boolean(hasCustomer && (hasRental || hasAdmin || hasPayment || hasInvoice));
}

/**
 * Build classic journal line groups from sheet.
 */
function parseClassicJournalSheet(sheet, headerInfo, defaultDate) {
    const headers = headerInfo.headers;
    const col = {
        journalKey: matchCol(headers, ['journal_key', 'journal', 'journal_id', 'group', 'key']),
        description: matchCol(headers, ['description', 'journal_description', 'memo']),
        reference: matchCol(headers, ['reference', 'ref', 'ref_no']),
        date: matchCol(headers, ['date', 'transaction_date', 'txn_date']),
        accountCode: matchCol(headers, ['account_code', 'account', 'code', 'gl_code']),
        debit: matchCol(headers, ['debit', 'dr', 'debit_amount']),
        credit: matchCol(headers, ['credit', 'cr', 'credit_amount']),
        lineDescription: matchCol(headers, ['line_description', 'entry_description', 'line_memo', 'narration'])
    };

    if (!col.journalKey || !col.description || !col.accountCode) {
        throw new Error(
            'Classic journal Excel needs columns: journal_key, description, account_code, debit, credit'
        );
    }

    const get = (row, field) => (col[field] ? cellRaw(row.getCell(col[field])) : null);

    const lines = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerInfo.rowNumber) return;
        const journalKey = String(get(row, 'journalKey') ?? '').trim();
        const description = String(get(row, 'description') ?? '').trim();
        const accountCode = String(get(row, 'accountCode') ?? '').trim();
        if (!journalKey && !description && !accountCode) return;

        lines.push({
            rowNumber,
            journalKey,
            description,
            reference: String(get(row, 'reference') ?? '').trim() || null,
            date: toDate(get(row, 'date')) || defaultDate,
            accountCode,
            debit: toNumber(get(row, 'debit')),
            credit: toNumber(get(row, 'credit')),
            lineDescription: String(get(row, 'lineDescription') ?? '').trim() || null
        });
    });

    const groups = new Map();
    for (const line of lines) {
        const key = line.journalKey || `__row_${line.rowNumber}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(line);
    }
    return { format: 'classic', lines, groups };
}

/**
 * Parse invoice/payment billing sheet → proposed journals (not yet saved).
 * mode: payments | charges | both
 */
function parseInvoicePaymentSheet(sheet, headerInfo, { defaultDate, mode = 'payments', reportingDate = null, sheetName = null }) {
    const headers = headerInfo.headers;
    const col = {
        invoiceDate: matchCol(headers, ['invoice_date', 'invoice_d', 'inv_date']),
        invoiceNumber: matchCol(headers, ['invoice_number', 'invoice_n', 'invoice_no', 'invoice_num', 'inv_no']),
        roomNumber: matchCol(headers, ['room_number', 'room_nu', 'room_no', 'room']),
        customer: matchCol(headers, ['customer', 'custome', 'student', 'name', 'tenant']),
        totalAmount: matchCol(headers, ['total_amount', 'total_am', 'total', 'amount']),
        rental: matchCol(headers, ['rental', 'rent', 'rent_amount']),
        adminFee: matchCol(headers, ['admin_fee', 'admin_fe', 'admin', 'adminfee']),
        dateDue: matchCol(headers, ['date_due', 'due_date', 'due']),
        balanceIn: matchCol(headers, ['balance_in', 'balance_i', 'opening_balance', 'balance'])
    };
    const paymentCols = collectPaymentCols(headers);

    // Second balance column if present
    const balanceCols = Object.entries(headers)
        .filter(([k]) => k.startsWith('balance'))
        .sort((a, b) => a[1] - b[1])
        .map(([, c]) => c);
    if (!col.balanceIn && balanceCols[0]) col.balanceIn = balanceCols[0];

    if (!col.customer) {
        throw new Error('Invoice/payment sheet needs a Customer column');
    }

    const get = (row, field) => (col[field] ? cellRaw(row.getCell(col[field])) : null);

    const proposed = []; // { type, journalKey, description, reference, date, rows, rental, admin, payments, customer, room, invoiceNumber }

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerInfo.rowNumber) return;

        const customer = String(get(row, 'customer') ?? '').trim();
        const rental = toNumber(get(row, 'rental'));
        const adminFee = toNumber(get(row, 'adminFee'));
        const totalAmount = toNumber(get(row, 'totalAmount'));
        const payments = paymentCols.map((c) => toNumber(cellRaw(row.getCell(c))));
        const paymentTotal = payments.reduce((s, n) => s + n, 0);
        const invoiceNumber = String(get(row, 'invoiceNumber') ?? '').trim();
        const roomNumber = String(get(row, 'roomNumber') ?? '').trim();
        const invoiceDate = toDate(get(row, 'invoiceDate'));
        const dateDue = toDate(get(row, 'dateDue'));

        if (!customer && rental === 0 && adminFee === 0 && paymentTotal === 0 && totalAmount === 0) {
            return; // blank
        }
        if (!customer) return;

        const missingInvoiceNumber = !invoiceNumber;
        const sheetPrefix = sheetName ? String(sheetName).trim() : '';
        const baseKey = invoiceNumber
            ? invoiceNumber
            : `MISSING-INV-${sheetPrefix || 'SHEET'}-R${rowNumber}`;
        const labelParts = [
            customer,
            roomNumber && `Room ${roomNumber}`,
            invoiceNumber ? `Inv ${invoiceNumber}` : 'Missing Invoice Number',
            sheetPrefix && `(${sheetPrefix})`
        ].filter(Boolean);
        const label = labelParts.join(' — ');

        if ((mode === 'charges' || mode === 'both') && (rental > 0 || adminFee > 0 || totalAmount > 0)) {
            const chargeRental = rental > 0 ? rental : 0;
            const chargeAdmin = adminFee > 0 ? adminFee : 0;
            const chargeTotal =
                chargeRental + chargeAdmin > 0 ? chargeRental + chargeAdmin : totalAmount;
            if (chargeTotal > 0) {
                proposed.push({
                    type: 'charge',
                    journalKey: `CHG-${sheetPrefix ? `${sheetPrefix}-` : ''}${baseKey}`,
                    description: `Invoice charge — ${label}`,
                    reference: invoiceNumber || `MISSING-INV-${sheetPrefix || 'SHEET'}-R${rowNumber}`,
                    date: invoiceDate || reportingDate || defaultDate,
                    rowNumber,
                    sheetName: sheetPrefix || null,
                    customer,
                    roomNumber,
                    invoiceNumber: invoiceNumber || null,
                    missingInvoiceNumber,
                    rental: chargeRental || (chargeAdmin ? 0 : chargeTotal),
                    adminFee: chargeAdmin,
                    paymentTotal: 0
                });
            }
        }

        if ((mode === 'payments' || mode === 'both') && paymentTotal > 0) {
            proposed.push({
                type: 'payment',
                journalKey: `PAY-${sheetPrefix ? `${sheetPrefix}-` : ''}${baseKey}`,
                description: `Payment received — ${label}`,
                reference: invoiceNumber || `MISSING-INV-${sheetPrefix || 'SHEET'}-R${rowNumber}`,
                date: reportingDate || invoiceDate || defaultDate,
                rowNumber,
                sheetName: sheetPrefix || null,
                customer,
                roomNumber,
                invoiceNumber: invoiceNumber || null,
                missingInvoiceNumber,
                rental,
                adminFee,
                paymentTotal,
                payments
            });
        }
    });

    return {
        format: 'invoice_payment',
        sheetName: sheetName || sheet.name,
        proposed,
        meta: {
            currentDate: findLabelDate(sheet, 'current_date'),
            reportingDate: reportingDate || findLabelDate(sheet, 'reporting_date')
        }
    };
}

/**
 * Convert an invoice/payment proposed row into double-entry lines.
 * When studentAr is provided (linked debtor), payments/charges hit that AR code
 * so Debtor totals update via TransactionEntry post-save.
 *
 * Payment (linked): DR cash, CR student AR  → source should be 'payment'
 * Charge (linked):  DR student AR, CR rent/admin income → source 'rental_accrual'
 * Fallback (no debtor): legacy income/AR control accounts (does NOT update debtors)
 */
function buildEntriesFromInvoiceRow(row, accounts) {
    const { cash, rentIncome, adminIncome, ar, studentAr } = accounts;
    const entries = [];
    const arTarget = studentAr || ar;
    const studentLabel = row.customer || 'Student';

    if (row.type === 'charge') {
        const rental = row.rental || 0;
        const adminFee = row.adminFee || 0;
        const total = rental + adminFee;
        if (total <= 0) throw new Error('Charge amount is zero');

        entries.push({
            accountCode: arTarget.code,
            accountName: arTarget.name,
            accountType: arTarget.type || 'Asset',
            debit: total,
            credit: 0,
            description: `AR charge — ${studentLabel}`
        });
        if (rental > 0) {
            entries.push({
                accountCode: rentIncome.code,
                accountName: rentIncome.name,
                accountType: rentIncome.type,
                debit: 0,
                credit: rental,
                description: `Rental — ${studentLabel}`
            });
        }
        if (adminFee > 0) {
            entries.push({
                accountCode: adminIncome.code,
                accountName: adminIncome.name,
                accountType: adminIncome.type,
                debit: 0,
                credit: adminFee,
                description: `Admin fee — ${studentLabel}`
            });
        }
        return entries;
    }

    // payment — must credit student AR (not income) so debtor balance reflects payment
    const pay = row.paymentTotal || 0;
    if (pay <= 0) throw new Error('Payment amount is zero');

    if (studentAr) {
        entries.push({
            accountCode: cash.code,
            accountName: cash.name,
            accountType: cash.type,
            debit: pay,
            credit: 0,
            description: `Cash received — ${studentLabel}`
        });
        entries.push({
            accountCode: studentAr.code,
            accountName: studentAr.name,
            accountType: studentAr.type || 'Asset',
            debit: 0,
            credit: pay,
            description: `Payment on account — ${studentLabel}`
        });
        return entries;
    }

    // Legacy unlinked path (no debtor): split to income accounts
    let remaining = pay;
    let toRent = 0;
    let toAdmin = 0;
    if (row.rental > 0) {
        toRent = Math.min(remaining, row.rental);
        remaining -= toRent;
    }
    if (row.adminFee > 0 && remaining > 0) {
        toAdmin = Math.min(remaining, row.adminFee);
        remaining -= toAdmin;
    }
    if (toRent === 0 && toAdmin === 0 && remaining === pay) {
        toRent = pay;
        remaining = 0;
    }

    entries.push({
        accountCode: cash.code,
        accountName: cash.name,
        accountType: cash.type,
        debit: pay,
        credit: 0,
        description: `Cash received — ${studentLabel}`
    });
    if (toRent > 0) {
        entries.push({
            accountCode: rentIncome.code,
            accountName: rentIncome.name,
            accountType: rentIncome.type,
            debit: 0,
            credit: toRent,
            description: `Rent payment — ${studentLabel}`
        });
    }
    if (toAdmin > 0) {
        entries.push({
            accountCode: adminIncome.code,
            accountName: adminIncome.name,
            accountType: adminIncome.type,
            debit: 0,
            credit: toAdmin,
            description: `Admin fee payment — ${studentLabel}`
        });
    }
    if (remaining > 0.009) {
        entries.push({
            accountCode: ar.code,
            accountName: ar.name,
            accountType: ar.type,
            debit: 0,
            credit: remaining,
            description: `Unallocated payment — ${studentLabel}`
        });
    }
    return entries;
}

/**
 * Escape string for exact-match RegExp
 */
function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePersonName(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''`’]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Drop single-letter middle initials (e.g. "Kimberly M Kuora" → ["kimberly","kuora"]). */
function personNameTokens(name) {
    return normalizePersonName(name)
        .split(' ')
        .filter((t) => t && t.length > 1);
}

/**
 * Score Excel CUSTOMER vs debtor/user display name (0–1).
 * Tolerates middle names and 1–2 char spelling differences (Gavajena/Gawajena, Clarisa/Claris).
 */
function scorePersonNameMatch(excelName, candidateName) {
    const { calculateStringSimilarity } = require('../utils/requestSimilarity');
    const a = personNameTokens(excelName);
    const b = personNameTokens(candidateName);
    if (!a.length || !b.length) return 0;

    const aNorm = normalizePersonName(excelName);
    const bNorm = normalizePersonName(candidateName);
    if (aNorm === bNorm) return 1;

    const aFirst = a[0];
    const aLast = a[a.length - 1];
    const bFirst = b[0];
    const bLast = b[b.length - 1];

    // Exact first+last ignoring middle names
    if (aFirst === bFirst && aLast === bLast) return 0.98;

    const bestFirst = Math.max(...b.map((t) => calculateStringSimilarity(aFirst, t)));
    const bestLast = Math.max(...b.map((t) => calculateStringSimilarity(aLast, t)));
    // Prefer ends-of-name alignment (common spreadsheet vs system naming)
    const firstEnd = calculateStringSimilarity(aFirst, bFirst);
    const lastEnd = calculateStringSimilarity(aLast, bLast);
    const firstScore = Math.max(bestFirst, firstEnd);
    const lastScore = Math.max(bestLast, lastEnd);

    // Both first and last must be reasonably close — avoids "Tatenda X" matching wrong Tatenda
    if (firstScore < 0.72 || lastScore < 0.72) return 0;

    const fullSim = calculateStringSimilarity(aNorm, bNorm);
    return 0.4 * firstScore + 0.45 * lastScore + 0.15 * fullSim;
}

async function getDebtorNameIndex(cache) {
    if (cache && cache.__debtorNameIndex) return cache.__debtorNameIndex;
    const Debtor = require('../models/Debtor');
    const list = await Debtor.find({})
        .select('_id user accountCode contactInfo.name debtorCode updatedAt')
        .lean();
    const index = list
        .map((d) => ({
            debtor: d,
            displayName: String(d.contactInfo?.name || '').trim()
        }))
        .filter((x) => x.displayName);
    if (cache) cache.__debtorNameIndex = index;
    return index;
}

/**
 * Resolve Excel CUSTOMER (+ optional ROOM) to Debtor + student AR account.
 * Exact match first, then first+last ignoring middle names, then fuzzy spelling.
 * Caches by normalized name; reuses a debtor name index on the same cache Map.
 */
async function resolveDebtorForCustomer(customerName, { roomNumber = null, residenceId = null, cache = null } = {}) {
    const Debtor = require('../models/Debtor');
    const User = require('../models/User');
    const Application = require('../models/Application');
    const Account = require('../models/Account');
    const { normalizeAccountName } = require('../utils/accountNameNormalizer');
    const mongoose = require('mongoose');

    const name = String(customerName || '').trim();
    if (!name) return { ok: false, error: 'Empty customer name' };

    const cacheKey = `${name.toLowerCase()}|${roomNumber || ''}|${residenceId || ''}`;
    if (cache && cache.has(cacheKey)) return cache.get(cacheKey);

    const finish = (result) => {
        if (cache) cache.set(cacheKey, result);
        return result;
    };

    let debtor = null;
    let matchMethod = null;
    let matchedName = null;

    const nameRe = new RegExp(`^${escapeRegex(name)}$`, 'i');
    debtor =
        (await Debtor.findOne({ 'contactInfo.name': nameRe }).sort({ updatedAt: -1 }).lean()) ||
        null;
    if (debtor) {
        matchMethod = 'exact';
        matchedName = debtor.contactInfo?.name || name;
    }

    // Try User firstName+lastName exact (middle names on either side)
    if (!debtor) {
        const parts = personNameTokens(name);
        if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];
            const user = await User.findOne({
                firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
                lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i'),
                role: 'student'
            })
                .select('_id firstName lastName email')
                .lean();
            if (user) {
                debtor = await Debtor.findOne({ user: user._id }).lean();
                if (debtor) {
                    matchMethod = 'user_exact';
                    matchedName = `${user.firstName} ${user.lastName}`.trim();
                }
            }
        }
    }

    // First + last tokens only on debtor contact name (ignores middle names)
    if (!debtor) {
        const parts = personNameTokens(name);
        if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];
            const candidates = await Debtor.find({
                'contactInfo.name': new RegExp(escapeRegex(lastName), 'i')
            })
                .sort({ updatedAt: -1 })
                .limit(40)
                .lean();
            const hits = candidates.filter((d) => {
                const tokens = personNameTokens(d.contactInfo?.name || '');
                if (tokens.length < 2) return false;
                return (
                    tokens[0] === firstName.toLowerCase() &&
                    tokens[tokens.length - 1] === lastName.toLowerCase()
                );
            });
            if (hits.length === 1) {
                debtor = hits[0];
                matchMethod = 'first_last';
                matchedName = debtor.contactInfo?.name || name;
            }
        }
    }

    // Fuzzy spelling against all debtors (small set; OK for Excel upload batches)
    if (!debtor) {
        const index = await getDebtorNameIndex(cache);
        const scored = index
            .map((row) => ({
                ...row,
                score: scorePersonNameMatch(name, row.displayName)
            }))
            .filter((row) => row.score >= 0.82)
            .sort((a, b) => b.score - a.score);

        if (scored.length >= 1) {
            const best = scored[0];
            const second = scored[1];
            // Reject ambiguous pairs (two close candidates)
            if (!second || best.score - second.score >= 0.04 || best.score >= 0.95) {
                debtor = best.debtor;
                matchMethod = 'fuzzy';
                matchedName = best.displayName;
            }
        }
    }

    // Room + residence disambiguation via Application
    if (!debtor && roomNumber) {
        const roomStr = String(roomNumber).trim();
        const appQuery = {
            $or: [
                { allocatedRoom: roomStr },
                { 'allocatedRoomDetails.roomNumber': roomStr },
                { preferredRoom: roomStr },
                { currentRoom: roomStr }
            ],
            status: { $in: ['approved', 'active', 'Approved'] }
        };
        if (residenceId && mongoose.Types.ObjectId.isValid(residenceId)) {
            appQuery.residence = residenceId;
        }
        const apps = await Application.find(appQuery)
            .select('student firstName lastName email allocatedRoom')
            .limit(20)
            .lean();

        const scoredApps = apps
            .map((a) => ({
                app: a,
                score: scorePersonNameMatch(name, `${a.firstName || ''} ${a.lastName || ''}`.trim())
            }))
            .filter((x) => x.score >= 0.82)
            .sort((a, b) => b.score - a.score);

        if (scoredApps[0]?.app?.student) {
            debtor = await Debtor.findOne({ user: scoredApps[0].app.student }).lean();
            if (debtor) {
                matchMethod = 'room_fuzzy';
                matchedName = `${scoredApps[0].app.firstName || ''} ${scoredApps[0].app.lastName || ''}`.trim();
            }
        } else if (apps.length === 1 && apps[0].student) {
            const a = apps[0];
            const full = `${a.firstName || ''} ${a.lastName || ''}`.trim();
            if (scorePersonNameMatch(name, full) >= 0.7) {
                debtor = await Debtor.findOne({ user: a.student }).lean();
                if (debtor) {
                    matchMethod = 'room_single';
                    matchedName = full;
                }
            }
        }
    }

    if (!debtor) {
        return finish({
            ok: false,
            error: `No debtor/student account found for "${name}"${roomNumber ? ` (room ${roomNumber})` : ''}. Create the debtor first or fix the CUSTOMER name.`
        });
    }

    const accountCode = debtor.accountCode || `1100-${debtor._id}`;
    let arAccount = await Account.findOne({ code: accountCode }).lean();
    if (!arAccount) {
        // Ensure student AR exists under 1100
        const mainAR = await Account.findOne({ code: '1100' });
        if (mainAR) {
            const created = await Account.create({
                code: accountCode,
                name: `Accounts Receivable - ${debtor.contactInfo?.name || name}`,
                type: 'Asset',
                category: 'Current Assets',
                subcategory: 'Accounts Receivable',
                description: `AR for ${name}`,
                isActive: true,
                parentAccount: mainAR._id,
                level: 2
            });
            arAccount = created.toObject ? created.toObject() : created;
        }
    }

    if (!arAccount) {
        return finish({
            ok: false,
            error: `Debtor found but AR account ${accountCode} is missing in chart of accounts`
        });
    }

    const debtorDisplay = debtor.contactInfo?.name || matchedName || name;
    return finish({
        ok: true,
        debtor,
        studentId: debtor.user?.toString?.() || debtor.user,
        debtorId: debtor._id.toString(),
        accountCode,
        matchMethod,
        matchedName: debtorDisplay,
        nameMatchedAs:
            matchMethod && matchMethod !== 'exact' && normalizePersonName(debtorDisplay) !== normalizePersonName(name)
                ? debtorDisplay
                : null,
        studentAr: {
            code: accountCode,
            name: normalizeAccountName(accountCode, arAccount.name),
            type: arAccount.type || 'Asset'
        }
    });
}

/**
 * Suggested TransactionEntry source for invoice-row journals linked to debtors.
 */
function transactionSourceForInvoiceRow(row, linkedToDebtor) {
    if (!linkedToDebtor) return 'manual';
    if (row.type === 'payment') return 'payment';
    if (row.type === 'charge') return 'rental_accrual';
    return 'manual';
}

async function loadWorkbookFromBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
}

const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SKIP_SHEET_NAMES = new Set(['instructions', 'instruction', 'readme', 'notes', 'template']);

function normalizeSheetName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function isMonthSheetName(name) {
    const n = normalizeSheetName(name);
    if (!n || SKIP_SHEET_NAMES.has(n)) return false;
    if (MONTH_ABBR.includes(n) || MONTH_NAMES.includes(n)) return true;
    // e.g. Jan2026, July-2026, 2026-01
    if (MONTH_ABBR.some((m) => n.startsWith(m)) || MONTH_NAMES.some((m) => n.startsWith(m))) return true;
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\d{2,4}$/.test(n)) return true;
    return false;
}

/**
 * List worksheets suitable for journal upload (excludes Instructions).
 * Marks which look like month tabs (Jan–Dec).
 */
function listWorkbookSheets(workbook) {
    return (workbook.worksheets || [])
        .filter((ws) => !SKIP_SHEET_NAMES.has(normalizeSheetName(ws.name)))
        .map((ws) => {
            let parseable = false;
            let format = null;
            try {
                const headerInfo = detectHeaderRow(ws);
                if (headerInfo.score >= 3) {
                    if (isClassicJournalHeaders(headerInfo.headers)) {
                        parseable = true;
                        format = 'classic';
                    } else if (isInvoicePaymentHeaders(headerInfo.headers)) {
                        parseable = true;
                        format = 'invoice_payment';
                    }
                }
            } catch (_) {
                /* ignore */
            }
            return {
                name: ws.name,
                isMonthTab: isMonthSheetName(ws.name),
                parseable,
                format
            };
        });
}

/**
 * Resolve which sheets to process.
 * sheetParam: undefined/'all' → all month tabs (or all parseable if no month tabs)
 *             'Jan,Feb' or 'July' → those sheets only
 * Returns { sheets, available, needsSheetChoice }
 */
function resolveSheetsToProcess(workbook, sheetParam) {
    const available = listWorkbookSheets(workbook);
    const monthTabs = available.filter((s) => s.isMonthTab);
    const parseable = available.filter((s) => s.parseable);
    const candidates = monthTabs.length > 0 ? monthTabs : parseable.length > 0 ? parseable : available;

    const raw = sheetParam == null ? '' : String(sheetParam).trim();
    const wantAll = !raw || /^all$/i.test(raw) || raw === '*';

    // Multi-month workbook and caller didn't pick a sheet → ask (unless sheet=all)
    if (!raw && monthTabs.length > 1) {
        return {
            sheets: [],
            available,
            monthTabs,
            needsSheetChoice: true,
            message:
                `Workbook has ${monthTabs.length} month tabs (${monthTabs.map((s) => s.name).join(', ')}). ` +
                `Pass sheet=all to create journals for every tab, or sheet=July (or sheet=Jan,Feb,Mar) for specific months.`
        };
    }

    let selectedNames;
    if (wantAll) {
        selectedNames = candidates.map((s) => s.name);
    } else {
        const requested = raw.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean);
        selectedNames = [];
        const unmatched = [];
        for (const req of requested) {
            const reqNorm = normalizeSheetName(req);
            const hit = available.find((s) => {
                const n = normalizeSheetName(s.name);
                return n === reqNorm || n.startsWith(reqNorm) || reqNorm.startsWith(n);
            });
            if (hit) selectedNames.push(hit.name);
            else unmatched.push(req);
        }
        if (unmatched.length) {
            return {
                sheets: [],
                available,
                monthTabs,
                needsSheetChoice: true,
                message: `Sheet(s) not found: ${unmatched.join(', ')}. Available: ${available.map((s) => s.name).join(', ')}`
            };
        }
    }

    // de-dupe preserve order
    const seen = new Set();
    const sheets = [];
    for (const name of selectedNames) {
        if (seen.has(name)) continue;
        seen.add(name);
        const ws = workbook.getWorksheet(name);
        if (ws) sheets.push(ws);
    }

    return {
        sheets,
        available,
        monthTabs,
        needsSheetChoice: false,
        selected: sheets.map((s) => s.name)
    };
}

function pickDataSheet(workbook) {
    const month = workbook.worksheets.find((ws) => isMonthSheetName(ws.name));
    return (
        month ||
        workbook.getWorksheet('InvoicePayments') ||
        workbook.getWorksheet('Journals') ||
        workbook.worksheets.find((ws) => !SKIP_SHEET_NAMES.has(normalizeSheetName(ws.name))) ||
        workbook.worksheets[0]
    );
}

function detectAndParseSheet(sheet, options = {}) {
    const defaultDate = options.defaultDate || new Date();
    const mode = options.mode || 'payments';
    const sheetName = options.sheetName || sheet.name;
    const headerInfo = detectHeaderRow(sheet);

    if (headerInfo.score < 3) {
        throw new Error(
            `Sheet "${sheetName}": could not detect header row. Expected Customer / Rental / Payment (or classic journal) columns.`
        );
    }

    const reportingDate =
        options.reportingDate ||
        findLabelDate(sheet, 'reporting_date') ||
        findLabelDate(sheet, 'current_date');

    if (isClassicJournalHeaders(headerInfo.headers)) {
        return {
            ...parseClassicJournalSheet(sheet, headerInfo, defaultDate),
            sheetName,
            headerRow: headerInfo.rowNumber,
            reportingDate
        };
    }

    if (isInvoicePaymentHeaders(headerInfo.headers)) {
        return {
            ...parseInvoicePaymentSheet(sheet, headerInfo, {
                defaultDate,
                mode,
                reportingDate,
                sheetName
            }),
            headerRow: headerInfo.rowNumber,
            reportingDate
        };
    }

    throw new Error(
        `Sheet "${sheetName}": unrecognized format. Supported: classic journals or Invoice/Customer/Rental/Payment columns.`
    );
}

module.exports = {
    normalizeHeader,
    toNumber,
    toDate,
    loadWorkbookFromBuffer,
    pickDataSheet,
    listWorkbookSheets,
    resolveSheetsToProcess,
    detectAndParseSheet,
    buildEntriesFromInvoiceRow,
    resolveDebtorForCustomer,
    scorePersonNameMatch,
    transactionSourceForInvoiceRow,
    isClassicJournalHeaders,
    isInvoicePaymentHeaders,
    isMonthSheetName
};
