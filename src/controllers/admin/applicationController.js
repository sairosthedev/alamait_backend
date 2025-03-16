const Application = require('../../models/Application');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../../utils/email');

// Get all applications with room status
exports.getApplications = async (req, res) => {
    try {
        const { type, status } = req.query;
        const query = {};

        if (type) query.requestType = type;
        if (status) query.status = status;

        // Get applications
        const applications = await Application.find(query)
            .sort({ applicationDate: -1 });

        // Get all residences to check room status
        const residences = await Residence.find({}, 'name rooms');
        
        // Create a map of room statuses
        const roomStatusMap = {};
        
        residences.forEach(residence => {
            residence.rooms.forEach(room => {
                // Get capacity based on room type
                const capacity = room.capacity || (
                    room.type === 'single' ? 1 : 
                    room.type === 'double' ? 2 : 
                    room.type === 'studio' ? 1 : 
                    room.type === 'triple' ? 3 : 
                    room.type === 'quad' ? 4 : 4
                );
                
                // Set occupancy based on data
                let currentOccupancy = room.currentOccupancy || 0;
                
                // Determine the correct status based on occupancy
                let status = room.status?.toLowerCase() || 'unavailable';
                
                // If occupancy is 0, room should be available
                if (currentOccupancy === 0) {
                    status = 'available';
                } 
                // If occupancy equals capacity, room should be occupied
                else if (currentOccupancy >= capacity) {
                    status = 'occupied';
                }
                // If occupancy is between 0 and capacity, room should be reserved
                else if (currentOccupancy > 0) {
                    status = 'reserved';
                }
                
                roomStatusMap[room.roomNumber] = {
                    capacity: capacity,
                    currentOccupancy: currentOccupancy,
                    price: room.price,
                    status: status,
                    residenceName: residence.name
                };
            });
        });

        // Transform applications to match frontend format
        const transformedApplications = applications.map(app => ({
            id: app._id,
            studentName: `${app.firstName} ${app.lastName}`,
            email: app.email,
            contact: app.phone,
            requestType: app.requestType,
            status: app.status,
            paymentStatus: app.paymentStatus,
            applicationDate: app.applicationDate.toISOString().split('T')[0],
            preferredRoom: app.preferredRoom,
            alternateRooms: app.alternateRooms || [],
            currentRoom: app.currentRoom,
            requestedRoom: app.requestedRoom,
            reason: app.reason,
            allocatedRoom: app.allocatedRoom,
            waitlistedRoom: app.waitlistedRoom,
            roomOccupancy: app.roomOccupancy || { current: 0, capacity: 0 },
            applicationCode: app.applicationCode
        }));

        res.json({
            applications: transformedApplications,
            rooms: Object.entries(roomStatusMap).map(([roomNumber, details]) => ({
                name: roomNumber,
                ...details,
                occupancyDisplay: `${details.currentOccupancy}/${details.capacity}`
            }))
        });
    } catch (error) {
        console.error('Error in getApplications:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { action, roomNumber } = req.body;
        
        if (!action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        if ((action === 'approve' || action === 'waitlist') && !roomNumber) {
            return res.status(400).json({ error: 'Room number is required for approval or waitlisting' });
        }

        const application = await Application.findById(req.params.applicationId);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Update application based on action
        switch (action) {
            case 'approve':
                // Set the application status to approved directly
                application.status = 'approved';
                application.allocatedRoom = roomNumber; // Set allocated room directly
                application.paymentStatus = 'unpaid';
                const approvalDate = new Date();

                // Generate application code if not exists
                if (!application.applicationCode) {
                    const year = new Date().getFullYear().toString().substr(-2);
                    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    application.applicationCode = `APP${year}${random}`;
                }

                try {
                    // Find the residence with the room
                    const residence = await Residence.findOne({ 'rooms.roomNumber': roomNumber });
                    
                    if (!residence) {
                        throw new Error('Room not found');
                    }

                    // Get the room details
                    const room = residence.rooms.find(r => r.roomNumber === roomNumber);
                    if (!room) {
                        throw new Error('Room not found');
                    }

                    // Store room capacity in the application
                    application.roomOccupancy = {
                        current: room.currentOccupancy,
                        capacity: room.capacity || (room.type === 'single' ? 1 : room.type === 'double' ? 2 : room.type === 'studio' ? 1 : 4)
                    };

                    // Calculate validity period (4 months from approval date)
                    const validUntil = new Date(approvalDate);
                    validUntil.setMonth(approvalDate.getMonth() + 4);

                    // Update student's current room and validity
                    await User.findByIdAndUpdate(
                        application.student,
                        {
                            $set: {
                                currentRoom: roomNumber, // Set current room directly
                                roomValidUntil: validUntil,
                                roomApprovalDate: approvalDate
                            }
                        }
                    );

                    // Send approval email
                    await sendEmail({
                        to: application.email,
                        subject: 'Application Approved - Alamait Student Accommodation',
                        text: `
                            Dear ${application.firstName} ${application.lastName},

                            We are pleased to inform you that your application for Alamait Student Accommodation has been approved.

                            Application Details:
                            - Application Code: ${application.applicationCode}
                            - Allocated Room: ${roomNumber}
                            - Approval Date: ${approvalDate.toLocaleDateString()}
                            - Valid Until: ${validUntil.toLocaleDateString()}

                            Please use this application code when registering on our platform.

                            Next Steps:
                            1. Register on our platform using your application code
                            2. Complete your profile
                            3. Make the required payments to secure your room
                            4. Submit any additional documents

                            If you have any questions, please don't hesitate to contact us.

                            Best regards,
                            Alamait Student Accommodation Team
                        `
                    });

                    await application.save();
                    
                    // Prepare room information to return to the frontend
                    const roomInfo = {
                        name: roomNumber,
                        status: room.status,
                        currentOccupancy: room.currentOccupancy,
                        capacity: room.capacity,
                        occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
                    };
                    
                    res.json({ 
                        message: 'Application approved successfully',
                        application,
                        room: roomInfo
                    });
                } catch (error) {
                    console.error('Error in approval process:', error);
                    return res.status(400).json({ 
                        error: 'Failed to complete approval process',
                        details: error.message 
                    });
                }
                break;

            case 'reject':
                application.status = 'rejected';
                
                // Send rejection email
                await sendEmail({
                    to: application.email,
                    subject: 'Application Status Update - Alamait Student Accommodation',
                    text: `
                        Dear ${application.firstName} ${application.lastName},

                        We regret to inform you that we are unable to approve your application at this time.

                        If you have any questions or would like to discuss alternative options, please don't hesitate to contact us.

                        Best regards,
                        Alamait Student Accommodation Team
                    `
                });
                
                await application.save();
                res.json({ 
                    message: 'Application rejected successfully',
                    application
                });
                break;

            case 'waitlist':
                application.status = 'waitlisted';
                application.waitlistedRoom = roomNumber;

                // Find the residence with the room to get capacity
                const residence = await Residence.findOne({ 'rooms.roomNumber': roomNumber });
                let roomInfo = null;
                
                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === roomNumber);
                    if (room) {
                        application.roomOccupancy = {
                            current: room.currentOccupancy,
                            capacity: room.capacity || (room.type === 'single' ? 1 : room.type === 'double' ? 2 : room.type === 'studio' ? 1 : 4)
                        };
                        
                        // Prepare room information to return to the frontend
                        roomInfo = {
                            name: roomNumber,
                            status: room.status,
                            currentOccupancy: room.currentOccupancy,
                            capacity: room.capacity,
                            occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
                        };
                        
                        // Update user's waitlisted room
                        if (application.student) {
                            await User.findByIdAndUpdate(
                                application.student,
                                {
                                    $set: {
                                        waitlistedRoom: roomNumber
                                    }
                                }
                            );
                        }
                    }
                }

                // Send waitlist email
                await sendEmail({
                    to: application.email,
                    subject: 'Application Waitlisted - Alamait Student Accommodation',
                    text: `
                        Dear ${application.firstName} ${application.lastName},

                        Your application has been placed on our waitlist for room ${roomNumber}.

                        We will contact you as soon as a space becomes available.

                        Best regards,
                        Alamait Student Accommodation Team
                    `
                });
                
                await application.save();
                res.json({ 
                    message: 'Application waitlisted successfully',
                    application,
                    room: roomInfo
                });
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error in updateApplicationStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await Application.findById(applicationId)
            .populate('student', 'firstName lastName');

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        if (application.status !== 'waitlisted') {
            return res.status(400).json({ error: 'Can only update payment for waitlisted applications' });
        }

        if (application.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already marked as paid' });
        }

        // Get the room from waitlisted room
        const roomNumber = application.waitlistedRoom;
        if (!roomNumber) {
            return res.status(400).json({ error: 'No waitlisted room found for this application' });
        }

        // Find the residence with the room
        const residence = await Residence.findOne({ 'rooms.roomNumber': roomNumber });
        if (!residence) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Get the room
        const roomIndex = residence.rooms.findIndex(r => r.roomNumber === roomNumber);
        if (roomIndex === -1) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = residence.rooms[roomIndex];
        
        // Check if room has space
        if (room.currentOccupancy >= room.capacity) {
            return res.status(400).json({ error: 'Room is at full capacity' });
        }

        // Increment room occupancy
        room.currentOccupancy += 1;
        
        // Update room status based on occupancy
        if (room.currentOccupancy >= room.capacity) {
            room.status = 'occupied';
        } else if (room.currentOccupancy > 0) {
            room.status = 'reserved';
        } else {
            room.status = 'available';
        }

        // Save the residence with updated room occupancy
        await residence.save();

        // Update application status and payment status
        application.status = 'approved';
        application.paymentStatus = 'paid';
        application.allocatedRoom = roomNumber;
        
        // Update room occupancy in application
        application.roomOccupancy = {
            current: room.currentOccupancy,
            capacity: room.capacity
        };

        // Update user's current room
        await User.findByIdAndUpdate(
            application.student,
            {
                $set: {
                    currentRoom: roomNumber,
                    waitlistedRoom: null
                }
            }
        );

        await application.save();

        // Send confirmation email to student
        await sendEmail({
            to: application.email,
            subject: 'Room Allocation Confirmed - Alamait Student Accommodation',
            text: `
                Dear ${application.firstName} ${application.lastName},

                We are pleased to confirm that your payment has been received and your room has been allocated.

                Room Details:
                - Room Number: ${roomNumber}
                - Current Occupancy: ${room.currentOccupancy}/${room.capacity}
                
                Your room is now ready for you to move in. Please contact our office to arrange a suitable time.

                Best regards,
                Alamait Student Accommodation Team
            `
        });

        // Return updated room information along with the application
        const updatedRoom = {
            name: roomNumber,
            status: room.status,
            currentOccupancy: room.currentOccupancy,
            capacity: room.capacity,
            occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
        };

        res.json({
            message: 'Payment marked as paid and room allocated successfully',
            application,
            room: updatedRoom
        });
    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete application
exports.deleteApplication = async (req, res) => {
    try {
        const application = await User.findById(req.params.applicationId);
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Only delete if not verified
        if (application.isVerified) {
            return res.status(400).json({ 
                error: 'Cannot delete verified application' 
            });
        }

        await application.remove();
        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        console.error('Error in deleteApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update room validity
exports.updateRoomValidity = async (req, res) => {
    try {
        const { userId } = req.params;
        // Set base date to March 2025
        const baseDate = new Date(2025, 2, 28); // March 28, 2025
        const validUntil = new Date(baseDate);
        validUntil.setMonth(baseDate.getMonth() + 4); // Add 4 months to get to July 2025

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { roomValidUntil: validUntil } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Room validity updated successfully',
            roomValidUntil: validUntil
        });
    } catch (error) {
        console.error('Error updating room validity:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Sync room occupancy with allocations
exports.syncRoomOccupancy = async (req, res) => {
    try {
        // Get all approved applications with allocated rooms
        const allocatedApplications = await Application.find({
            status: 'approved',
            allocatedRoom: { $exists: true, $ne: null }
        });

        // Get all residences
        const residences = await Residence.find({});
        
        // Create a map to track room occupancy
        const roomOccupancyMap = {};
        
        // Count allocations for each room
        allocatedApplications.forEach(app => {
            if (!roomOccupancyMap[app.allocatedRoom]) {
                roomOccupancyMap[app.allocatedRoom] = 0;
            }
            roomOccupancyMap[app.allocatedRoom] += 1;
        });
        
        // Update room occupancy in residences
        let updatedRooms = 0;
        
        for (const residence of residences) {
            let residenceUpdated = false;
            
            residence.rooms.forEach(room => {
                const allocatedCount = roomOccupancyMap[room.roomNumber] || 0;
                
                // If the current occupancy doesn't match the allocated count, update it
                if (room.currentOccupancy !== allocatedCount) {
                    room.currentOccupancy = allocatedCount;
                    
                    // Update room status based on occupancy
                    if (allocatedCount === 0) {
                        room.status = 'available';
                    } else if (allocatedCount >= room.capacity) {
                        room.status = 'occupied';
                    } else {
                        room.status = 'reserved';
                    }
                    
                    updatedRooms++;
                    residenceUpdated = true;
                }
            });
            
            // Save the residence if any rooms were updated
            if (residenceUpdated) {
                await residence.save();
            }
        }
        
        res.json({
            message: `Room occupancy synced successfully. Updated ${updatedRooms} rooms.`
        });
    } catch (error) {
        console.error('Error in syncRoomOccupancy:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 