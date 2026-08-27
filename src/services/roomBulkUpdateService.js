const { Residence } = require('../models/Residence');
const RoomUpdateService = require('./roomUpdateService');

function findRoomIndex(rooms, roomNumber) {
    const key = String(roomNumber || '').trim();
    let idx = rooms.findIndex((r) => r.roomNumber === key);
    if (idx >= 0) return idx;
    const lower = key.toLowerCase();
    idx = rooms.findIndex((r) => String(r.roomNumber || '').trim().toLowerCase() === lower);
    return idx;
}

class RoomBulkUpdateService {
    /**
     * Preview or apply bulk room name/price updates for a residence.
     * @param {string} residenceId
     * @param {Array<{roomNumber, newRoomNumber?, price?}>} rows
     * @param {{ dryRun?: boolean, cascade?: boolean }} options
     */
    static async bulkUpdateRooms(residenceId, rows, options = {}) {
        const dryRun = options.dryRun === true;
        const cascade = options.cascade !== false;

        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return { success: false, message: 'Residence not found' };
        }

        if (!rows?.length) {
            return { success: false, message: 'No room rows to process' };
        }

        const results = {
            success: true,
            dryRun,
            residence: { id: residence._id.toString(), name: residence.name },
            summary: { total: rows.length, updated: 0, skipped: 0, failed: 0 },
            details: { updated: [], skipped: [], failed: [] }
        };

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
                    error: 'Provide price and/or newRoomNumber to update',
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

            const roomIndex = findRoomIndex(residence.rooms, roomNumber);
            if (roomIndex === -1) {
                results.details.failed.push({
                    line: lineNum,
                    roomNumber,
                    error: `Room "${roomNumber}" not found in ${residence.name}`,
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
                continue;
            }

            const changePreview = {
                line: lineNum,
                roomNumber: oldRoom.roomNumber,
                newRoomNumber: nameChanged ? newRoomNumber : undefined,
                oldPrice: oldRoom.price,
                newPrice: priceChanged ? newPrice : undefined
            };

            if (dryRun) {
                results.details.updated.push({ ...changePreview, dryRun: true });
                results.summary.updated++;
                continue;
            }

            try {
                residence.rooms[roomIndex].roomNumber = targetName;
                if (priceChanged) {
                    residence.rooms[roomIndex].price = newPrice;
                }

                await residence.save();

                let cascadeUpdate = null;
                let cascadeDetails = null;

                if (cascade && nameChanged) {
                    cascadeUpdate = await RoomUpdateService.cascadeUpdateRoomNumber(
                        residenceId,
                        oldRoom.roomNumber,
                        newRoomNumber
                    );
                }

                if (cascade && (priceChanged || nameChanged)) {
                    const updatedRoomData = residence.rooms[roomIndex].toObject();
                    cascadeDetails = await RoomUpdateService.cascadeUpdateRoomDetails(
                        residenceId,
                        targetName,
                        updatedRoomData,
                        oldRoom
                    );
                }

                results.details.updated.push({
                    ...changePreview,
                    cascadeUpdate,
                    cascadeDetailsUpdate: cascadeDetails
                });
                results.summary.updated++;
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

        return results;
    }
}

module.exports = RoomBulkUpdateService;
