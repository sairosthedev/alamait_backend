const ExcelJS = require('exceljs');

function parseAmount(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(value * 100) / 100;
    }
    const cleaned = String(value).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function isHeaderLikeName(name) {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return true;
    return (
        /^actual$|^system$|^name$|^amount$|^tenant$|^total$|^rent$/.test(n)
        || /actual name|system name|actual amount|system amount|tenant name/.test(n)
    );
}

function isTotalRow(values) {
    const joined = values.filter(Boolean).join(' ').trim();
    if (!joined) return true;
    if (/^[\d,\.\s]+$/.test(joined)) return true;
    if (/total/i.test(joined) && /\d/.test(joined)) return true;
    return false;
}

function cellValueToString(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object' && value.text) return String(value.text).trim();
    if (typeof value === 'object' && value.result != null) return String(value.result).trim();
    return String(value).trim();
}

function rowToCells(row, maxCol = 12) {
    const cells = [];
    for (let col = 1; col <= maxCol; col++) {
        cells.push(cellValueToString(row.getCell(col).value));
    }
    while (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop();
    }
    return cells;
}

/**
 * Extract name+amount pairs from a row, skipping blank columns (e.g. A,B = actual, D,E = system).
 */
function extractNameAmountPairs(cells) {
    const pairs = [];
    let i = 0;

    while (i < cells.length) {
        const cell = (cells[i] || '').trim();
        if (!cell) {
            i++;
            continue;
        }

        if (/^[\d.,]+$/.test(cell)) {
            if (pairs.length && pairs[pairs.length - 1].amount == null) {
                pairs[pairs.length - 1].amount = parseAmount(cell);
            }
            i++;
            continue;
        }

        const nextAmount = parseAmount(cells[i + 1]);
        if (nextAmount != null && !isHeaderLikeName(cells[i + 1])) {
            if (!isHeaderLikeName(cell)) {
                pairs.push({ name: cell, amount: nextAmount });
            }
            i += 2;
            continue;
        }

        if (!isHeaderLikeName(cell)) {
            pairs.push({ name: cell, amount: null });
        }
        i++;
    }

    return pairs.filter(p => p.name && !isHeaderLikeName(p.name));
}

function pairsToComparisonRow(pairs, rawLabel) {
    if (!pairs.length) return null;

    const actual = pairs[0];
    const system = pairs[1] || null;

    if (isHeaderLikeName(actual.name)) return null;
    if (actual.amount == null && !system) return null;
    if (isTotalRow([actual.name, String(actual.amount ?? ''), system?.name || '', String(system?.amount ?? '')])) {
        return null;
    }

    return {
        actualName: actual.name,
        actualAmount: actual.amount,
        systemName: system?.name || null,
        systemAmount: system?.amount ?? null,
        rawLine: rawLabel
    };
}

function parseComparisonLine(line) {
    if (!line || !String(line).trim()) return null;

    const amountPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{2})/g;
    const matches = [...line.matchAll(amountPattern)];
    if (matches.length === 0) return null;

    const segments = [];
    let lastIndex = 0;
    for (const match of matches) {
        const namePart = line.slice(lastIndex, match.index).replace(/\t+/g, ' ').trim();
        segments.push({
            name: namePart || null,
            amount: parseAmount(match[0])
        });
        lastIndex = match.index + match[0].length;
    }

    if (!segments[0]?.name || isHeaderLikeName(segments[0].name)) return null;

    return {
        actualName: segments[0].name,
        actualAmount: segments[0].amount,
        systemName: segments[1]?.name || null,
        systemAmount: segments[1]?.amount ?? null,
        rawLine: line.trim()
    };
}

function parseComparisonText(text) {
    if (!text || !String(text).trim()) return [];

    const rows = [];
    for (const line of String(text).split(/\r?\n/)) {
        const parsed = parseComparisonLine(line);
        if (parsed) rows.push(parsed);
    }
    return rows;
}

function rowIsLikelyHeader(cells) {
    const pairs = extractNameAmountPairs(cells);
    if (pairs.length === 0) return true;
    if (pairs.every(p => p.amount == null)) return true;
    if (pairs.length === 1 && isHeaderLikeName(pairs[0].name)) return true;
    return false;
}

async function parseComparisonFile(buffer, originalName = '', mimetype = '') {
    const name = (originalName || '').toLowerCase();
    const isCsv =
        name.endsWith('.csv') ||
        String(mimetype).includes('csv') ||
        mimetype === 'text/plain';

    if (isCsv) {
        return parseComparisonText(buffer.toString('utf8'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
    }

    const rows = [];
    let startRow = 1;

    for (let probe = 1; probe <= Math.min(4, worksheet.rowCount); probe++) {
        const cells = rowToCells(worksheet.getRow(probe));
        if (!cells.some(c => c !== '')) continue;
        if (rowIsLikelyHeader(cells)) {
            startRow = probe + 1;
        } else {
            startRow = probe;
            break;
        }
    }

    for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber++) {
        const cells = rowToCells(worksheet.getRow(rowNumber));
        if (!cells.some(c => c !== '')) continue;

        const pairs = extractNameAmountPairs(cells);
        const parsed = pairsToComparisonRow(pairs, `row ${rowNumber}`);
        if (parsed) rows.push(parsed);
    }

    return rows;
}

module.exports = {
    parseAmount,
    parseComparisonLine,
    parseComparisonText,
    parseComparisonFile,
    extractNameAmountPairs,
    isHeaderLikeName,
    pairsToComparisonRow
};
