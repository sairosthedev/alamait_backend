const Application = require('../../models/Application');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../../utils/email');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { getLeaseTemplateAttachment } = require('../../services/leaseTemplateService');
const ExpiredStudent = require('../../models/ExpiredStudent');

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
                roomStatusMap[room.roomNumber] = {
                    residence: residence.name,
                    residenceId: residence._id,
                    status: room.status,
                    currentOccupancy: room.currentOccupancy,
                    capacity: room.capacity,
                    price: room.price,
                    type: room.type
                };
            });
        });

        // Transform applications to match frontend format
        const transformedApplications = applications.map(app => {
            // Get room details for current and requested rooms
            const currentRoomDetails = app.currentRoom ? roomStatusMap[app.currentRoom] : null;
            const requestedRoomDetails = app.requestedRoom ? roomStatusMap[app.requestedRoom] : null;
            const allocatedRoomDetails = app.allocatedRoom ? roomStatusMap[app.allocatedRoom] : null;
            const waitlistedRoomDetails = app.waitlistedRoom ? roomStatusMap[app.waitlistedRoom] : null;
            
            // Calculate price difference for upgrades
            let priceDifference = null;
            if (app.requestType === 'upgrade' && currentRoomDetails && requestedRoomDetails) {
                priceDifference = requestedRoomDetails.price - currentRoomDetails.price;
            }
            
            return {
            id: app._id,
            studentName: `${app.firstName} ${app.lastName}`,
            email: app.email,
            contact: app.phone,
            requestType: app.requestType,
            status: app.status,
            paymentStatus: app.paymentStatus,
            applicationDate: app.applicationDate.toISOString().split('T')[0],
            startDate: app.startDate ? app.startDate.toISOString().split('T')[0] : null,
            endDate: app.endDate ? app.endDate.toISOString().split('T')[0] : null,
            preferredRoom: app.preferredRoom,
            alternateRooms: app.alternateRooms || [],
            currentRoom: app.currentRoom,
                currentRoomDetails: currentRoomDetails,
            requestedRoom: app.requestedRoom,
                requestedRoomDetails: requestedRoomDetails,
            reason: app.reason,
            allocatedRoom: app.allocatedRoom,
                allocatedRoomDetails: allocatedRoomDetails,
            waitlistedRoom: app.waitlistedRoom,
                waitlistedRoomDetails: waitlistedRoomDetails,
            roomOccupancy: app.roomOccupancy || { current: 0, capacity: 0 },
                applicationCode: app.applicationCode,
                priceDifference: priceDifference,
                residence: app.residence,
                residenceId: app.residence
            };
        });

        // Return response in the format expected by frontend (similar to residences API)
        res.json({
            success: true,
            count: transformedApplications.length,
            applications: transformedApplications,
            rooms: Object.entries(roomStatusMap).map(([roomNumber, details]) => ({
                name: roomNumber,
                ...details,
                occupancyDisplay: `${details.currentOccupancy}/${details.capacity}`
            })),
            residences: residences.map(residence => ({
                id: residence._id,
                name: residence.name,
                address: residence.address,
                manager: residence.manager,
                totalRooms: residence.rooms.length,
                availableRooms: residence.rooms.filter(room => room.status === 'available').length,
                occupiedRooms: residence.rooms.filter(room => room.status === 'occupied').length,
                reservedRooms: residence.rooms.filter(room => room.status === 'reserved').length
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
        const { action, roomNumber, residenceId } = req.body;
        
        if (!action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        if (action === 'approve' && (!roomNumber || !residenceId)) {
            return res.status(400).json({ error: 'Room number and residence ID are required for approval' });
        }
        
        if (action === 'waitlist' && !roomNumber) {
            return res.status(400).json({ error: 'Room number is required for waitlisting' });
        }

        const application = await Application.findById(req.params.applicationId);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Update application based on action
        switch (action) {
            case 'approve':
                try {
                    // Set the application status to approved directly
                    application.status = 'approved';
                    application.allocatedRoom = roomNumber;
                    application.paymentStatus = 'unpaid';
                    const approvalDate = new Date();

                    // Generate application code if not exists
                    if (!application.applicationCode) {
                        const year = new Date().getFullYear().toString().substr(-2);
                        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                        application.applicationCode = `APP${year}${random}`;
                    }

                    // Find the residence with the room
                    const residence = await Residence.findById(residenceId);
                    if (!residence) {
                        return res.status(404).json({ error: 'Residence not found with the provided ID' });
                    }

                    // Get the room and verify it exists in this residence
                    const room = residence.rooms.find(r => r.roomNumber === roomNumber);
                    if (!room) {
                        return res.status(404).json({ error: `Room ${roomNumber} not found in residence ${residence.name}` });
                    }

                    // Calculate validity period (4 months from now)
                    const validUntil = new Date(approvalDate);
                    validUntil.setMonth(approvalDate.getMonth() + 4);

                    if (application.requestType === 'upgrade') {
                        // Handle room upgrade
                        const oldRoom = residence.rooms.find(r => r.roomNumber === application.currentRoom);
                        if (oldRoom) {
                            oldRoom.currentOccupancy = Math.max(0, oldRoom.currentOccupancy - 1);
                            if (oldRoom.currentOccupancy === 0) {
                                oldRoom.status = 'available';
                            }
                        }
                    }

                    // Increment room occupancy
                    room.currentOccupancy += 1;
                    
                    // Update room status based on occupancy
                    if (room.currentOccupancy >= room.capacity) {
                        room.status = 'occupied';
                    } else if (room.currentOccupancy > 0) {
                        room.status = 'reserved';
                    }

                    // Set the admin user as the manager
                    residence.manager = req.user._id;
                    await residence.save();

                    // Update student's current room and validity
                    const userId = application.user || application.student;
                    await User.findByIdAndUpdate(
                        userId,
                        {
                            $set: {
                                currentRoom: roomNumber,
                                roomValidUntil: validUntil,
                                roomApprovalDate: approvalDate,
                                residence: residence._id
                            }
                        }
                    );

                    // Update application with residence reference
                    application.residence = residence._id;
                    await application.save();

                    // Generate and send lease agreement
                    let attachments = [];
                    try {
                        // Get lease template attachment from S3
                        const templateAttachment = await getLeaseTemplateAttachment(residence.name);
                        if (templateAttachment) {
                            attachments.push(templateAttachment);
                        } else {
                            throw new Error(`No lease template found for residence ${residence.name}`);
                        }
                    } catch (error) {
                        console.error('Error attaching lease agreement:', error);
                        // Send email without attachment and log the error
                        await sendEmail({
                            to: application.email,
                            subject: 'Application Approved - Action Required',
                            text: `
                                Dear ${application.firstName} ${application.lastName},

                                We are pleased to inform you that your application for Alamait Student Accommodation has been approved.

                                IMPORTANT: We were unable to attach the lease agreement to this email. Please contact administration to receive your lease agreement.

                                Application Details:
                                - Application Code: ${application.applicationCode}
                                - Allocated Room: ${roomNumber}
                                - Approval Date: ${approvalDate.toLocaleDateString()}
                                - Valid Until: ${validUntil.toLocaleDateString()}

                                Best regards,
                                Alamait Student Accommodation Team
                            `
                        });
                        // Define roomInfo for the response even in case of failure
                        const roomInfo = {
                            name: roomNumber,
                            status: room.status,
                            currentOccupancy: room.currentOccupancy,
                            capacity: room.capacity,
                            occupancyDisplay: `${room.currentOccupancy}/${room.capacity}`
                        };
                        // Skip the rest of the logic for sending the email with attachment
                        return res.json({ 
                            message: 'Application approved, but failed to attach lease agreement. Email sent without attachment.',
                            application,
                            room: roomInfo
                        });
                    }

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
                        `,
                        attachments: attachments.length > 0 ? attachments : undefined
                    });

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

        // After saving/updating application
        await User.updateOne(
            { email: application.email },
            {
                $set: {
                    residence: application.roomOccupancy.residence,
                    currentRoom: application.allocatedRoom
                }
            }
        );
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

        if (application.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already marked as paid' });
        }

        // Get the room from allocated room or waitlisted room
        const roomNumber = application.allocatedRoom || application.waitlistedRoom;
        if (!roomNumber) {
            return res.status(400).json({ error: 'No room found for this application' });
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
        
        // Only check capacity for non-approved applications
        if (application.status !== 'approved') {
            const currentOccupancy = room.currentOccupancy || 0;
            if (currentOccupancy >= room.capacity) {
                return res.status(400).json({ error: 'Room is at full capacity' });
            }
        }

        // Update room occupancy if not already approved
        if (application.status !== 'approved') {
            room.currentOccupancy = (room.currentOccupancy || 0) + 1;
            room.occupants = [...(room.occupants || []), application.student._id];
        }
        
        // Update room status based on occupancy
        if (room.currentOccupancy >= room.capacity) {
            room.status = 'occupied';
        } else if (room.currentOccupancy > 0) {
            room.status = 'reserved';
        }

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

        // Calculate validity period (4 months from now)
        const approvalDate = new Date();
        const validUntil = new Date(approvalDate);
        validUntil.setMonth(approvalDate.getMonth() + 4);

        // Update student's current room
        await User.findOneAndUpdate(
            { email: application.email },
            {
                $set: {
                    currentRoom: roomNumber,
                    waitlistedRoom: null,
                    roomValidUntil: validUntil,
                    roomApprovalDate: approvalDate
                }
            }
        );

        await application.save();

        // Send confirmation email to student
        const emailSubject = application.requestType === 'upgrade' 
            ? 'Room Upgrade Payment Confirmed - Alamait Student Accommodation'
            : 'Room Allocation Confirmed - Alamait Student Accommodation';
            
        const emailText = application.requestType === 'upgrade'
            ? `
                Dear ${application.firstName} ${application.lastName},

                We are pleased to confirm that your payment for the room upgrade has been received.

                Upgrade Details:
                - Previous Room: ${application.currentRoom || 'None'}
                - New Room: ${roomNumber}
                - Current Occupancy: ${room.currentOccupancy}/${room.capacity}
                - Approval Date: ${approvalDate.toLocaleDateString()}
                - Valid Until: ${validUntil.toLocaleDateString()}
                
                Your room upgrade will be effective immediately. Please contact our office to arrange the move.

                Best regards,
                Alamait Student Accommodation Team
            `
            : `
                Dear ${application.firstName} ${application.lastName},

                We are pleased to confirm that your payment has been received and your room has been allocated.

                Room Details:
                - Room Number: ${roomNumber}
                - Current Occupancy: ${room.currentOccupancy}/${room.capacity}
                
                Your room is now ready for you to move in. Please contact our office to arrange a suitable time.

                Best regards,
                Alamait Student Accommodation Team
            `;

        await sendEmail({
            to: application.email,
            subject: emailSubject,
            text: emailText
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
        const applicationId = req.params.applicationId;
        console.log('Attempting to delete application with ID:', applicationId);
        // Find the application by ID
        const application = await Application.findById(applicationId).populate('student');
        
        if (!application) {
            console.error('Application not found for ID:', applicationId);
            return res.status(404).json({ error: 'Application not found' });
        }

        // Archive before removing the user and application
        try {
            const ExpiredStudent = require('../../models/ExpiredStudent');
            const Booking = require('../../models/Booking');
            const Lease = require('../../models/Lease');
            let user = null;
            if (application.student) {
                user = await User.findById(application.student._id);
            }
            // Fetch payment history
            let paymentHistory = [];
            if (user) {
                const bookings = await Booking.find({ student: user._id }).lean();
                paymentHistory = bookings.flatMap(booking => booking.payments || []);
            }
            // Fetch leases
            let leases = [];
            if (user) {
                leases = await Lease.find({ studentId: user._id }).lean();
            }
            await ExpiredStudent.create({
                student: user ? user.toObject() : null,
                application: application.toObject(),
                previousApplicationCode: application.applicationCode,
                archivedAt: new Date(),
                reason: 'application_deleted',
                paymentHistory,
                leases
            });
        } catch (archiveError) {
            console.error('Error archiving to ExpiredStudent:', archiveError);
        }

        // Delete the application itself
        try {
            await application.deleteOne();
            console.log('Deleted application with ID:', applicationId);
        } catch (appDeleteError) {
            console.error('Error deleting application:', appDeleteError);
            return res.status(500).json({ error: 'Failed to delete application', details: appDeleteError.message });
        }

        res.json({ message: 'Application and associated user deleted successfully' });
    } catch (error) {
        console.error('Error in deleteApplication:', error, error.stack);
        res.status(500).json({ error: 'Server error', details: error.message });
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

// Get expired students (for applications route)
exports.getExpiredStudents = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await ExpiredStudent.countDocuments();
        const expiredStudents = await ExpiredStudent.find()
            .sort({ archivedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        res.json({
            success: true,
            expiredStudents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}; 