/**
 * Calendar-date helpers for lease/rent dates.
 * Store and read YYYY-MM-DD without timezone shifting the month/day.
 */

/** Africa/Harare — uploads are authored in UTC+2 */
const UPLOAD_TZ_OFFSET_MS = 2 * 60 * 60 * 1000;

function calendarDateUtc(y, m, d) {
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0));
}

/** Map an instant to a calendar day in the upload timezone (Harare). */
function calendarDateFromInstant(instant) {
    const shifted = new Date(instant.getTime() + UPLOAD_TZ_OFFSET_MS);
    return calendarDateUtc(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth() + 1,
        shifted.getUTCDate()
    );
}

/**
 * Frontend date pickers often do:
 *   new Date(y, m - 1, d).toISOString().slice(0, 10)
 * which is one day earlier than the picked day in UTC+2.
 */
function localMidnightIsoStrip(y, m, d) {
    return new Date(y, m - 1, d).toISOString().slice(0, 10);
}

/** Harare-local midnight for calendar day (y,m,d) → UTC YYYY-MM-DD string (server-TZ independent). */
function harareLocalMidnightIsoStrip(y, m, d) {
    const utcInstantMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - UPLOAD_TZ_OFFSET_MS;
    return new Date(utcInstantMs).toISOString().slice(0, 10);
}

function recoverBareIsoFromFrontendStrip(str) {
    const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
    if (!bare) return null;
    const y = Number(bare[1]);
    const m = Number(bare[2]);
    const d = Number(bare[3]);
    const trimmed = String(str).trim();

    const stripNext = harareLocalMidnightIsoStrip(y, m, d + 1);
    const stripSame = harareLocalMidnightIsoStrip(y, m, d);
    const literalNext = `${y}-${String(m).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
    // Picker sends strip(nextDay) which is one day earlier in YYYY-MM-DD than the picked day
    if (stripNext === trimmed && stripSame !== trimmed && trimmed < literalNext) {
        return calendarDateUtc(y, m, d + 1);
    }
    return calendarDateUtc(y, m, d);
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
        return calendarDateFromInstant(value);
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
            return calendarDateFromInstant(instant);
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
function parseUploadCalendarDate(value, role = 'start', options = {}) {
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
        // YYYY-MM-DD from paste/spreadsheet is the calendar date — never shift it
        if (options.trustLiteralBareIso !== false) {
            return calendarDateUtc(Number(bare[1]), Number(bare[2]), Number(bare[3]));
        }
        return recoverBareIsoFromFrontendStrip(str);
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

/** ISO datetime at UTC noon — safe for JSON APIs (avoids US TZ showing previous day on date-only strings). */
function toApiCalendarIso(value) {
    const iso = toCalendarIso(value);
    return iso ? `${iso}T12:00:00.000Z` : null;
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
    calendarDateFromInstant,
    recoverBareIsoFromFrontendStrip,
    localMidnightIsoStrip,
    harareLocalMidnightIsoStrip,
    parseSlashDateToIso,
    parseCalendarDate,
    parseUploadCalendarDate,
    parseExcelSerialDate,
    isExcelSerialDate,
    SLASH_DATE_RE,
    getCalendarParts,
    toCalendarIso,
    toApiCalendarIso,
    isEquivalentLeaseWindow
};
