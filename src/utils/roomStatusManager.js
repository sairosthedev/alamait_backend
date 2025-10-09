/**
 * Room Status Manager
 * 
 * This module handles automatic room occupancy updates when student applications
 * change status to expired, forfeited, or cancelled.
 */

const { Residence } = require('../models/Residence');
const Application = require('../models/Application');
const User = require('../models/User');

class RoomStatusManager {
    
    /**
     * Update room occupancy when application status changes
     * @param {string} applicationId - Application ID
     * @param {string} newStatus - New application status
     * @param {string} reason - Reason for status change
     * @returns {Object} Update result
     */
    static async updateRoomOnStatusChange(applicationId, newStatus, reason = '') {
        try {
            console.log(`🏠 Updating room occupancy for application ${applicationId} - Status: ${newStatus}`);
            
            // Find the application
            const application = await Application.findById(applicationId);
            if (!application) {
                console.log('⚠️ Application not found:', applicationId);
                return { success: false, message: 'Application not found' };
            }
            
            // Check if this is a status change that should free up the room
            const shouldFreeRoom = ['expired', 'forfeited', 'cancelled', 'rejected'].includes(newStatus);
            
            if (shouldFreeRoom && application.allocatedRoom && application.residence) {
                const result = await this.decrementRoomOccupancy(
                    application.residence, 
                    application.allocatedRoom, 
                    applicationId,
                    reason
                );
                
                console.log(`✅ Room occupancy updated for application ${applicationId}:`, result);
                return result;
            } else {
                console.log(`ℹ️ No room to free for application ${applicationId} (status: ${newStatus})`);
                return { success: true, message: 'No room to free for this status change' };
            }
            
        } catch (error) {
            console.error('❌ Error updating room on status change:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Decrement room occupancy
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {string} applicationId - Application ID (for logging)
     * @param {string} reason - Reason for decrement
     * @returns {Object} Decrement result
     */
    static async decrementRoomOccupancy(residenceId, roomNumber, applicationId, reason = '') {
        try {
            console.log(`📉 Decrementing room occupancy: ${roomNumber} in residence ${residenceId}`);
            
            // Find the residence
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                console.log('⚠️ Residence not found:', residenceId);
                return { success: false, message: 'Residence not found' };
            }
            
            // Find the room within the residence
            const room = residence.rooms.find(r => r.roomNumber === roomNumber);
            if (!room) {
                console.log('⚠️ Room not found in residence:', roomNumber);
                return { success: false, message: 'Room not found' };
            }
            
            const oldOccupancy = room.currentOccupancy || 0;
            const newOccupancy = Math.max(0, oldOccupancy - 1);
            
            // Update room occupancy and status
            room.currentOccupancy = newOccupancy;
            
            if (newOccupancy === 0) {
                room.status = 'available';
            } else if (newOccupancy < (room.capacity || 1)) {
                room.status = 'reserved';
            } else {
                room.status = 'occupied';
            }
            
            // Save the residence
            await residence.save();
            
            const result = {
                success: true,
                roomNumber: roomNumber,
                residenceId: residenceId,
                oldOccupancy: oldOccupancy,
                newOccupancy: newOccupancy,
                newStatus: room.status,
                capacity: room.capacity || 1,
                reason: reason,
                applicationId: applicationId,
                updated: oldOccupancy !== newOccupancy
            };
            
            console.log(`✅ Room ${roomNumber} occupancy updated: ${oldOccupancy} → ${newOccupancy} (${room.status})`);
            return result;
            
        } catch (error) {
            console.error('❌ Error decrementing room occupancy:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Increment room occupancy (for new allocations)
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {string} applicationId - Application ID (for logging)
     * @param {string} reason - Reason for increment
     * @returns {Object} Increment result
     */
    static async incrementRoomOccupancy(residenceId, roomNumber, applicationId, reason = '') {
        try {
            console.log(`📈 Incrementing room occupancy: ${roomNumber} in residence ${residenceId}`);
            
            // Find the residence
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                console.log('⚠️ Residence not found:', residenceId);
                return { success: false, message: 'Residence not found' };
            }
            
            // Find the room within the residence
            const room = residence.rooms.find(r => r.roomNumber === roomNumber);
            if (!room) {
                console.log('⚠️ Room not found in residence:', roomNumber);
                return { success: false, message: 'Room not found' };
            }
            
            const oldOccupancy = room.currentOccupancy || 0;
            const capacity = room.capacity || 1;
            const newOccupancy = Math.min(capacity, oldOccupancy + 1);
            
            // Update room occupancy and status
            room.currentOccupancy = newOccupancy;
            
            if (newOccupancy === 0) {
                room.status = 'available';
            } else if (newOccupancy >= capacity) {
                room.status = 'occupied';
            } else {
                room.status = 'reserved';
            }
            
            // Save the residence
            await residence.save();
            
            const result = {
                success: true,
                roomNumber: roomNumber,
                residenceId: residenceId,
                oldOccupancy: oldOccupancy,
                newOccupancy: newOccupancy,
                newStatus: room.status,
                capacity: capacity,
                reason: reason,
                applicationId: applicationId,
                updated: oldOccupancy !== newOccupancy
            };
            
            console.log(`✅ Room ${roomNumber} occupancy updated: ${oldOccupancy} → ${newOccupancy} (${room.status})`);
            return result;
            
        } catch (error) {
            console.error('❌ Error incrementing room occupancy:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sync room occupancy for all applications
     * @param {string} residenceId - Optional residence ID to limit sync
     * @returns {Object} Sync result
     */
    static async syncAllRoomOccupancy(residenceId = null) {
        try {
            console.log('🔄 Syncing room occupancy for all applications...');
            
            // Find all applications with allocated rooms
            const query = {
                allocatedRoom: { $exists: true, $ne: null },
                status: { $in: ['approved', 'active'] }
            };
            
            if (residenceId) {
                query.residence = residenceId;
            }
            
            const applications = await Application.find(query);
            console.log(`Found ${applications.length} applications with allocated rooms`);
            
            // Group by residence and room
            const roomAllocations = {};
            
            applications.forEach(app => {
                const key = `${app.residence}-${app.allocatedRoom}`;
                if (!roomAllocations[key]) {
                    roomAllocations[key] = {
                        residenceId: app.residence,
                        roomNumber: app.allocatedRoom,
                        count: 0,
                        applications: []
                    };
                }
                roomAllocations[key].count++;
                roomAllocations[key].applications.push(app._id);
            });
            
            console.log(`Found ${Object.keys(roomAllocations).length} unique room allocations`);
            
            // Update each room's occupancy
            const results = [];
            for (const [key, allocation] of Object.entries(roomAllocations)) {
                try {
                    const residence = await Residence.findById(allocation.residenceId);
                    if (residence) {
                        const room = residence.rooms.find(r => r.roomNumber === allocation.roomNumber);
                        if (room) {
                            const oldOccupancy = room.currentOccupancy || 0;
                            const newOccupancy = allocation.count;
                            
                            room.currentOccupancy = newOccupancy;
                            
                            if (newOccupancy === 0) {
                                room.status = 'available';
                            } else if (newOccupancy >= (room.capacity || 1)) {
                                room.status = 'occupied';
                            } else {
                                room.status = 'reserved';
                            }
                            
                            await residence.save();
                            
                            results.push({
                                roomNumber: allocation.roomNumber,
                                residenceId: allocation.residenceId,
                                oldOccupancy: oldOccupancy,
                                newOccupancy: newOccupancy,
                                newStatus: room.status,
                                applicationCount: allocation.count,
                                updated: oldOccupancy !== newOccupancy
                            });
                            
                            if (oldOccupancy !== newOccupancy) {
                                console.log(`✅ Room ${allocation.roomNumber}: ${oldOccupancy} → ${newOccupancy} (${room.status})`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error syncing room ${allocation.roomNumber}:`, error);
                    results.push({
                        roomNumber: allocation.roomNumber,
                        residenceId: allocation.residenceId,
                        error: error.message
                    });
                }
            }
            
            const updatedRooms = results.filter(r => r.updated).length;
            
            return {
                success: true,
                totalRooms: results.length,
                updatedRooms: updatedRooms,
                results: results
            };
            
        } catch (error) {
            console.error('❌ Error syncing room occupancy:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RoomStatusManager;


