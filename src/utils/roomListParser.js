const ExcelJS = require('exceljs');

function parsePrice(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(value * 100) / 100;
    }
    const cleaned = String(value).replace(/[$,\s]/g, '').trim();
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeRoomKey(value) {
    return String(value || '').trim();
}

function isHeaderRow(cells) {
    const joined = cells.join(' ').toLowerCase();
    if (!joined.trim()) return true;
    const headerHints = ['room', 'price', 'rent', 'name', 'number', 'monthly'];
    const matches = headerHints.filter((h) => joined.includes(h)).length;
    return matches >= 2;
}

function mapHeaderColumns(cells) {
    const map = { roomNumber: -1, newRoomNumber: -1, price: -1 };
    cells.forEach((cell, idx) => {
        const c = String(cell || '').toLowerCase().trim();
        if (!c) return;
        if (/^new\s*(room|name|number)/.test(c) || c === 'new room' || c === 'new name') {
            map.newRoomNumber = idx;
        } else if (/^(room|room name|room number|room #|name|unit)$/.test(c) || /^room\s*(name|number|#)?$/.test(c)) {
            if (map.roomNumber === -1) map.roomNumber = idx;
        } else if (/^(price|rent|monthly rent|monthly|amount)$/.test(c) || /rent/.test(c)) {
            if (map.price === -1) map.price = idx;
        }
    });
    return map;
}

function rowFromCells(cells, headerMap = null) {
    const trimmed = cells.map((c) => normalizeRoomKey(c)).filter((c, i, arr) => c || arr.length <= 3);
    if (!trimmed.length || isHeaderRow(trimmed)) return null;

    if (headerMap && headerMap.roomNumber >= 0) {
        const roomNumber = normalizeRoomKey(cells[headerMap.roomNumber]);
        const newRoomNumber = headerMap.newRoomNumber >= 0
            ? normalizeRoomKey(cells[headerMap.newRoomNumber])
            : null;
        const price = headerMap.price >= 0 ? parsePrice(cells[headerMap.price]) : null;
        if (!roomNumber) return null;
        return {
            roomNumber,
            newRoomNumber: newRoomNumber || undefined,
            price: price != null ? price : undefined
        };
    }

    const numericCells = trimmed.map((c) => parsePrice(c));
    const priceIndices = numericCells
        .map((n, i) => (n != null ? i : -1))
        .filter((i) => i >= 0);

    if (trimmed.length === 1) {
        return null;
    }

    if (trimmed.length === 2) {
        const [a, b] = trimmed;
        const priceA = parsePrice(a);
        const priceB = parsePrice(b);
        if (priceA != null && priceB == null) {
            return null;
        }
        if (priceB != null) {
            return { roomNumber: a, price: priceB };
        }
        if (priceA != null) {
            return { roomNumber: b, price: priceA };
        }
        return { roomNumber: a, price: parsePrice(b) ?? undefined };
    }

    if (trimmed.length >= 3) {
        const lastPrice = parsePrice(trimmed[trimmed.length - 1]);
        if (lastPrice != null && priceIndices.length === 1) {
            return {
                roomNumber: trimmed[0],
                newRoomNumber: trimmed[1],
                price: lastPrice
            };
        }
    }

    const last = trimmed[trimmed.length - 1];
    const price = parsePrice(last);
    if (price != null && trimmed.length >= 2) {
        return {
            roomNumber: trimmed[0],
            newRoomNumber: trimmed.length > 2 ? trimmed[1] : undefined,
            price
        };
    }

    return null;
}

function parseRoomListText(text) {
    const lines = String(text || '').split(/\r?\n/);
    const rows = [];
    let headerMap = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cells = trimmed.includes('\t')
            ? trimmed.split('\t').map((c) => c.trim())
            : trimmed.split(/[,;|]/).map((c) => c.trim());

        if (!headerMap && isHeaderRow(cells)) {
            headerMap = mapHeaderColumns(cells);
            continue;
        }

        const row = rowFromCells(cells, headerMap);
        if (row && row.roomNumber) {
            rows.push(row);
        }
    }

    return rows;
}

function parseRoomListRows(rawRows) {
    if (!Array.isArray(rawRows)) return [];
    return rawRows
        .map((r) => {
            if (!r || typeof r !== 'object') return null;
            const roomNumber = normalizeRoomKey(r.roomNumber || r.room || r.name || r.roomName);
            if (!roomNumber) return null;
            const newRoomNumber = normalizeRoomKey(r.newRoomNumber || r.newRoom || r.newName);
            const price = r.price != null ? parsePrice(r.price) : (r.rent != null ? parsePrice(r.rent) : undefined);
            return {
                roomNumber,
                newRoomNumber: newRoomNumber || undefined,
                price: price != null ? price : undefined
            };
        })
        .filter(Boolean);
}

async function parseRoomListFile(buffer, originalName = '', mimetype = '') {
    const name = (originalName || '').toLowerCase();
    const isCsv = name.endsWith('.csv') || mimetype.includes('csv') || mimetype === 'text/plain';

    if (isCsv) {
        return parseRoomListText(buffer.toString('utf8'));
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
            if (v && typeof v === 'object' && v.result != null) v = v.result;
            if (v && typeof v === 'object' && v.text) v = v.text;
            cells.push(v == null ? '' : String(v).trim());
        });

        if (!cells.some(Boolean)) return;
        if (!headerMap && (rowNumber === 1 || isHeaderRow(cells))) {
            headerMap = mapHeaderColumns(cells);
            if (headerMap.roomNumber >= 0 || headerMap.price >= 0) return;
        }

        const parsed = rowFromCells(cells, headerMap);
        if (parsed?.roomNumber) rows.push(parsed);
    });

    return rows;
}

async function parseRoomUpload(req) {
    if (req.file?.buffer) {
        return parseRoomListFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
    }
    if (req.body?.text) {
        return parseRoomListText(req.body.text);
    }
    if (req.body?.csvData) {
        return parseRoomListText(req.body.csvData);
    }
    if (req.body?.rows && Array.isArray(req.body.rows)) {
        return parseRoomListRows(req.body.rows);
    }
    if (req.body?.rooms && Array.isArray(req.body.rooms)) {
        return parseRoomListRows(req.body.rooms);
    }
    return null;
}

module.exports = {
    parsePrice,
    parseRoomListText,
    parseRoomListRows,
    parseRoomListFile,
    parseRoomUpload
};
