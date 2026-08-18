/**
 * Calendar-date helpers for lease/rent dates.
 * Store and read YYYY-MM-DD without timezone shifting the month/day.
 */

function calendarDateUtc(y, m, d) {
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0));
}

function parseSlashDateToIso(value) {
    const stringValue = String(value).trim();
    const parts = stringValue.split('/');
    if (parts.length !== 3) return null;

    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const year = String(parts[2]).trim();
    if (!year || Number.isNaN(p0) || Number.isNaN(p1)) return null;

    let day;
    let month;
    if (p0 > 12) {
        day = p0;
        month = p1;
    } else if (p1 > 12) {
        month = p0;
        day = p1;
    } else {
        // D/M/YYYY (Zimbabwe / UK): 1/4/2026 = 1 April 2026
        day = p0;
        month = p1;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const SLASH_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function isExcelSerialDate(value) {
    return typeof value === 'number' && value > 20000 && value < 80000;
}

function parseExcelSerialDate(serial) {
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(Number(serial)) * 86400000;
    const d = new Date(utcMs);
    return calendarDateUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Parse upload / API date input to a Date at UTC noon on the intended calendar day. */
function parseCalendarDate(value) {
    if (value === undefined || value === null || value === '') return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        // Use local calendar day — matches how browsers build Date from CSV/UI fields
        return calendarDateUtc(
            value.getFullYear(),
            value.getMonth() + 1,
            value.getDate()
        );
    }

    const stringValue = String(value).trim();
    let iso = stringValue;
    if (stringValue.includes('/') && !stringValue.includes('T')) {
        iso = parseSlashDateToIso(stringValue);
        if (!iso) return null;
    }

    if (stringValue.includes('T')) {
        let toParse = stringValue;
        if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(stringValue)) {
            // Frontend often sends toISOString().slice(0, 19) without the Z suffix
            toParse = `${stringValue}Z`;
        }
        const instant = new Date(toParse);
        if (!Number.isNaN(instant.getTime())) {
            return calendarDateUtc(
                instant.getFullYear(),
                instant.getMonth() + 1,
                instant.getDate()
            );
        }
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (match) {
        return calendarDateUtc(match[1], match[2], match[3]);
    }

    const parsed = new Date(stringValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parseCalendarDate(parsed);
}

/**
 * Upload-specific date parse — recovers dates broken by `Date.toISOString().slice(0,10)`.
 * e.g. local 1 Apr 2026 in UTC+2 is sent as "2026-03-31".
 */
function parseUploadCalendarDate(value, role = 'start') {
    if (value === undefined || value === null || value === '') return null;

    if (isExcelSerialDate(value)) {
        return parseExcelSerialDate(value);
    }

    const str = String(value).trim();
    if (SLASH_DATE_RE.test(str) || (str.includes('/') && !str.includes('T'))) {
        return parseCalendarDate(str);
    }

    const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (bare) {
        const y = Number(bare[1]);
        const m = Number(bare[2]);
        const d = Number(bare[3]);
        const nextLocal = new Date(y, m - 1, d + 1);
        if (nextLocal.toISOString().slice(0, 10) === str) {
            const rd = nextLocal.getDate();
            const rm = nextLocal.getMonth() + 1;
            const ry = nextLocal.getFullYear();
            if (role === 'start' && rd === 1) {
                return calendarDateUtc(ry, rm, rd);
            }
            if (role === 'end' && rd >= 28 && rd !== 1) {
                return calendarDateUtc(ry, rm, rd);
            }
        }
        return calendarDateUtc(y, m, d);
    }

    return parseCalendarDate(value);
}

/** Calendar Y-M-D from a stored Date (UTC, not local timezone). */
function getCalendarParts(value) {
    const d = value instanceof Date ? value : parseCalendarDate(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate()
    };
}

function toCalendarIso(value) {
    const parts = getCalendarParts(value);
    if (!parts) return null;
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Same lease window exactly, or ±1 day (timezone off-by-one on stored dates). */
function isEquivalentLeaseWindow(startA, endA, startB, endB) {
    const isoAStart = toCalendarIso(startA);
    const isoAEnd = toCalendarIso(endA);
    const isoBStart = toCalendarIso(startB);
    const isoBEnd = toCalendarIso(endB);
    if (!isoAStart || !isoAEnd || !isoBStart || !isoBEnd) {
        return { equivalent: false, exact: false };
    }
    if (isoAStart === isoBStart && isoAEnd === isoBEnd) {
        return { equivalent: true, exact: true };
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const dAStart = parseCalendarDate(isoAStart);
    const dBStart = parseCalendarDate(isoBStart);
    const dAEnd = parseCalendarDate(isoAEnd);
    const dBEnd = parseCalendarDate(isoBEnd);
    if (!dAStart || !dBStart || !dAEnd || !dBEnd) {
        return { equivalent: false, exact: false };
    }
    const near =
        Math.abs(dAStart.getTime() - dBStart.getTime()) <= dayMs &&
        Math.abs(dAEnd.getTime() - dBEnd.getTime()) <= dayMs;
    return { equivalent: near, exact: false };
}

module.exports = {
    calendarDateUtc,
    parseSlashDateToIso,
    parseCalendarDate,
    parseUploadCalendarDate,
    parseExcelSerialDate,
    isExcelSerialDate,
    SLASH_DATE_RE,
    getCalendarParts,
    toCalendarIso,
    isEquivalentLeaseWindow
};
