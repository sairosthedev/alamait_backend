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
}

module.exports = RoomUpdateService;

