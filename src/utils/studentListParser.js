const ExcelJS = require('exceljs');

/**
 * Build firstname.surname@gmail.com from name parts.
 */
function buildGmailFromName(firstName, lastName) {
    const f = String(firstName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const l = String(lastName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'tenant';
    return `${f}.${l}@gmail.com`;
}

function splitLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return [];
    if (trimmed.includes('\t')) {
        return trimmed.split('\t').map((c) => c.trim());
    }
    if (trimmed.includes('|')) {
        return trimmed.split('|').map((c) => c.trim());
    }
    // CSV with optional quotes
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '"') {
            if (inQuotes && trimmed[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cells.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cells.push(cur.trim());
    return cells;
}

function isHeaderLine(cells) {
    const joined = cells.join(' ').toLowerCase();
    if (!joined.trim()) return true;
    return (
        /first|last|surname|name|room|email|phone|lease|start|end|rent|tenant|customer|client|occupant/.test(joined)
        && !/^\d/.test(cells[0] || '')
        && !looksLikeRoomCode(cells[0])
    );
}

function looksLikeRoomCode(value) {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/^(single|double|triple|quad|shared)$/i.test(s)) return false;
    return /^[A-Z]{1,5}\d*[A-Z0-9]*$/i.test(s) || /^[A-Z]+\d+[A-Z]*$/i.test(s);
}

function splitFullName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function mapHeaderColumns(headers) {
    const map = {};
    headers.forEach((h, idx) => {
        const c = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!c) return;
        if (/^firstname|^given|^name$/.test(c) && map.firstName == null) map.firstName = idx;
        else if (/^lastname|^surname|^family/.test(c)) map.lastName = idx;
        else if (/^fullname|^studentname|^tenant|^customer|^client|^occupant|^resident|^student$/.test(c)) {
            if (map.fullName == null) map.fullName = idx;
        }
        else if (/^roomnumber|^roomno|^roomname|^roomcode|^room|^unit/.test(c)) map.room = idx;
        else if (/^email|^mail/.test(c)) map.email = idx;
        else if (/^phone|^mobile|^cell/.test(c)) map.phone = idx;
        else if (/^start|^leasestart/.test(c)) map.startDate = idx;
        else if (/^end|^leaseend/.test(c)) map.endDate = idx;
    });
    return map;
}

function rowFromTwoColumn(cells, headerMap = null) {
    if (headerMap?.room != null && (headerMap.fullName != null || headerMap.firstName != null)) {
        return rowFromHeaders(cells, headerMap);
    }
    if (cells.length !== 2) return null;

    const [a, b] = cells.map((c) => String(c || '').trim());
    const aIsRoom = looksLikeRoomCode(a);
    const bIsRoom = looksLikeRoomCode(b);

    if (aIsRoom && !bIsRoom) {
        const { firstName, lastName } = splitFullName(b);
        return { firstName, lastName, roomNumber: a };
    }
    if (bIsRoom && !aIsRoom) {
        const { firstName, lastName } = splitFullName(a);
        return { firstName, lastName, roomNumber: b };
    }
    return null;
}

function isValidStudentRow(raw) {
    return !!(raw && (raw.firstName || raw.lastName || raw.roomNumber));
}

function rowFromPositional(cells) {
    if (cells.length < 4) return null;
    let firstName;
    let lastName;
    let room;
    let phone;
    let startDate;
    let endDate;

    if (cells.length >= 6) {
        [firstName, lastName, room, phone, startDate, endDate] = cells;
    } else if (cells.length === 5) {
        [firstName, lastName, room, startDate, endDate] = cells;
        phone = '';
    } else if (cells.length === 4) {
        [firstName, lastName, room, startDate] = cells;
        endDate = '';
        phone = '';
    } else {
        return null;
    }

    return {
        firstName: String(firstName || '').trim(),
        lastName: String(lastName || '').trim(),
        roomNumber: String(room || '').trim(),
        phone: phone ? String(phone).trim() : undefined,
        startDate: startDate ? String(startDate).trim() : undefined,
        endDate: endDate ? String(endDate).trim() : undefined
    };
}

function rowFromHeaders(cells, headerMap) {
    const get = (key) => {
        const idx = headerMap[key];
        return idx != null ? String(cells[idx] ?? '').trim() : '';
    };
    let firstName = get('firstName');
    let lastName = get('lastName');
    const fullName = get('fullName');
    if ((!firstName || !lastName) && fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (!firstName && parts.length) firstName = parts[0];
        if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ');
    }
    return {
        firstName,
        lastName,
        email: get('email') || undefined,
        phone: get('phone') || undefined,
        roomNumber: get('room') || undefined,
        startDate: get('startDate') || undefined,
        endDate: get('endDate') || undefined
    };
}

/**
 * Parse pasted text: header row optional.
 * Formats:
 *   Name, Surname, Room, Phone, Lease Start, Lease End
 *   John, Doe, M1, 077..., 2026-02-01, 2026-06-30
 */
function parseStudentListText(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];

    const firstCells = splitLine(lines[0]);
    let headerMap = null;
    let startIdx = 0;

    if (isHeaderLine(firstCells)) {
        headerMap = mapHeaderColumns(firstCells);
        startIdx = 1;
    }

    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
        const cells = splitLine(lines[i]);
        if (!cells.some(Boolean)) continue;

        const raw = headerMap
            ? rowFromHeaders(cells, headerMap)
            : (cells.length === 2
                ? rowFromTwoColumn(cells)
                : rowFromPositional(cells));

        if (isValidStudentRow(raw)) {
            rows.push(raw);
        }
    }
    return rows;
}

function parseStudentListRows(rawRows) {
    if (!Array.isArray(rawRows)) return [];
    return rawRows.filter((r) => r && typeof r === 'object');
}

async function parseStudentListFile(buffer, originalName = '', mimetype = '') {
    const name = (originalName || '').toLowerCase();
    const isCsv =
        name.endsWith('.csv') ||
        mimetype.includes('csv') ||
        mimetype === 'text/plain';

    if (isCsv) {
        return parseStudentListText(buffer.toString('utf8'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows = [];
    let headerMap = null;

    sheet.eachRow((row, rowNumber) => {
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            while (cells.length < colNumber - 1) cells.push('');
            let v = cell.value;
            if (v instanceof Date) {
                v = v.toISOString().slice(0, 10);
            } else if (v && typeof v === 'object' && v.result != null) {
                v = v.result;
            } else if (v && typeof v === 'object' && v.text) {
                v = v.text;
            }
            cells.push(v == null ? '' : String(v).trim());
        });

        if (!cells.some(Boolean)) return;

        if (rowNumber === 1 || (!headerMap && isHeaderLine(cells))) {
            headerMap = mapHeaderColumns(cells);
            if (headerMap.firstName != null || headerMap.fullName != null || headerMap.room != null) {
                return;
            }
            headerMap = null;
        }

        const parsed = headerMap
            ? rowFromHeaders(cells, headerMap)
            : (cells.length === 2
                ? rowFromTwoColumn(cells)
                : rowFromPositional(cells));

        if (isValidStudentRow(parsed)) {
            rows.push(parsed);
        }
    });

    return rows;
}

/**
 * Resolve rows from multipart upload, paste text, csvData, or rows array.
 */
async function parseStudentUpload(req) {
    if (req.file?.buffer) {
        return parseStudentListFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
    }
    if (req.body?.text) {
        return parseStudentListText(req.body.text);
    }
    if (req.body?.csvData) {
        if (typeof req.body.csvData === 'string') {
            return parseStudentListText(req.body.csvData);
        }
        if (Array.isArray(req.body.csvData)) {
            return parseStudentListRows(req.body.csvData);
        }
    }
    if (req.body?.rows && Array.isArray(req.body.rows)) {
        return parseStudentListRows(req.body.rows);
    }
    if (req.body?.students && Array.isArray(req.body.students)) {
        return parseStudentListRows(req.body.students);
    }
    return null;
}

/**
 * Apply default lease dates to rows missing dates.
 * @param {Array} rows
 * @param {{ startDate?, endDate?, applyTo?: 'all'|'selected', selectedRoomNumbers?: string[], selectedRows?: number[] }} options
 */
function applyLeaseDefaults(rows, options = {}) {
    const {
        startDate,
        endDate,
        applyTo = 'all',
        selectedRoomNumbers = [],
        selectedRows = []
    } = options;

    if (!startDate && !endDate) return rows;

    const selectedRoomSet = new Set(
        selectedRoomNumbers.map((r) => String(r || '').trim()).filter(Boolean)
    );
    const selectedRowSet = new Set(
        selectedRows.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    );

    return rows.map((row, index) => {
        const rowNum = index + 1;
        const hasDates = row.startDate && row.endDate;
        if (hasDates) return row;

        let shouldApply = false;
        if (applyTo === 'selected') {
            shouldApply = selectedRoomSet.has(String(row.roomNumber || '').trim())
                || selectedRowSet.has(rowNum);
        } else {
            shouldApply = true;
        }

        if (!shouldApply) return row;

        return {
            ...row,
            startDate: row.startDate || startDate,
            endDate: row.endDate || endDate
        };
    });
}

module.exports = {
    buildGmailFromName,
    parseStudentListText,
    parseStudentListRows,
    parseStudentListFile,
    parseStudentUpload,
    applyLeaseDefaults,
    looksLikeRoomCode,
    splitFullName
};
