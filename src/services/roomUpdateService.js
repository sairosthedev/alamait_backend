/**
 * Service to handle cascade updates when room number changes
 * Updates all related documents that reference the room number
 */

const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Application = require('../models/Application');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Maintenance = require('../models/Maintenance');
const Debtor = require('../models/Debtor');
const Payment = require('../models/Payment');

class RoomUpdateService {
    /**
     * Update room number in all related documents when room name changes
     * @param {string} residenceId - Residence ID
     * @param {string} oldRoomNumber - Old room number
     * @param {string} newRoomNumber - New room number
     * @returns {Object} Update summary
     */
    static async cascadeUpdateRoomNumber(residenceId, oldRoomNumber, newRoomNumber) {
        const updateSummary = {
            residenceId: residenceId.toString(),
            oldRoomNumber,
            newRoomNumber,
            updated: {
                bookings: 0,
                applications: 0,
                users: 0,
                invoices: 0,
                maintenance: 0,
                debtors: 0,
                payments: 0
            },
            errors: []
        };

        try {
            console.log(`🔄 Cascading room number update: ${oldRoomNumber} → ${newRoomNumber} in residence ${residenceId}`);

            // 1. Update Bookings
            try {
                const bookingResult = await Booking.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        'room.roomNumber': oldRoomNumber
                    },
                    {
                        $set: {
                            'room.roomNumber': newRoomNumber
                        }
                    }
                );
                updateSummary.updated.bookings = bookingResult.modifiedCount;
                console.log(`   ✅ Updated ${bookingResult.modifiedCount} bookings`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Booking', error: error.message });
                console.error(`   ❌ Error updating bookings:`, error.message);
            }

            // 2. Update Applications
            try {
                const applicationResult = await Application.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        $or: [
                            { allocatedRoom: oldRoomNumber },
                            { preferredRoom: oldRoomNumber },
                            { currentRoom: oldRoomNumber },
                            { waitlistedRoom: oldRoomNumber },
                            { 'allocatedRoomDetails.roomNumber': oldRoomNumber }
                        ]
                    },
                    {
                        $set: {
                            'allocatedRoom': newRoomNumber,
                            'preferredRoom': newRoomNumber,
                            'currentRoom': newRoomNumber,
                            'waitlistedRoom': newRoomNumber,
                            'allocatedRoomDetails.roomNumber': newRoomNumber
                        }
                    }
                );
                updateSummary.updated.applications = applicationResult.modifiedCount;
                console.log(`   ✅ Updated ${applicationResult.modifiedCount} applications`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Application', error: error.message });
                console.error(`   ❌ Error updating applications:`, error.message);
            }

            // 3. Update Users (currentRoom and waitlistedRoom)
            try {
                // Find users with this room in the residence
                const residence = await mongoose.model('Residence').findById(residenceId).select('_id').lean();
                if (residence) {
                    const userResult = await User.updateMany(
                        {
                            residence: new mongoose.Types.ObjectId(residenceId),
                            $or: [
                                { currentRoom: oldRoomNumber },
                                { waitlistedRoom: oldRoomNumber }
                            ]
                        },
                        {
                            $set: {
                                currentRoom: newRoomNumber,
                                waitlistedRoom: newRoomNumber
                            }
                        }
                    );
                    updateSummary.updated.users = userResult.modifiedCount;
                    console.log(`   ✅ Updated ${userResult.modifiedCount} users`);
                }
            } catch (error) {
                updateSummary.errors.push({ collection: 'User', error: error.message });
                console.error(`   ❌ Error updating users:`, error.message);
            }

            // 4. Update Invoices
            try {
                const invoiceResult = await Invoice.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        room: oldRoomNumber
                    },
                    {
                        $set: {
                            room: newRoomNumber
                        }
                    }
                );
                updateSummary.updated.invoices = invoiceResult.modifiedCount;
                console.log(`   ✅ Updated ${invoiceResult.modifiedCount} invoices`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Invoice', error: error.message });
                console.error(`   ❌ Error updating invoices:`, error.message);
            }

            // 5. Update Maintenance Requests
            try {
                const maintenanceResult = await Maintenance.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        room: oldRoomNumber
                    },
                    {
                        $set: {
                            room: newRoomNumber
                        }
                    }
                );
                updateSummary.updated.maintenance = maintenanceResult.modifiedCount;
                console.log(`   ✅ Updated ${maintenanceResult.modifiedCount} maintenance requests`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Maintenance', error: error.message });
                console.error(`   ❌ Error updating maintenance:`, error.message);
            }

            // 6. Update Debtors
            try {
                const debtorResult = await Debtor.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        roomNumber: oldRoomNumber
                    },
                    {
                        $set: {
                            roomNumber: newRoomNumber
                        }
                    }
                );
                updateSummary.updated.debtors = debtorResult.modifiedCount;
                console.log(`   ✅ Updated ${debtorResult.modifiedCount} debtors`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Debtor', error: error.message });
                console.error(`   ❌ Error updating debtors:`, error.message);
            }

            // 7. Update Payments
            try {
                const paymentResult = await Payment.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        room: oldRoomNumber
                    },
                    {
                        $set: {
                            room: newRoomNumber
                        }
                    }
                );
                updateSummary.updated.payments = paymentResult.modifiedCount;
                console.log(`   ✅ Updated ${paymentResult.modifiedCount} payments`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Payment', error: error.message });
                console.error(`   ❌ Error updating payments:`, error.message);
            }

            const totalUpdated = Object.values(updateSummary.updated).reduce((sum, count) => sum + count, 0);
            console.log(`✅ Cascade update complete: ${totalUpdated} documents updated`);
            
            updateSummary.success = true;
            updateSummary.totalUpdated = totalUpdated;

        } catch (error) {
            console.error('❌ Error in cascade room number update:', error);
            updateSummary.success = false;
            updateSummary.errors.push({ general: error.message });
        }

        return updateSummary;
    }

    /**
     * 🆕 Update room price and details in all related documents when room price or details change
     * @param {string} residenceId - Residence ID
     * @param {string} roomNumber - Room number
     * @param {Object} roomUpdates - Updated room data (price, type, etc.)
     * @param {Object} oldRoomData - Old room data for comparison
     * @returns {Object} Update summary
     */
    static async cascadeUpdateRoomDetails(residenceId, roomNumber, roomUpdates, oldRoomData) {
        const updateSummary = {
            residenceId: residenceId.toString(),
            roomNumber,
            updated: {
                applications: 0,
                debtors: 0,
                users: 0
            },
            priceChange: {
                oldPrice: oldRoomData?.price || null,
                newPrice: roomUpdates?.price || null,
                effectiveNextMonth: null
            },
            errors: []
        };

        try {
            console.log(`🔄 Cascading room details update for room ${roomNumber} in residence ${residenceId}`);
            
            // Fetch residence once to get updated room details
            const Residence = require('../models/Residence');
            const residence = await Residence.findById(residenceId);
            const finalRoomNumber = roomUpdates.roomNumber || roomNumber;
            const updatedRoom = residence?.rooms?.find(r => 
                r.roomNumber === finalRoomNumber
            );
            
            // Calculate effective date for price changes (next month)
            let effectiveDate = null;
            if (roomUpdates.price !== undefined && roomUpdates.price !== oldRoomData?.price) {
                const now = new Date();
                effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // First day of next month
                updateSummary.priceChange.effectiveNextMonth = effectiveDate.toISOString().split('T')[0];
                console.log(`   💰 Price change detected: $${oldRoomData?.price || 'N/A'} → $${roomUpdates.price}`);
                console.log(`   📅 Price change effective: ${updateSummary.priceChange.effectiveNextMonth}`);
            }

            // 1. Update Applications - Update allocatedRoomDetails with new price and room info
            try {
                
                const applicationUpdate = {};
                
                // Always update price, type, capacity if provided
                if (roomUpdates.price !== undefined) {
                    applicationUpdate['allocatedRoomDetails.price'] = roomUpdates.price;
                }
                if (roomUpdates.type !== undefined) {
                    applicationUpdate['allocatedRoomDetails.type'] = roomUpdates.type;
                }
                if (roomUpdates.capacity !== undefined) {
                    applicationUpdate['allocatedRoomDetails.capacity'] = roomUpdates.capacity;
                }
                
                // If room number changed, update that too
                if (roomUpdates.roomNumber && roomUpdates.roomNumber !== roomNumber) {
                    applicationUpdate.allocatedRoom = roomUpdates.roomNumber;
                    applicationUpdate['allocatedRoomDetails.roomNumber'] = roomUpdates.roomNumber;
                }
                
                // Update roomId if we found the updated room
                if (updatedRoom && updatedRoom._id) {
                    applicationUpdate['allocatedRoomDetails.roomId'] = updatedRoom._id;
                }

                const applicationResult = await Application.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        allocatedRoom: roomNumber
                    },
                    {
                        $set: applicationUpdate
                    }
                );
                updateSummary.updated.applications = applicationResult.modifiedCount;
                console.log(`   ✅ Updated ${applicationResult.modifiedCount} applications`);
            } catch (error) {
                updateSummary.errors.push({ collection: 'Application', error: error.message });
                console.error(`   ❌ Error updating applications:`, error.message);
            }

            // 2. Update Debtors - Update roomPrice (effective next month for accruals)
            try {
                // Reuse residence and updatedRoom from above
                
                const debtorUpdate = {};
                
                // Update room price if provided
                if (roomUpdates.price !== undefined) {
                    debtorUpdate.roomPrice = roomUpdates.price;
                }
                
                // Update room number if changed
                if (roomUpdates.roomNumber && roomUpdates.roomNumber !== roomNumber) {
                    debtorUpdate.roomNumber = roomUpdates.roomNumber;
                }

                // Update room details
                if (roomUpdates.type !== undefined) {
                    debtorUpdate['roomDetails.roomType'] = roomUpdates.type;
                }
                if (roomUpdates.capacity !== undefined) {
                    debtorUpdate['roomDetails.roomCapacity'] = roomUpdates.capacity;
                }
                if (roomUpdates.features !== undefined) {
                    debtorUpdate['roomDetails.roomFeatures'] = roomUpdates.features;
                }
                if (roomUpdates.amenities !== undefined) {
                    debtorUpdate['roomDetails.roomAmenities'] = roomUpdates.amenities;
                }
                
                // Update roomId if we found the updated room
                if (updatedRoom && updatedRoom._id) {
                    debtorUpdate['roomDetails.roomId'] = updatedRoom._id;
                }

                const debtorResult = await Debtor.updateMany(
                    {
                        residence: new mongoose.Types.ObjectId(residenceId),
                        roomNumber: roomNumber
                    },
                    {
                        $set: debtorUpdate
                    }
                );
                updateSummary.updated.debtors = debtorResult.modifiedCount;
                console.log(`   ✅ Updated ${debtorResult.modifiedCount} debtors`);
                
                // Store price change effective date in debtor metadata if price changed
                if (roomUpdates.price !== undefined && roomUpdates.price !== oldRoomData?.price && effectiveDate) {
                    await Debtor.updateMany(
                        {
                            residence: new mongoose.Types.ObjectId(residenceId),
                            roomNumber: roomUpdates.roomNumber || roomNumber
                        },
                        {
                            $set: {
                                'metadata.priceChangeEffectiveDate': effectiveDate,
                                'metadata.priceChangeDate': new Date(),
                                'metadata.oldPrice': oldRoomData?.price || 0,
                                'metadata.newPrice': roomUpdates.price
                            }
                        }
                    );
                    console.log(`   📅 Set price change effective date for debtors: ${effectiveDate.toISOString().split('T')[0]}`);
                }
            } catch (error) {
                updateSummary.errors.push({ collection: 'Debtor', error: error.message });
                console.error(`   ❌ Error updating debtors:`, error.message);
            }

            // 3. Update Users - Update currentRoom if room number changed
            if (roomUpdates.roomNumber && roomUpdates.roomNumber !== roomNumber) {
                try {
                    const userResult = await User.updateMany(
                        {
                            residence: new mongoose.Types.ObjectId(residenceId),
                            currentRoom: roomNumber
                        },
                        {
                            $set: {
                                currentRoom: roomUpdates.roomNumber
                            }
                        }
                    );
                    updateSummary.updated.users = userResult.modifiedCount;
                    console.log(`   ✅ Updated ${userResult.modifiedCount} users`);
                } catch (error) {
                    updateSummary.errors.push({ collection: 'User', error: error.message });
                    console.error(`   ❌ Error updating users:`, error.message);
                }
            }

            const totalUpdated = Object.values(updateSummary.updated).reduce((sum, count) => sum + count, 0);
            console.log(`✅ Cascade room details update complete: ${totalUpdated} documents updated`);
            
            updateSummary.success = true;
            updateSummary.totalUpdated = totalUpdated;

        } catch (error) {
            console.error('❌ Error in cascade room details update:', error);
            updateSummary.success = false;
            updateSummary.errors.push({ general: error.message });
        }

        return updateSummary;
    }
}

module.exports = RoomUpdateService;

