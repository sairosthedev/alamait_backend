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
        const p0 = parseInt(mdy[1], 10);
        const p1 = parseInt(mdy[2], 10);
        // D/M/Y (Zimbabwe) when first part > 12, else treat as M/D/Y
        const day = p0 > 12 ? p0 : p1 > 12 ? p1 : p0;
        const month = p0 > 12 ? p1 : p1 > 12 ? p0 : p1;
        const d = new Date(year, month - 1, day);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const dmyText = s.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})$/i);
    if (dmyText) {
        const months = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const day = parseInt(dmyText[1], 10);
        const mon = months[dmyText[2].toLowerCase().slice(0, 3)];
        let year = parseInt(dmyText[3], 10);
        if (year < 100) year += 2000;
        if (mon != null && !Number.isNaN(day) && !Number.isNaN(year)) {
            const d = new Date(year, mon, day);
            if (!Number.isNaN(d.getTime())) return d;
        }
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
    if (normalizedKeys.some((k) => k === 'dr')) score += 4;
    if (normalizedKeys.some((k) => k === 'cr')) score += 4;
    if (normalizedKeys.some((k) => k === 'date')) score += 3;
    if (normalizedKeys.some((k) => k === 'name')) score += 3;
    if (normalizedKeys.some((k) => k === 'narration' || k.includes('narration'))) score += 2;
    if (normalizedKeys.some((k) => k.startsWith('invoice') || k.includes('invoice'))) score += 4;
    if (normalizedKeys.some((k) => k.startsWith('custome') || k.includes('customer') || k.includes('student'))) score += 4;
    if (normalizedKeys.some((k) => k === 'rental' || k === 'rent')) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('admin'))) score += 3;
    if (normalizedKeys.some((k) => k.startsWith('payment') || k === 'payment')) score += 3;
    if (normalizedKeys.some((k) => k === 'amount' || k.includes('amount') || k.includes('paid') || k.includes('received'))) score += 3;
    if (normalizedKeys.some((k) => k.includes('email'))) score += 2;
    if (normalizedKeys.some((k) => k.includes('lease') || k.includes('start_date') || k.includes('end_date'))) score += 2;
    if (normalizedKeys.some((k) => k === 'firstname' || k === 'lastname' || k === 'first_name')) score += 2;
    if (normalizedKeys.some((k) => k.startsWith('room'))) score += 2;
    if (joined.includes('current_date') || joined.includes('reporting_date')) score -= 2;
    return score;
}

function looksLikeDataHeaderRow(keys) {
    if (!keys.length) return false;
    const hasRealHeaders = keys.some(
        (k) =>
            k === 'date' ||
            k === 'name' ||
            k === 'dr' ||
            k === 'cr' ||
            k === 'customer' ||
            k.includes('journal_key') ||
            k.includes('account_code') ||
            k.startsWith('invoice') ||
            k === 'payment' ||
            k === 'rental'
    );
    if (hasRealHeaders) return false;

    let dataLike = 0;
    for (const k of keys) {
        if (/^\d+$/.test(k)) dataLike++;
        else if (k.includes('_gmt_') || (k.includes('_202') && k.length > 12)) dataLike++;
        else if (k.endsWith('_received') || k.includes('cash_received')) dataLike++;
    }
    return dataLike >= 1;
}

function detectHeaderRow(sheet, maxScan = 25) {
    let best = { rowNumber: 1, score: -1, headers: {}, keys: [], format: null };
    let bestScored = { rowNumber: 1, score: -1, headers: {}, keys: [] };
    const last = Math.min(maxScan, sheet.rowCount || maxScan);

    const rowHeaders = (row) => {
        const headers = {};
        const keys = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const key = normalizeHeader(cellRaw(cell));
            if (!key) return;
            keys.push(key);
            if (headers[key] == null) headers[key] = colNumber;
            else {
                let i = 2;
                while (headers[`${key}_${i}`] != null) i += 1;
                headers[`${key}_${i}`] = colNumber;
            }
        });
        return { headers, keys };
    };

    for (let r = 1; r <= last; r++) {
        const row = sheet.getRow(r);
        const { headers, keys } = rowHeaders(row);
        if (!keys.length) continue;
        if (looksLikeDataHeaderRow(keys)) continue;

        const score = scoreHeaderRow(keys);
        if (score > bestScored.score) {
            bestScored = { rowNumber: r, score, headers, keys };
        }

        let format = null;
        if (isClassicJournalHeaders(headers)) format = 'classic';
        else if (isInvoicePaymentHeaders(headers)) format = 'invoice_payment';
        else if (isCashReceiptHeaders(headers)) format = 'cash_receipt';
        else if (isLedgerDateHeaders(headers)) format = 'ledger_date';

        if (format && (format !== best.format || score > best.score)) {
            best = { rowNumber: r, score, headers, keys, format };
        }
    }

    if (best.format) return best;
    return { ...bestScored, format: null };
}

function isLedgerDateHeaders(headers) {
    const hasDate = matchCol(headers, ['date', 'transaction_date', 'txn_date', 'payment_date', 'invoice_date']);
    const hasCustomer = matchCol(headers, [
        'customer', 'custome', 'customer_name', 'student', 'name', 'tenant', 'description'
    ]);
    const hasMoney =
        collectPaymentCols(headers).length > 0 ||
        matchCol(headers, ['amount', 'paid', 'received', 'rental', 'rent', 'total']);
    return Boolean(hasDate && hasCustomer && hasMoney);
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
    const paymentEntries = Object.entries(headers)
        .filter(([k]) =>
            k === 'payment' ||
            /^payment_?\d*$/.test(k) ||
            k.startsWith('payment') ||
            k === 'amount' ||
            k === 'amount_paid' ||
            k === 'paid' ||
            k === 'payment_amount' ||
            k.startsWith('paid_') ||
            k.includes('amount_paid') ||
            k === 'received' ||
            k === 'total_paid'
        )
        .sort((a, b) => a[1] - b[1]);
    return paymentEntries.map(([, col]) => col);
}

/** Tenant/student CSV columns — wrong endpoint for journal upload */
function isTenantUploadHeaders(headers) {
    const hasEmail = matchCol(headers, ['email', 'e_mail', 'mail']);
    const hasLease = matchCol(headers, [
        'lease_start', 'lease_end', 'leasestart', 'leaseend',
        'start_date', 'end_date', 'startdate', 'enddate'
    ]);
    const hasName = matchCol(headers, ['name', 'first_name', 'firstname', 'student', 'tenant']);
    return Boolean(hasEmail && (hasLease || hasName));
}

function isCashReceiptHeaders(headers) {
    const hasDate = matchCol(headers, ['date', 'transaction_date', 'txn_date', 'payment_date']);
    const hasName = matchCol(headers, ['name', 'customer', 'student', 'tenant']);
    const hasDr = matchCol(headers, ['dr', 'debit', 'debit_amount']);
    const hasCr = matchCol(headers, ['cr', 'credit', 'credit_amount']);
    return Boolean(hasDate && hasName && (hasDr || hasCr));
}

function isClassicJournalHeaders(headers) {
    const hasKey = matchCol(headers, ['journal_key', 'journal', 'journal_id', 'group', 'key']);
    const hasAccount = matchCol(headers, ['account_code', 'account', 'code', 'gl_code']);
    const hasDebit = matchCol(headers, ['debit', 'dr', 'debit_amount']);
    const hasCredit = matchCol(headers, ['credit', 'cr', 'credit_amount']);
    return Boolean(hasKey && hasAccount && (hasDebit || hasCredit));
}

function isInvoicePaymentHeaders(headers) {
    const hasCustomer = matchCol(headers, [
        'customer', 'custome', 'customer_name', 'student', 'name', 'tenant', 'tenant_name',
        'client', 'debtor', 'resident', 'occupant', 'payer', 'payor'
    ]);
    const hasRental = matchCol(headers, ['rental', 'rent', 'rent_amount', 'monthly_rent']);
    const hasPayment = collectPaymentCols(headers).length > 0;
    const hasInvoice = matchCol(headers, [
        'invoice_date', 'invoice_d', 'inv_date', 'invoice_number', 'invoice_n', 'invoice_no', 'invoice_num', 'inv_no', 'invoice'
    ]);
    const hasAdmin = matchCol(headers, ['admin_fee', 'admin_fe', 'admin', 'adminfee']);
    const hasAmount = matchCol(headers, ['total_amount', 'total_am', 'total', 'amount', 'paid', 'received']);
    const hasMoney = hasRental || hasAdmin || hasPayment || hasInvoice || hasAmount;
    if (hasCustomer && hasMoney) return true;
    // Names often sit in column A with no header (headers start at Invoice # / Invoice Date)
    const headerCols = new Set(Object.values(headers));
    if (!hasCustomer && hasMoney && hasPayment && !headerCols.has(1)) return true;
    return false;
}

function inferCustomerColumn(headers, col) {
    if (col.customer) return;
    const mapped = new Set(Object.values(col).filter(Boolean));
    for (let c = 1; c <= 30; c++) {
        if (mapped.has(c)) continue;
        if (!Object.values(headers).includes(c)) {
            col.customer = c;
            return;
        }
    }
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
        date: matchCol(headers, ['date', 'transaction_date', 'txn_date', 'payment_date']),
        invoiceDate: matchCol(headers, ['invoice_date', 'invoice_d', 'inv_date']),
        invoiceNumber: matchCol(headers, [
            'invoice_number', 'invoice_n', 'invoice_no', 'invoice_num', 'inv_no', 'invoice'
        ]),
        roomNumber: matchCol(headers, ['room_number', 'room_nu', 'room_no', 'room']),
        customer: matchCol(headers, [
            'customer', 'custome', 'student', 'name', 'tenant', 'client', 'debtor', 'resident'
        ]),
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

    inferCustomerColumn(headers, col);

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
        let paymentTotal = payments.reduce((s, n) => s + n, 0);
        const invoiceNumber = String(get(row, 'invoiceNumber') ?? '').trim();
        const roomNumber = String(get(row, 'roomNumber') ?? '').trim();
        const rowDate = toDate(get(row, 'date'));
        const invoiceDate = toDate(get(row, 'invoiceDate')) || rowDate;
        const dateDue = toDate(get(row, 'dateDue'));
        // Simple Date | Customer | Amount sheets: amount may only map to totalAmount, not payment cols
        if (
            paymentTotal <= 0 &&
            totalAmount > 0 &&
            rental === 0 &&
            adminFee === 0 &&
            (mode === 'payments' || mode === 'both')
        ) {
            paymentTotal = totalAmount;
        }

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
                date: rowDate || invoiceDate || reportingDate || defaultDate,
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
 * Cash receipt ledger: Date | Name | Narration | Dr | Cr
 * Credit rows (e.g. "rental received") → tenant payment journals.
 */
function parseCashReceiptSheet(sheet, headerInfo, { defaultDate, mode = 'payments', sheetName = null }) {
    const headers = headerInfo.headers;
    const col = {
        date: matchCol(headers, ['date', 'transaction_date', 'txn_date', 'payment_date']),
        name: matchCol(headers, ['name', 'customer', 'student', 'tenant']),
        narration: matchCol(headers, ['narration', 'description', 'memo', 'particulars', 'details']),
        dr: matchCol(headers, ['dr', 'debit', 'debit_amount']),
        cr: matchCol(headers, ['cr', 'credit', 'credit_amount'])
    };
    const get = (row, field) => (col[field] ? cellRaw(row.getCell(col[field])) : null);
    const proposed = [];
    const sheetPrefix = sheetName ? String(sheetName).trim() : '';

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerInfo.rowNumber) return;

        const customer = String(get(row, 'name') ?? '').trim();
        const narration = String(get(row, 'narration') ?? '').trim();
        const dr = toNumber(get(row, 'dr'));
        const cr = toNumber(get(row, 'cr'));
        const rowDate = toDate(get(row, 'date')) || defaultDate;

        if (dr === 0 && cr === 0) return;

        if ((mode === 'payments' || mode === 'both') && cr > 0) {
            if (!customer) return;
            proposed.push({
                type: 'payment',
                journalKey: `PAY-${sheetPrefix ? `${sheetPrefix}-` : ''}R${rowNumber}`,
                description: `Payment received — ${customer}${narration ? ` (${narration})` : ''}`,
                reference: `EXCEL-${sheetPrefix || 'SHEET'}-R${rowNumber}`,
                date: rowDate,
                rowNumber,
                sheetName: sheetPrefix || null,
                customer,
                roomNumber: null,
                invoiceNumber: null,
                missingInvoiceNumber: true,
                rental: cr,
                adminFee: 0,
                paymentTotal: cr,
                payments: [cr]
            });
        }
    });

    return {
        format: 'cash_receipt',
        sheetName: sheetPrefix || sheet.name,
        proposed,
        meta: {}
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

    if (!studentAr) {
        throw new Error(
            `Payment for "${studentLabel}" must link to a student/debtor (DR Cash / CR 1100-*). ` +
                `Fix the CUSTOMER name or create the debtor first — do not post tenant payments to income (4001).`
        );
    }

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
/**
 * Resolve room from debtor record or latest approved application for the student.
 */
async function lookupRoomForDebtor(debtor, residenceId = null) {
    if (!debtor) return null;

    const fromDebtor = String(debtor.roomNumber || '').trim();
    if (fromDebtor && fromDebtor.toLowerCase() !== 'not assigned') {
        return fromDebtor;
    }

    const Application = require('../models/Application');
    const mongoose = require('mongoose');
    const studentId = debtor.user;
    if (!studentId) return null;

    const query = {
        student: studentId,
        status: { $in: ['approved', 'active', 'Approved'] }
    };
    if (residenceId && mongoose.Types.ObjectId.isValid(residenceId)) {
        query.residence = residenceId;
    }

    const app = await Application.findOne(query)
        .sort({ updatedAt: -1 })
        .select('allocatedRoom allocatedRoomDetails preferredRoom currentRoom')
        .lean();

    if (!app) return null;

    const room =
        app.allocatedRoomDetails?.roomNumber ||
        app.allocatedRoom ||
        app.preferredRoom ||
        app.currentRoom;

    return room ? String(room).trim() : null;
}

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

    // Single-name customers (e.g. "Fay", "Kelly") — unique match at residence when possible
    if (!debtor) {
        const parts = personNameTokens(name);
        if (parts.length === 1) {
            const token = parts[0];
            const tokenRe = new RegExp(`^${escapeRegex(token)}(\\s|$)`, 'i');
            let candidates = await Debtor.find({ 'contactInfo.name': tokenRe })
                .sort({ updatedAt: -1 })
                .limit(30)
                .lean();

            if (residenceId && mongoose.Types.ObjectId.isValid(residenceId) && candidates.length > 1) {
                const studentIds = await Application.find({
                    residence: residenceId,
                    status: { $in: ['approved', 'active', 'Approved'] },
                    student: { $in: candidates.map((d) => d.user).filter(Boolean) }
                })
                    .distinct('student')
                    .lean();
                const idSet = new Set(studentIds.map(String));
                const scoped = candidates.filter((d) => d.user && idSet.has(String(d.user)));
                if (scoped.length === 1) {
                    candidates = scoped;
                } else if (scoped.length > 1) {
                    candidates = scoped;
                }
            }

            if (candidates.length === 1) {
                debtor = candidates[0];
                matchMethod = 'single_name';
                matchedName = debtor.contactInfo?.name || name;
            }
        }
    }

    // Common spreadsheet typos vs registered names (first + last with one edit)
    if (!debtor) {
        const parts = personNameTokens(name);
        if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];
            const candidates = await Debtor.find({
                'contactInfo.name': new RegExp(escapeRegex(lastName.slice(0, 4)), 'i')
            })
                .sort({ updatedAt: -1 })
                .limit(50)
                .lean();
            const hits = candidates.filter((d) => {
                const tokens = personNameTokens(d.contactInfo?.name || '');
                if (tokens.length < 2) return false;
                if (tokens[0] !== firstName.toLowerCase()) return false;
                return scorePersonNameMatch(name, d.contactInfo?.name || '') >= 0.88;
            });
            if (hits.length === 1) {
                debtor = hits[0];
                matchMethod = 'typo_first_last';
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
    const resolvedRoom =
        roomNumber && String(roomNumber).trim()
            ? String(roomNumber).trim()
            : await lookupRoomForDebtor(debtor, residenceId);

    return finish({
        ok: true,
        debtor,
        studentId: debtor.user?.toString?.() || debtor.user,
        debtorId: debtor._id.toString(),
        accountCode,
        roomNumber: resolvedRoom || null,
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
    // Jan2026, june2026, jul26 — month immediately followed by year digits only
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\d{2,4}$/.test(n)) return true;
    if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\d{2,4}$/.test(n)) return true;
    return false;
}

function billingPeriodFromPaymentContext(paymentDate, sheetName, defaultDate) {
    const d = paymentDate ? new Date(paymentDate) : defaultDate ? new Date(defaultDate) : new Date();
    if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (sheetName && isMonthSheetName(sheetName)) {
        const normalized = normalizeSheetName(sheetName);
        let monthIdx = MONTH_ABBR.indexOf(normalized);
        if (monthIdx < 0) monthIdx = MONTH_NAMES.indexOf(normalized);
        if (monthIdx < 0) {
            const m = normalized.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{2,4})$/);
            if (m) monthIdx = MONTH_ABBR.indexOf(m[1]);
        }
        if (monthIdx >= 0) {
            const year = defaultDate ? new Date(defaultDate).getFullYear() : new Date().getFullYear();
            return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        }
    }
    return null;
}

function scoreInvoiceForPayment(invoice, { billingPeriod, paymentAmount }) {
    if (!invoice || invoice.status === 'cancelled') return -1;

    let score = 0;
    const period = String(invoice.billingPeriod || '').trim();
    if (billingPeriod && period === billingPeriod) score += 50;
    else if (billingPeriod && period.includes(billingPeriod)) score += 35;

    const amt = Math.round(Number(paymentAmount) * 100) / 100;
    const balance = Math.round(Number(invoice.balanceDue ?? invoice.totalAmount) * 100) / 100;
    const total = Math.round(Number(invoice.totalAmount) * 100) / 100;
    if (amt > 0 && Math.abs(balance - amt) <= 0.02) score += 45;
    else if (amt > 0 && Math.abs(total - amt) <= 0.02) score += 30;

    if (['unpaid', 'partial', 'overdue'].includes(invoice.paymentStatus)) score += 10;

    return score;
}

/**
 * When Excel has no invoice #, resolve from Invoice collection for a matched tenant.
 */
async function resolveInvoiceForPaymentRow({
    studentId,
    residenceId,
    paymentDate,
    paymentAmount,
    sheetName = null,
    defaultDate = null,
    cache = null
}) {
    const mongoose = require('mongoose');
    const Invoice = require('../models/Invoice');

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return { ok: false, error: 'studentId required for invoice lookup' };
    }

    const billingPeriod = billingPeriodFromPaymentContext(paymentDate, sheetName, defaultDate);
    const cacheKey = `${studentId}|${residenceId || ''}|${billingPeriod || ''}|${paymentAmount || ''}`;
    if (cache && cache.has(cacheKey)) return cache.get(cacheKey);

    const finish = (result) => {
        if (cache) cache.set(cacheKey, result);
        return result;
    };

    const query = {
        student: studentId,
        status: { $ne: 'cancelled' }
    };
    if (residenceId && mongoose.Types.ObjectId.isValid(residenceId)) {
        query.residence = residenceId;
    }

    let candidates = await Invoice.find(query)
        .select('_id invoiceNumber billingPeriod totalAmount balanceDue paymentStatus status billingStartDate')
        .sort({ billingStartDate: -1, createdAt: -1 })
        .limit(40)
        .lean();

    if (!candidates.length && query.residence) {
        delete query.residence;
        candidates = await Invoice.find(query)
            .select('_id invoiceNumber billingPeriod totalAmount balanceDue paymentStatus status billingStartDate residence')
            .sort({ billingStartDate: -1, createdAt: -1 })
            .limit(40)
            .lean();
    }

    if (!candidates.length) {
        return finish({
            ok: false,
            error: billingPeriod
                ? `No invoice found for billing period ${billingPeriod}`
                : 'No invoice found for student'
        });
    }

    if (billingPeriod) {
        const periodMatches = candidates.filter((inv) => String(inv.billingPeriod || '').includes(billingPeriod));
        if (periodMatches.length === 1) {
            return finish({
                ok: true,
                invoice: periodMatches[0],
                matchReason: `billing period ${billingPeriod}`
            });
        }
    }

    const scored = candidates
        .map((invoice) => ({
            invoice,
            score: scoreInvoiceForPayment(invoice, { billingPeriod, paymentAmount })
        }))
        .filter((row) => row.score >= 40)
        .sort((a, b) => b.score - a.score);

    if (scored.length >= 1) {
        const best = scored[0];
        const second = scored[1];
        if (!second || best.score - second.score >= 5) {
            return finish({
                ok: true,
                invoice: best.invoice,
                matchReason: `score ${best.score}${billingPeriod ? ` (${billingPeriod})` : ''}`
            });
        }
    }

    const amt = Math.round(Number(paymentAmount) * 100) / 100;
    if (amt > 0) {
        const amountMatches = candidates.filter((inv) => {
            const balance = Math.round(Number(inv.balanceDue ?? inv.totalAmount) * 100) / 100;
            const total = Math.round(Number(inv.totalAmount) * 100) / 100;
            return Math.abs(balance - amt) <= 0.02 || Math.abs(total - amt) <= 0.02;
        });
        if (amountMatches.length === 1) {
            return finish({
                ok: true,
                invoice: amountMatches[0],
                matchReason: `payment amount $${amt}`
            });
        }
    }

    return finish({
        ok: false,
        error: billingPeriod
            ? `No matching invoice for ${billingPeriod} (found ${candidates.length} other invoice(s))`
            : `No invoice matched payment amount (found ${candidates.length} invoice(s))`
    });
}

/** Apply resolved system invoice to parsed Excel row (reference, journalKey, flags). */
function applySystemInvoiceToRow(row, invoice) {
    if (!invoice?.invoiceNumber) return row;

    const invoiceNumber = String(invoice.invoiceNumber).trim();
    const sheetPrefix = row.sheetName ? String(row.sheetName).trim() : '';
    const typePrefix = row.type === 'charge' ? 'CHG' : 'PAY';
    const baseKey = invoiceNumber;
    const labelParts = [
        row.customer,
        row.roomNumber && `Room ${row.roomNumber}`,
        `Inv ${invoiceNumber}`,
        sheetPrefix && `(${sheetPrefix})`
    ].filter(Boolean);
    const label = labelParts.join(' — ');
    const descPrefix = row.type === 'charge' ? 'Invoice charge' : 'Payment received';

    return {
        ...row,
        invoiceNumber,
        missingInvoiceNumber: false,
        invoiceResolvedFromSystem: true,
        systemInvoiceId: invoice._id?.toString?.() || invoice._id,
        reference: invoiceNumber,
        journalKey: `${typePrefix}-${sheetPrefix ? `${sheetPrefix}-` : ''}${baseKey}`,
        description: `${descPrefix} — ${label}`
    };
}

/** One payment per tenant + amount per month tab (or per calendar month). */
/**
 * One query up-front for upload idempotency (avoids N findOne calls per row).
 */
async function prefetchExistingPaymentJournals(residenceId) {
    const mongoose = require('mongoose');
    const TransactionEntry = require('../models/TransactionEntry');
    if (!residenceId || !mongoose.Types.ObjectId.isValid(residenceId)) {
        return {
            byJournalKey: new Map(),
            byDedupKey: new Map(),
            byReference: new Map(),
            byRowDedupKey: new Map(),
            entries: []
        };
    }

    const entries = await TransactionEntry.find({
        status: { $ne: 'reversed' },
        residence: residenceId,
        'metadata.invoiceRowType': 'payment'
    })
        .select(
            '_id transactionId totalDebit date reference metadata.excelJournalKey metadata.customer metadata.sheetName metadata.invoiceRowType'
        )
        .lean();

    const byJournalKey = new Map();
    const byDedupKey = new Map();
    const byReference = new Map();
    const byRowDedupKey = new Map();
    for (const entry of entries) {
        const journalKey = String(entry.metadata?.excelJournalKey || '').trim();
        if (journalKey) byJournalKey.set(journalKey, entry);

        const ref = String(entry.reference || '').trim().toUpperCase();
        if (ref) byReference.set(ref, entry);

        const rowKey = buildExcelRowDedupKey({
            reference: entry.reference,
            customer: entry.metadata?.customer,
            amount: entry.totalDebit,
            date: entry.date,
            sheetName: entry.metadata?.sheetName
        });
        if (rowKey) byRowDedupKey.set(rowKey, entry);

        const dedupKey = buildExcelPaymentDedupKey({
            customer: entry.metadata?.customer,
            amount: entry.totalDebit,
            date: entry.date,
            sheetName: entry.metadata?.sheetName
        });
        if (dedupKey) byDedupKey.set(dedupKey, entry);
    }

    return { byJournalKey, byDedupKey, byReference, byRowDedupKey, entries };
}

function registerPaymentInPrefetch(prefetch, { journalKey, customer, amount, date, sheetName, savedEntry }) {
    if (!prefetch || !savedEntry) return;
    const normalizedKey = String(journalKey || '').trim();
    if (normalizedKey) prefetch.byJournalKey.set(normalizedKey, savedEntry);
    const ref = String(savedEntry.reference || '').trim().toUpperCase();
    if (ref && prefetch.byReference) prefetch.byReference.set(ref, savedEntry);
    const dedupKey = buildExcelPaymentDedupKey({
        customer,
        amount,
        date,
        sheetName
    });
    if (dedupKey) prefetch.byDedupKey.set(dedupKey, savedEntry);
    const rowKey = buildExcelRowDedupKey({
        reference: savedEntry.reference,
        customer,
        amount,
        date,
        sheetName
    });
    if (rowKey && prefetch.byRowDedupKey) prefetch.byRowDedupKey.set(rowKey, savedEntry);
}

function buildExcelPaymentDedupKey({ customer, amount, date, sheetName }) {
    const name = normalizeCustomerForDedup(customer);
    if (!name || !amount) return null;
    const amt = (Math.round(Number(amount) * 100) / 100).toFixed(2);
    if (sheetName && isMonthSheetName(sheetName)) {
        return `${name}|${amt}|tab:${normalizeSheetName(sheetName)}`;
    }
    const d = date ? new Date(date) : null;
    if (d && !Number.isNaN(d.getTime())) {
        return `${name}|${amt}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return `${name}|${amt}|sheet:${normalizeSheetName(sheetName || 'unknown')}`;
}

function normalizeCustomerForDedup(customer) {
    return String(customer || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Stable dedup for Sheet1 rows — reference alone collides across June test vs August uploads.
 */
function buildExcelRowDedupKey({ reference, customer, amount, date, sheetName }) {
    const ref = String(reference || '').trim().toUpperCase();
    const name = normalizeCustomerForDedup(customer);
    if (!name || !amount) return null;
    const amt = (Math.round(Number(amount) * 100) / 100).toFixed(2);
    const paymentKey = buildExcelPaymentDedupKey({ customer, amount, date, sheetName });
    if (ref) return `${ref}|${name}|${amt}|${paymentKey || 'nodate'}`;
    return paymentKey;
}

function excelUploadRowMatches(
    existing,
    { customer, amount, date, sheetName, reference = null, allowFuzzyCustomer = false }
) {
    if (!existing) return false;
    const exName = normalizeCustomerForDedup(existing.metadata?.customer);
    const newName = normalizeCustomerForDedup(customer);
    if (exName && newName && exName !== newName) {
        if (!allowFuzzyCustomer) return false;
    }
    const exAmt = Math.round(Number(existing.totalDebit) * 100) / 100;
    const newAmt = Math.round(Number(amount) * 100) / 100;
    if (exAmt !== newAmt) return false;

    if (reference) {
        const exRef = String(existing.reference || '').trim().toUpperCase();
        const newRef = String(reference).trim().toUpperCase();
        if (exRef && newRef && exRef !== newRef) return false;
    }

    const exKey = buildExcelPaymentDedupKey({
        customer: existing.metadata?.customer,
        amount: existing.totalDebit,
        date: existing.date,
        sheetName: existing.metadata?.sheetName
    });
    const newKey = buildExcelPaymentDedupKey({ customer, amount, date, sheetName });
    if (exKey && newKey && exKey !== newKey) return false;

    return true;
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
                    } else if (isCashReceiptHeaders(headerInfo.headers)) {
                        parseable = true;
                        format = 'cash_receipt';
                    } else if (isLedgerDateHeaders(headerInfo.headers)) {
                        parseable = true;
                        format = 'ledger_date';
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
        if (isTenantUploadHeaders(headerInfo.headers)) {
            throw new Error(
                `Sheet "${sheetName}" looks like a tenant/student list (Name, Email, Lease Start/End). ` +
                `Use Admin → Upload Students (CSV/Excel), not Finance → journal Excel upload.`
            );
        }
        const cols = Object.keys(headerInfo.headers).filter(Boolean).join(', ') || '(no column headers found)';
        throw new Error(
            `Sheet "${sheetName}": could not detect header row (columns seen: ${cols}). ` +
            `For payments use: Customer, Payment (or Amount), optional Rental/Admin Fee/Invoice #. ` +
            `For classic journals use: journal_key, description, account_code, debit, credit.`
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

    if (isInvoicePaymentHeaders(headerInfo.headers) || isLedgerDateHeaders(headerInfo.headers)) {
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

    if (isCashReceiptHeaders(headerInfo.headers)) {
        return {
            ...parseCashReceiptSheet(sheet, headerInfo, {
                defaultDate,
                mode,
                sheetName
            }),
            headerRow: headerInfo.rowNumber,
            reportingDate
        };
    }

    const seenCols = Object.keys(headerInfo.headers).join(', ') || '(none)';
    throw new Error(
        `Sheet "${sheetName}": unrecognized format (header row ${headerInfo.rowNumber}: ${seenCols}). ` +
        `Supported: Customer/Invoice/Payment columns, Date/Name/Narration/Dr/Cr cash receipt, ` +
        `or classic journal_key, account_code, debit, credit.`
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
    buildExcelPaymentDedupKey,
    buildExcelRowDedupKey,
    excelUploadRowMatches,
    normalizeCustomerForDedup,
    prefetchExistingPaymentJournals,
    registerPaymentInPrefetch,
    getDebtorNameIndex,
    resolveDebtorForCustomer,
    resolveInvoiceForPaymentRow,
    applySystemInvoiceToRow,
    lookupRoomForDebtor,
    scorePersonNameMatch,
    transactionSourceForInvoiceRow,
    isClassicJournalHeaders,
    isInvoicePaymentHeaders,
    isCashReceiptHeaders,
    isTenantUploadHeaders,
    isMonthSheetName,
    normalizeSheetName
};
