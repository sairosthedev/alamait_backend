/**
 * Room Occupancy Utilities
 * 
 * This module provides utilities for accurately calculating room occupancy
 * by excluding expired, forfeited, and cancelled students/applications.
 */

const Application = require('../models/Application');
const { Residence } = require('../models/Residence');

class RoomOccupancyUtils {

    /**
     * Approved applications whose lease includes `asOf` for this physical room.
     */
    static buildLeaseActiveQuery(residenceId, roomNumber, asOf) {
        return {
            residence: residenceId,
            status: 'approved',
            startDate: { $exists: true, $ne: null, $lte: asOf },
            endDate: { $exists: true, $ne: null, $gte: asOf },
            paymentStatus: { $ne: 'cancelled' },
            $or: [
                { allocatedRoom: roomNumber },
                { 'allocatedRoomDetails.roomNumber': roomNumber }
            ]
        };
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
            const leaseQuery = this.buildLeaseActiveQuery(residenceId, roomNumber, asOf);

            // Primary source: approved applications with lease window covering `asOf`
            const approvedApplications = await Application.find(leaseQuery).lean();
            
            console.log(`📋 Found ${approvedApplications.length} approved applications (lease active on as-of date) for room ${roomNumber}`);
            
            const allOccupants = new Map();

            const addFromApplication = (app) => {
                const sid = app.student && (app.student._id || app.student);
                const key = sid ? String(sid) : (app.email && String(app.email).toLowerCase()) || null;
                if (!key) {
                    return;
                }
                allOccupants.set(key, {
                    id: sid || null,
                    name: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
                    email: app.email,
                    status: app.status,
                    source: 'application',
                    leaseStart: app.startDate,
                    leaseEnd: app.endDate
                });
            };

            approvedApplications.forEach(addFromApplication);

            const validStudents = Array.from(allOccupants.values());

            // Get room details
            const residence = await Residence.findById(residenceId);
            const room = residence?.rooms.find(r => r.roomNumber === roomNumber);
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
