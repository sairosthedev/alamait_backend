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
                roomStatusMap[room.roomNumber] = {
                    capacity: room.type === 'single' ? 1 : room.type === 'double' ? 2 : room.type === 'studio' ? 1 : 2,
                    price: room.price,
                    status: room.status,
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
            applicationCode: app.applicationCode
        }));

        res.json({
            applications: transformedApplications,
            rooms: Object.entries(roomStatusMap).map(([roomNumber, details]) => ({
                name: roomNumber,
                ...details
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

        if (action === 'approve' && !roomNumber) {
            return res.status(400).json({ error: 'Room number is required for approval' });
        }

        const application = await Application.findById(req.params.applicationId);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Update application based on action
        switch (action) {
            case 'approve':
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

                try {
                    // Update room status to reserved
                    const residence = await Residence.findOneAndUpdate(
                        { 'rooms.roomNumber': roomNumber },
                        { $set: { 'rooms.$.status': 'reserved' } },
                        { new: true }
                    );

                    if (!residence) {
                        throw new Error('Room not found');
                    }

                    // Calculate validity period (4 months from approval date)
                    const validUntil = new Date(approvalDate);
                    validUntil.setMonth(approvalDate.getMonth() + 4);

                    // Update student's current room and validity
                    await User.findByIdAndUpdate(
                        application.student,
                        {
                            $set: {
                                currentRoom: roomNumber,
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
                            3. Make the required payments
                            4. Submit any additional documents

                            If you have any questions, please don't hesitate to contact us.

                            Best regards,
                            Alamait Student Accommodation Team
                        `
                    });

                    await application.save();
                    res.json({ 
                        message: 'Application approved successfully',
                        application 
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
                break;

            case 'waitlist':
                application.status = 'waitlisted';
                application.waitlistedRoom = roomNumber;

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
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        await application.save();
        res.json(application);
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

        if (application.status !== 'approved') {
            return res.status(400).json({ error: 'Can only update payment for approved applications' });
        }

        if (application.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already marked as paid' });
        }

        // Update room status from reserved to occupied
        await Residence.findOneAndUpdate(
            { 'rooms.roomNumber': application.allocatedRoom },
            { $set: { 'rooms.$.status': 'occupied' } }
        );

        // Update application payment status
        application.paymentStatus = 'paid';
        await application.save();

        // TODO: Send confirmation to student

        res.json(application);
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