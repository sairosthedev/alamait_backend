/**
 * Map upload sheet room codes to catalog roomNumber for St Kilda Student House.
 */
const ST_KILDA_ROOM_ALIASES = {
    'ext 1': 'Extension 1',
    ext1: 'Extension 1',
    'extension 1': 'Extension 1',
    'ext 2': 'Extension 2',
    ext2: 'Extension 2',
    'extension 2': 'Extension 2',
    'bus 1': 'Bus1',
    bus1: 'Bus1',
    'bus 2': 'Bus2',
    bus2: 'Bus2',
    c1: 'C1',
    c2: 'C2',
    m1: 'M1',
    m2: 'M2',
    m3: 'M3',
    m4: 'M4',
    m5: 'M5',
    m6: 'M6',
    m7: 'M7',
    m8: 'M8'
};

function normalizeRoomKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isStKildaResidence(residence) {
    const name = residence?.name || residence || '';
    return String(name).toLowerCase().includes('st kilda');
}

/**
 * Resolve a pasted/upload room label to the residence catalog roomNumber.
 */
function resolveResidenceRoomAlias(roomInput, residence) {
    if (!roomInput) return roomInput;
    const rooms = residence?.rooms || [];
    const key = normalizeRoomKey(roomInput);
    const compact = key.replace(/\s/g, '');

    const exact = rooms.find((r) => normalizeRoomKey(r.roomNumber) === key);
    if (exact) return exact.roomNumber;

    const exactCompact = rooms.find(
        (r) => normalizeRoomKey(r.roomNumber).replace(/\s/g, '') === compact
    );
    if (exactCompact) return exactCompact.roomNumber;

    if (isStKildaResidence(residence)) {
        const aliased = ST_KILDA_ROOM_ALIASES[key] || ST_KILDA_ROOM_ALIASES[compact];
        if (aliased) {
            const match = rooms.find((r) => r.roomNumber === aliased);
            if (match) return match.roomNumber;
        }
    }

    return String(roomInput).trim();
}

module.exports = {
    ST_KILDA_ROOM_ALIASES,
    resolveResidenceRoomAlias,
    normalizeRoomKey,
    isStKildaResidence
};
