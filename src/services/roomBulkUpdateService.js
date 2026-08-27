const { Residence } = require('../models/Residence');
const Application = require('../models/Application');
const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');
const RoomUpdateService = require('./roomUpdateService');

function findRoomIndex(rooms, roomNumber) {
    const key = String(roomNumber || '').trim();
    let idx = rooms.findIndex((r) => r.roomNumber === key);
    if (idx >= 0) return idx;
    const lower = key.toLowerCase();
    idx = rooms.findIndex((r) => String(r.roomNumber || '').trim().toLowerCase() === lower);
    return idx;
}

/** Belvedere-style codes (MR8B3L, CR1CB, EXH2B2, BHM1) vs type labels (Single, 2). */
function looksLikeRoomCode(value) {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/^(single|double|triple|quad|shared| ensuite)$/i.test(s)) return false;
    if (/^\d+$/.test(s)) return false;
    return /^[A-Z]{1,5}\d*[A-Z0-9]*$/i.test(s) || /^[A-Z]+\d+[A-Z]*$/i.test(s);
}

function addInputFromRow(input, newRoomNumber) {
    const extra = { ...input };
    if (newRoomNumber && !looksLikeRoomCode(newRoomNumber)) {
        extra.type = String(newRoomNumber).trim().toLowerCase();
    }
    return extra;
}

function defaultNewRoom(roomNumber, price, input = {}) {
    return {
        roomNumber,
        type: input.type || 'single',
        capacity: parseInt(input.capacity, 10) || 1,
        price: price != null ? Number(price) : 0,
        status: input.status || 'available',
        currentOccupancy: 0,
        features: input.features || [],
        amenities: input.amenities || [],
        floor: parseInt(input.floor, 10) || 1,
        area: parseFloat(input.area) || 20,
        images: input.images || [],
        cleaningFrequency: input.cleaningFrequency || 'weekly'
    };
}

async function getRoomRemovalBlocker(residenceId, room) {
    const occupancy = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(
        residenceId,
        room.roomNumber
    );

    if (occupancy.currentOccupancy > 0) {
        const tenants = occupancy.validStudents
            .map((s) => {
                const end = s.leaseEnd ? new Date(s.leaseEnd).toISOString().slice(0, 10) : '?';
                return `${s.name || 'tenant'} (lease to ${end})`;
            })
            .join(', ');
        return `active lease as of today — ${tenants}`;
    }

    return null;
}

async function getRoomRemovalWarning(residenceId, roomNumber) {
    const tenantCount = await Application.countDocuments({
        residence: residenceId,
        status: { $in: ['approved', 'expired'] },
        paymentStatus: { $ne: 'cancelled' },
        $or: [
            { allocatedRoom: roomNumber },
            { 'allocatedRoomDetails.roomNumber': roomNumber }
        ]
    });

    if (tenantCount > 0) {
        return `${tenantCount} historical tenant record(s) still reference this room code`;
    }
    return null;
}

/** Last row wins; duplicate room codes in one upload are merged. */
function dedupeRoomRows(rows) {
    const duplicates = [];
    const byRoom = new Map();

    rows.forEach((row, index) => {
        const roomNumber = String(row.roomNumber || '').trim();
        if (!roomNumber) return;

        const line = index + 1;
        if (byRoom.has(roomNumber)) {
            const kept = byRoom.get(roomNumber);
            duplicates.push({
                roomNumber,
                keptLine: line,
                ignoredLine: kept.line,
                keptPrice: row.price != null ? Number(row.price) : kept.price,
                ignoredPrice: kept.price
            });
        }
        byRoom.set(roomNumber, {
            ...row,
            roomNumber,
            line,
            price: row.price != null ? Number(row.price) : null
        });
    });

    const deduped = [...byRoom.values()].map(({ line, ...row }) => row);
    const warnings = duplicates.map((d) => ({
        roomNumber: d.roomNumber,
        action: 'duplicate_merged',
        warning: `Duplicate "${d.roomNumber}" — kept line ${d.keptLine}${d.keptPrice != null ? ` ($${d.keptPrice})` : ''}, ignored line ${d.ignoredLine}${d.ignoredPrice != null ? ` ($${d.ignoredPrice})` : ''}`
    }));

    return { deduped, duplicates, warnings, duplicateCount: duplicates.length };
}

class RoomBulkUpdateService {
    /**
     * Bulk upsert room names and/or prices for a residence.
     * @param {string} residenceId
     * @param {Array<{roomNumber, newRoomNumber?, price?}>} rows
     * @param {{ dryRun?: boolean, cascade?: boolean, createMissing?: boolean, replace?: boolean }} options
     */
    static async bulkUpdateRooms(residenceId, rows, options = {}) {
        const dryRun = options.dryRun === true;
        const cascade = options.cascade !== false;
        const replace = options.replace === true;
        const createMissing = replace || options.createMissing !== false;

        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return { success: false, message: 'Residence not found' };
        }

        if (!rows?.length) {
            return { success: false, message: 'No room rows to process' };
        }

        const inputRowCount = rows.length;
        const { deduped, duplicates, warnings: dedupeWarnings, duplicateCount } = dedupeRoomRows(rows);
        rows = deduped;

        const results = {
            success: true,
            dryRun,
            replace,
            createMissing,
            residence: { id: residence._id.toString(), name: residence.name },
            summary: {
                total: rows.length,
                inputRows: inputRowCount,
                duplicatesMerged: duplicateCount,
                added: 0,
                updated: 0,
                removed: 0,
                skipped: 0,
                failed: 0
            },
            details: {
                added: [],
                updated: [],
                removed: [],
                skipped: [],
                failed: [],
                duplicates,
                warnings: [...dedupeWarnings]
            }
        };

        const cascadeJobs = [];
        const targetRoomNumbers = new Set();
        let dirty = false;

        for (let i = 0; i < rows.length; i++) {
            const input = rows[i];
            const lineNum = i + 1;
            const roomNumber = String(input.roomNumber || '').trim();
            const newRoomNumber = input.newRoomNumber
                ? String(input.newRoomNumber).trim()
                : null;
            const price = input.price != null ? Number(input.price) : null;

            if (!roomNumber) {
                results.details.failed.push({
                    line: lineNum,
                    error: 'roomNumber is required',
                    input
                });
                results.summary.failed++;
                continue;
            }

            if (price == null && !newRoomNumber) {
                results.details.failed.push({
                    line: lineNum,
                    roomNumber,
                    error: 'Provide price and/or newRoomNumber',
                    input
                });
                results.summary.failed++;
                continue;
            }

            if (price != null && (Number.isNaN(price) || price < 0)) {
                results.details.failed.push({
                    line: lineNum,
                    roomNumber,
                    error: 'Invalid price',
                    input
                });
                results.summary.failed++;
                continue;
            }

            let roomIndex = findRoomIndex(residence.rooms, roomNumber);

            // New room code (not in residence yet) — upsert / replace catalog
            if (roomIndex === -1 && createMissing) {
                const renameAttempt = newRoomNumber
                    && looksLikeRoomCode(roomNumber)
                    && looksLikeRoomCode(newRoomNumber);

                if (renameAttempt) {
                    results.details.failed.push({
                        line: lineNum,
                        roomNumber,
                        newRoomNumber,
                        error: `Cannot rename "${roomNumber}" — room not found in ${residence.name}`,
                        input
                    });
                    results.summary.failed++;
                    continue;
                }

                const targetName = roomNumber;
                const clash = residence.rooms.some((r) => r.roomNumber === targetName);
                if (clash) {
                    results.details.failed.push({
                        line: lineNum,
                        roomNumber,
                        error: `Room "${targetName}" already exists`,
                        input
                    });
                    results.summary.failed++;
                    continue;
                }

                const roomInput = addInputFromRow(input, newRoomNumber);
                const preview = {
                    line: lineNum,
                    roomNumber: targetName,
                    newPrice: price != null ? price : 0,
                    action: 'add'
                };

                if (dryRun) {
                    results.details.added.push({ ...preview, dryRun: true });
                    results.summary.added++;
                    targetRoomNumbers.add(targetName);
                    continue;
                }

                residence.rooms.push(defaultNewRoom(targetName, price, roomInput));
                dirty = true;
                results.details.added.push(preview);
                results.summary.added++;
                targetRoomNumbers.add(targetName);
                continue;
            }

            if (roomIndex === -1) {
                results.details.failed.push({
                    line: lineNum,
                    roomNumber,
                    error: `Room "${roomNumber}" not found in ${residence.name}. Use upsert mode (default) to add new rooms.`,
                    input
                });
                results.summary.failed++;
                continue;
            }

            const oldRoom = residence.rooms[roomIndex].toObject();
            const targetName = newRoomNumber || oldRoom.roomNumber;

            if (newRoomNumber && newRoomNumber !== oldRoom.roomNumber) {
                const clash = residence.rooms.some(
                    (r, idx) => idx !== roomIndex && r.roomNumber === newRoomNumber
                );
                if (clash) {
                    results.details.failed.push({
                        line: lineNum,
                        roomNumber,
                        newRoomNumber,
                        error: `Room name "${newRoomNumber}" already exists`,
                        input
                    });
                    results.summary.failed++;
                    continue;
                }
            }

            const newPrice = price != null ? price : oldRoom.price;
            const priceChanged = price != null && Math.abs(price - oldRoom.price) > 0.001;
            const nameChanged = newRoomNumber && newRoomNumber !== oldRoom.roomNumber;

            if (!priceChanged && !nameChanged) {
                results.details.skipped.push({
                    line: lineNum,
                    roomNumber,
                    reason: 'No changes (same name and price)',
                    input
                });
                results.summary.skipped++;
                targetRoomNumbers.add(oldRoom.roomNumber);
                continue;
            }

            const changePreview = {
                line: lineNum,
                roomNumber: oldRoom.roomNumber,
                newRoomNumber: nameChanged ? newRoomNumber : undefined,
                oldPrice: oldRoom.price,
                newPrice: priceChanged ? newPrice : undefined,
                action: 'update'
            };

            if (dryRun) {
                results.details.updated.push({ ...changePreview, dryRun: true });
                results.summary.updated++;
                targetRoomNumbers.add(targetName);
                continue;
            }

            try {
                residence.rooms[roomIndex].roomNumber = targetName;
                if (priceChanged) {
                    residence.rooms[roomIndex].price = newPrice;
                }
                dirty = true;

                if (cascade && nameChanged) {
                    cascadeJobs.push({
                        oldRoomNumber: oldRoom.roomNumber,
                        newRoomNumber,
                        updatedRoomData: { ...oldRoom, roomNumber: targetName, price: newPrice },
                        oldRoomData: oldRoom
                    });
                } else if (cascade && priceChanged) {
                    cascadeJobs.push({
                        oldRoomNumber: targetName,
                        newRoomNumber: null,
                        updatedRoomData: { ...oldRoom, roomNumber: targetName, price: newPrice },
                        oldRoomData: oldRoom,
                        priceOnly: true
                    });
                }

                results.details.updated.push(changePreview);
                results.summary.updated++;
                targetRoomNumbers.add(targetName);
            } catch (err) {
                results.details.failed.push({
                    line: lineNum,
                    roomNumber,
                    error: err.message,
                    input
                });
                results.summary.failed++;
            }
        }

        if (replace) {
            const roomsToRemove = residence.rooms.filter(
                (room) => !targetRoomNumbers.has(room.roomNumber)
            );

            for (const room of roomsToRemove) {
                const blocker = await getRoomRemovalBlocker(residenceId, room);
                if (blocker) {
                    results.details.failed.push({
                        roomNumber: room.roomNumber,
                        action: 'remove',
                        error: `Cannot remove "${room.roomNumber}" — ${blocker}`,
                        input: { roomNumber: room.roomNumber }
                    });
                    results.summary.failed++;
                    continue;
                }

                const preview = {
                    roomNumber: room.roomNumber,
                    oldPrice: room.price,
                    action: 'remove'
                };

                const warning = await getRoomRemovalWarning(residenceId, room.roomNumber);
                if (warning) {
                    results.details.warnings.push({
                        roomNumber: room.roomNumber,
                        action: 'remove',
                        warning
                    });
                    preview.warning = warning;
                }

                if (dryRun) {
                    results.details.removed.push({ ...preview, dryRun: true });
                    results.summary.removed++;
                    continue;
                }

                residence.rooms = residence.rooms.filter(
                    (r) => r.roomNumber !== room.roomNumber
                );
                dirty = true;
                results.details.removed.push(preview);
                results.summary.removed++;
            }
        }

        if (!dryRun && dirty) {
            await residence.save();
        }

        for (const job of cascadeJobs) {
            try {
                if (job.newRoomNumber) {
                    await RoomUpdateService.cascadeUpdateRoomNumber(
                        residenceId,
                        job.oldRoomNumber,
                        job.newRoomNumber
                    );
                }
                await RoomUpdateService.cascadeUpdateRoomDetails(
                    residenceId,
                    job.newRoomNumber || job.oldRoomNumber,
                    job.updatedRoomData,
                    job.oldRoomData
                );
            } catch (err) {
                console.error('Cascade after bulk room update:', err.message);
            }
        }

        return results;
    }
}

module.exports = RoomBulkUpdateService;
