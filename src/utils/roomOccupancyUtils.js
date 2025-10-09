/**
 * Room Occupancy Utilities
 * 
 * This module provides utilities for accurately calculating room occupancy
 * by excluding expired, forfeited, and cancelled students/applications.
 */

const User = require('../models/User');
const Application = require('../models/Application');
const { Residence } = require('../models/Residence');

class RoomOccupancyUtils {
    
    /**
     * Calculate accurate room occupancy excluding expired/forfeited students
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {Date} asOfDate - Date to calculate occupancy as of (optional, defaults to now)
     * @returns {Object} Occupancy details
     */
    static async calculateAccurateRoomOccupancy(residenceId, roomNumber, asOfDate = new Date()) {
        try {
            // Find all approved applications for this room (this is the primary source of truth)
            const approvedApplications = await Application.find({
                residence: residenceId,
                allocatedRoom: roomNumber,
                status: { $in: ['approved', 'active'] }
            });
            
            console.log(`📋 Found ${approvedApplications.length} approved applications for room ${roomNumber}`);
            
            // Also find students in User collection with currentRoom set (for backward compatibility)
            const studentsInRoom = await User.find({
                currentRoom: roomNumber,
                residence: residenceId,
                role: 'student',
                isActive: true,
                status: { $nin: ['forfeited', 'expired', 'cancelled'] }
            });
            
            console.log(`👥 Found ${studentsInRoom.length} students with currentRoom set for room ${roomNumber}`);
            
            // Combine both sources and deduplicate
            const allOccupants = new Map();
            
            // Add approved applications
            approvedApplications.forEach(app => {
                const key = app.email || app.studentId || app.student;
                allOccupants.set(key, {
                    id: app.studentId || app.student,
                    name: `${app.firstName} ${app.lastName}`,
                    email: app.email,
                    status: app.status,
                    source: 'application'
                });
            });
            
            // Add students with currentRoom (if not already counted)
            studentsInRoom.forEach(student => {
                const key = student.email || student._id.toString();
                if (!allOccupants.has(key)) {
                    allOccupants.set(key, {
                        id: student._id,
                        name: `${student.firstName} ${student.lastName}`,
                        email: student.email,
                        status: student.status,
                        source: 'user_currentRoom'
                    });
                }
            });
            
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
                validStudents: validStudents.map(student => ({
                    id: student._id,
                    name: `${student.firstName} ${student.lastName}`,
                    email: student.email,
                    status: student.status
                })),
                calculatedAt: asOfDate
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
            const occupancy = await this.calculateAccurateRoomOccupancy(residenceId, roomNumber);
            
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
