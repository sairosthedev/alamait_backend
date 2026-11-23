/**
 * Room Occupancy Utilities
 * 
 * This module provides utilities for accurately calculating room occupancy
 * by excluding expired, forfeited, and cancelled students/applications.
 */

const Application = require('../models/Application');
const { Residence } = require('../models/Residence');
const {
    resolveResidenceRoomAlias,
    normalizeRoomKey
} = require('./residenceRoomAliases');

/** Application statuses that count toward physical occupancy */
const ACTIVE_LEASE_STATUSES = ['approved', 'allocated', 'active', 'enrolled'];

class RoomOccupancyUtils {

    static buildResidenceScope(residenceId) {
        const id = residenceId != null ? String(residenceId) : '';
        return {
            $or: [
                { residence: residenceId },
                { residenceId },
                { residenceId: id },
                { 'allocatedRoomDetails.residenceId': id }
            ]
        };
    }

    /**
     * Labels that may appear on applications (allocatedRoom) for a catalog room.
     */
    static async collectAllocatedRoomLabels(residenceId, roomNumber) {
        const labels = new Set([String(roomNumber || '').trim()].filter(Boolean));
        const residence = await Residence.findById(residenceId).lean();
        if (!residence) {
            return [...labels];
        }

        const catalogRoom = (residence.rooms || []).find(
            (r) => normalizeRoomKey(r.roomNumber) === normalizeRoomKey(roomNumber)
        );
        if (catalogRoom) {
            labels.add(catalogRoom.roomNumber);
            const resolved = resolveResidenceRoomAlias(catalogRoom.roomNumber, residence);
            if (resolved) labels.add(resolved);
        }

        const resolvedInput = resolveResidenceRoomAlias(roomNumber, residence);
        if (resolvedInput) labels.add(resolvedInput);

        const resName = String(residence.name || '').trim();
        if (resName) {
            labels.add(resName);
            labels.add(`${resName} House`);
        }

        for (const r of residence.rooms || []) {
            const nk = normalizeRoomKey(r.roomNumber);
            for (const l of [...labels]) {
                if (normalizeRoomKey(l) === nk) {
                    labels.add(r.roomNumber);
                }
            }
        }

        return [...labels].filter(Boolean);
    }

    static occupantIdentityKeys(app) {
        const keys = new Set();
        const sid = app.student && (app.student._id || app.student);
        if (sid) {
            keys.add(`student:${String(sid)}`);
        }
        const email = app.email && String(app.email).trim().toLowerCase();
        if (email) {
            keys.add(`email:${email}`);
        }
        if (!keys.size) {
            keys.add(`app:${String(app._id)}`);
        }
        return keys;
    }

    /**
     * One occupant per person — merges duplicate applications (same email or student).
     */
    static dedupeApplicationsToOccupants(applications, mapOccupant) {
        const groups = [];

        const findGroup = (keys) =>
            groups.find((g) => [...keys].some((k) => g.keys.has(k)));

        for (const app of applications) {
            const keys = RoomOccupancyUtils.occupantIdentityKeys(app);
            const occupant = mapOccupant(app);
            let group = findGroup(keys);

            if (!group) {
                group = { keys: new Set(keys), occupant };
                groups.push(group);
                continue;
            }

            keys.forEach((k) => group.keys.add(k));

            const incomingStudent =
                occupant.studentId ||
                (app.student && String(app.student._id || app.student));
            const existingStudent = group.occupant.studentId;

            if (incomingStudent && !existingStudent) {
                group.occupant = { ...group.occupant, ...occupant, id: String(incomingStudent) };
            }
        }

        return groups.map((g) => g.occupant);
    }

    static buildAllocatedRoomOr(labels = []) {
        const list = [...new Set((labels || []).map((l) => String(l).trim()).filter(Boolean))];
        if (!list.length) {
            return { allocatedRoom: { $exists: false } };
        }
        return {
            $or: [
                { allocatedRoom: { $in: list } },
                { preferredRoom: { $in: list } },
                { currentRoom: { $in: list } },
                { 'allocatedRoomDetails.roomNumber': { $in: list } }
            ]
        };
    }

    /**
     * Approved applications whose lease includes `asOf` for this physical room.
     */
    static buildLeaseActiveQuery(residenceId, roomNumber, asOf, allocatedRoomLabels = null) {
        const labels = allocatedRoomLabels || [roomNumber];
        return {
            $and: [
                RoomOccupancyUtils.buildResidenceScope(residenceId),
                { status: { $in: ACTIVE_LEASE_STATUSES } },
                { startDate: { $exists: true, $ne: null, $lte: asOf } },
                { endDate: { $exists: true, $ne: null, $gte: asOf } },
                { paymentStatus: { $ne: 'cancelled' } },
                RoomOccupancyUtils.buildAllocatedRoomOr(labels)
            ]
        };
    }

    /**
     * Approved applications whose lease window overlaps [periodStart, periodEnd].
     */
    static buildLeaseOverlapQuery(
        residenceId,
        roomNumber,
        periodStart,
        periodEnd,
        excludeApplicationId = null,
        allocatedRoomLabels = null
    ) {
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        const labels = allocatedRoomLabels || [roomNumber];
        const clauses = [
            RoomOccupancyUtils.buildResidenceScope(residenceId),
            { status: { $in: ACTIVE_LEASE_STATUSES } },
            { startDate: { $exists: true, $ne: null, $lte: end } },
            { endDate: { $exists: true, $ne: null, $gte: start } },
            { paymentStatus: { $ne: 'cancelled' } },
            RoomOccupancyUtils.buildAllocatedRoomOr(labels)
        ];
        if (excludeApplicationId) {
            clauses.push({ _id: { $ne: excludeApplicationId } });
        }
        return { $and: clauses };
    }

    /**
     * Approved leases overlapping the period, one entry per distinct occupant.
     */
    static async getOverlappingLeasesForPeriod(residenceId, roomNumber, periodStart, periodEnd, excludeApplicationId = null) {
        const labels = await this.collectAllocatedRoomLabels(residenceId, roomNumber);
        const query = this.buildLeaseOverlapQuery(
            residenceId,
            roomNumber,
            periodStart,
            periodEnd,
            excludeApplicationId,
            labels
        );
        const applications = await Application.find(query)
            .select('firstName lastName email student startDate endDate applicationCode')
            .lean();
        return RoomOccupancyUtils.dedupeApplicationsToOccupants(applications, (app) => {
            const sid = app.student && (app.student._id || app.student);
            return {
                type: 'lease',
                name: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
                email: app.email,
                studentId: sid || null,
                startDate: app.startDate,
                endDate: app.endDate,
                applicationCode: app.applicationCode || null,
                applicationId: app._id
            };
        });
    }

    /**
     * Distinct occupants (by student id or email) with an approved lease overlapping the period.
     */
    static async countOverlappingLeasesForPeriod(residenceId, roomNumber, periodStart, periodEnd, excludeApplicationId = null) {
        const leases = await this.getOverlappingLeasesForPeriod(
            residenceId,
            roomNumber,
            periodStart,
            periodEnd,
            excludeApplicationId
        );
        return leases.length;
    }
    
    /**
     * Calculate accurate room occupancy excluding expired/forfeited students
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {Date} asOfDate - Date to calculate occupancy as of (optional, defaults to now)
     * @returns {Object} Occupancy details
     */
    static async calculateAccurateRoomOccupancy(residenceId, roomNumber, asOfDate = new Date()) {
        try {
            const asOf = asOfDate ? new Date(asOfDate) : new Date();
            const labels = await this.collectAllocatedRoomLabels(residenceId, roomNumber);
            const leaseQuery = this.buildLeaseActiveQuery(residenceId, roomNumber, asOf, labels);

            // Primary source: approved applications with lease window covering `asOf`
            const approvedApplications = await Application.find(leaseQuery).lean();
            
            console.log(`📋 Found ${approvedApplications.length} approved applications (lease active on as-of date) for room ${roomNumber}`);
            
            const validStudents = RoomOccupancyUtils.dedupeApplicationsToOccupants(
                approvedApplications,
                (app) => {
                    const sid = app.student && (app.student._id || app.student);
                    return {
                        id: sid ? String(sid) : String(app._id),
                        studentId: sid ? String(sid) : null,
                        applicationId: app._id,
                        name: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
                        email: app.email,
                        status: app.status,
                        source: 'application',
                        leaseStart: app.startDate,
                        leaseEnd: app.endDate
                    };
                }
            );

            // Get room details
            const residence = await Residence.findById(residenceId);
            const room = residence?.rooms.find(
                (r) => normalizeRoomKey(r.roomNumber) === normalizeRoomKey(roomNumber)
            );
            const capacity = room?.capacity || 1;

            return {
                roomNumber,
                residenceId,
                currentOccupancy: validStudents.length,
                capacity,
                occupancyRate: capacity > 0 ? (validStudents.length / capacity) * 100 : 0,
                isFull: validStudents.length >= capacity,
                isAvailable: validStudents.length < capacity,
                validStudents: validStudents.map((s) => ({
                    id: s.id,
                    applicationId: s.applicationId || null,
                    name: s.name,
                    email: s.email,
                    status: s.status,
                    leaseStart: s.leaseStart,
                    leaseEnd: s.leaseEnd,
                    source: s.source
                })),
                calculatedAt: asOf
            };
            
        } catch (error) {
            console.error('Error calculating room occupancy:', error);
            throw error;
        }
    }
    
    /**
     * Residence-level snapshot (same rules as Room Management / admin dashboard occupancy).
     */
    static embeddedRoomStatusSnapshot(rooms = []) {
        const roomList = Array.isArray(rooms) ? rooms : [];
        const rentable = roomList.filter((r) => String(r.status || '').toLowerCase() !== 'maintenance');
        const inUse = rentable.filter((r) => {
            const s = String(r.status || '').toLowerCase();
            return s === 'occupied' || s === 'reserved';
        });
        const totalRooms = rentable.length;
        const storedOccupiedRooms = inUse.length;
        const storedOccupancy =
            totalRooms > 0 ? Math.round((storedOccupiedRooms / totalRooms) * 100) : null;
        return { totalRooms, storedOccupiedRooms, storedOccupancy };
    }

    static async calculateResidenceOccupancySnapshot(residenceId, rooms = [], asOfDate = new Date()) {
        const asOf = asOfDate ? new Date(asOfDate) : new Date();
        const roomList = Array.isArray(rooms) ? rooms : [];
        const rentableRooms = roomList.filter((r) => String(r.status || '').toLowerCase() !== 'maintenance');
        const stored = RoomOccupancyUtils.embeddedRoomStatusSnapshot(rentableRooms);

        let occupiedRooms = 0;
        let totalOccupants = 0;
        let totalCapacity = 0;

        await Promise.all(
            rentableRooms.map(async (room) => {
                const occ = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(
                    residenceId,
                    room.roomNumber,
                    asOf
                );
                const cap = Number(occ.capacity) > 0 ? Number(occ.capacity) : 1;
                const count = Number(occ.currentOccupancy) || 0;
                totalCapacity += cap;
                totalOccupants += count;
                if (count > 0) {
                    occupiedRooms += 1;
                }
            })
        );

        const totalRooms = rentableRooms.length;
        const occupancy =
            totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : null;
        const bedUtilization =
            totalCapacity > 0
                ? Math.min(100, Math.round((totalOccupants / totalCapacity) * 100))
                : null;

        return {
            totalRooms,
            occupiedRooms,
            vacantRooms: Math.max(0, totalRooms - occupiedRooms),
            totalOccupants,
            totalCapacity,
            occupancy,
            bedUtilization,
            storedOccupancy: stored.storedOccupancy,
            storedOccupiedRooms: stored.storedOccupiedRooms
        };
    }

    /**
     * Update room occupancy in residence document
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @returns {Object} Update result
     */
    static async updateRoomOccupancy(residenceId, roomNumber) {
        try {
            const occupancy = await this.calculateAccurateRoomOccupancy(residenceId, roomNumber);
            
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            const room = residence.rooms.find(r => r.roomNumber === roomNumber);
            if (!room) {
                throw new Error('Room not found');
            }
            
            const oldOccupancy = room.currentOccupancy || 0;
            const newOccupancy = occupancy.currentOccupancy;
            
            // Update room occupancy and status
            room.currentOccupancy = newOccupancy;
            
            if (newOccupancy === 0) {
                room.status = 'available';
            } else if (newOccupancy >= occupancy.capacity) {
                room.status = 'occupied';
            } else {
                room.status = 'reserved';
            }
            
            await residence.save();
            
            return {
                success: true,
                roomNumber,
                oldOccupancy,
                newOccupancy,
                capacity: occupancy.capacity,
                status: room.status,
                updated: oldOccupancy !== newOccupancy
            };
            
        } catch (error) {
            console.error('Error updating room occupancy:', error);
            throw error;
        }
    }
    
    /**
     * Sync all room occupancies for a residence
     * @param {string} residenceId - Residence ID
     * @returns {Object} Sync result
     */
    static async syncAllRoomOccupancies(residenceId) {
        try {
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            const results = [];
            let totalUpdated = 0;
            
            for (const room of residence.rooms) {
                try {
                    const result = await this.updateRoomOccupancy(residenceId, room.roomNumber);
                    results.push(result);
                    if (result.updated) {
                        totalUpdated++;
                    }
                } catch (error) {
                    console.error(`Error updating room ${room.roomNumber}:`, error);
                    results.push({
                        success: false,
                        roomNumber: room.roomNumber,
                        error: error.message
                    });
                }
            }
            
            return {
                success: true,
                residenceId,
                totalRooms: residence.rooms.length,
                totalUpdated,
                results
            };
            
        } catch (error) {
            console.error('Error syncing room occupancies:', error);
            throw error;
        }
    }
    
    /**
     * Check if room is available for booking
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {Date} startDate - Booking start date
     * @param {Date} endDate - Booking end date
     * @returns {Object} Availability result
     */
    static async checkRoomAvailability(residenceId, roomNumber, startDate, endDate) {
        try {
            const asOf = startDate ? new Date(startDate) : new Date();
            const occupancy = await this.calculateAccurateRoomOccupancy(residenceId, roomNumber, asOf);
            
            return {
                available: occupancy.isAvailable,
                currentOccupancy: occupancy.currentOccupancy,
                capacity: occupancy.capacity,
                occupancyRate: occupancy.occupancyRate,
                canAccommodate: occupancy.currentOccupancy < occupancy.capacity,
                message: occupancy.isAvailable 
                    ? `Room has ${occupancy.capacity - occupancy.currentOccupancy} available spots`
                    : `Room is at full capacity (${occupancy.currentOccupancy}/${occupancy.capacity})`
            };
            
        } catch (error) {
            console.error('Error checking room availability:', error);
            throw error;
        }
    }
}

module.exports = RoomOccupancyUtils;
