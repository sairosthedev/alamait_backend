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
const EmailNotificationService = require('../../services/emailNotificationService');

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
                    await User.findByIdAndUpdate(
                        application.student,
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

                    // Create debtor account for the student now that application is approved
                    try {
                        console.log(`\n🏗️  Creating/updating debtor for approved application: ${application.applicationCode}`);
                        console.log(`   Student: ${application.firstName} ${application.lastName} (${application.email})`);
                        console.log(`   Room: ${roomNumber} (Price: $${room.price || 'Not set'})`);
                        console.log(`   Residence: ${residence.name} (${residence._id})`);
                        
                        const { createDebtorForStudent } = require('../../services/debtorService');
                        const studentUser = await User.findById(application.student);
                        
                        if (studentUser) {
                            console.log(`   ✅ Found student user: ${studentUser.email}`);
                            
                            // Check if debtor already exists
                            const Debtor = require('../../models/Debtor');
                            const existingDebtor = await Debtor.findOne({ user: studentUser._id });
                            
                            if (!existingDebtor) {
                                console.log(`   🔨 Creating NEW debtor account...`);
                                
                                // Create debtor with application data
                                const debtor = await createDebtorForStudent(studentUser, {
                                    createdBy: req.user._id,
                                    residenceId: residence._id,
                                    roomNumber: roomNumber,
                                    roomPrice: room.price || 0,
                                    startDate: application.startDate,
                                    endDate: application.endDate,
                                    application: application._id,
                                    applicationCode: application.applicationCode
                                });
                                console.log(`   ✅ Created debtor account: ${debtor.debtorCode}`);
                                
                                // Link the debtor back to the application
                                application.debtor = debtor._id;
                                await application.save();
                                console.log(`   🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                                
                            } else {
                                console.log(`   🔄 Updating EXISTING debtor account: ${existingDebtor.debtorCode}`);
                                
                                // Update existing debtor with application data
                                const updateData = {
                                    residence: residence._id,
                                    roomNumber: roomNumber,
                                    startDate: application.startDate,
                                    endDate: application.endDate,
                                    application: application._id,  // ← ADD THIS: Link to application
                                    applicationCode: application.applicationCode,  // ← ADD THIS: Link application code
                                    updatedAt: new Date()
                                };
                                
                                // Recalculate totalOwed based on room price and lease duration
                                if (room.price && application.startDate && application.endDate) {
                                    const monthsDiff = Math.ceil((new Date(application.endDate) - new Date(application.startDate)) / (1000 * 60 * 60 * 24 * 30.44));
                                    const totalRent = room.price * monthsDiff;
                                    
                                    // Calculate admin fee based on residence
                                    let adminFee = 0;
                                    if (residence.name.toLowerCase().includes('st kilda')) {
                                        adminFee = 20; // St Kilda has $20 admin fee
                                    }
                                    
                                    // Calculate deposit (typically 1 month's rent)
                                    const deposit = room.price;
                                    
                                    const expectedTotal = totalRent + adminFee + deposit;
                                    
                                    updateData.totalOwed = expectedTotal;
                                    updateData.currentBalance = Math.max(expectedTotal - (existingDebtor.totalPaid || 0), 0);
                                    updateData.roomPrice = room.price;
                                    
                                    // Update billing period information
                                    updateData.billingPeriod = {
                                        type: monthsDiff === 3 ? 'quarterly' : 
                                              monthsDiff === 6 ? 'semester' : 
                                              monthsDiff === 12 ? 'annual' : 'monthly',
                                        duration: {
                                            value: monthsDiff,
                                            unit: 'months'
                                        },
                                        startDate: new Date(application.startDate),
                                        endDate: new Date(application.endDate),
                                        billingCycle: {
                                            frequency: 'monthly',
                                            dayOfMonth: 1,
                                            gracePeriod: 5
                                        },
                                        amount: {
                                            monthly: room.price,
                                            total: expectedTotal,
                                            currency: 'USD'
                                        },
                                        status: 'active',
                                        description: `Billing period for ${studentUser.email}`,
                                        notes: `Updated from approved application ${application.applicationCode}`,  // ← ADD APPLICATION CODE
                                        autoRenewal: {
                                            enabled: false,
                                            renewalType: 'same_period',
                                            customRenewalPeriod: null
                                        }
                                    };
                                    
                                    updateData.financialBreakdown = {
                                        monthlyRent: room.price,
                                        numberOfMonths: monthsDiff,
                                        totalRent: totalRent,
                                        adminFee: adminFee,
                                        deposit: deposit,
                                        totalOwed: expectedTotal
                                    };
                                }
                                
                                await Debtor.findByIdAndUpdate(existingDebtor._id, updateData);
                                console.log(`   ✅ Updated existing debtor account for approved student: ${studentUser.email}`);
                                console.log(`   📊 Updated fields: residence, room, dates, application link`);
                                
                                // Link the debtor back to the application
                                application.debtor = existingDebtor._id;
                                await application.save();
                                console.log(`   🔗 Linked existing debtor ${existingDebtor._id} to application ${application._id}`);
                                console.log(`   📋 Application now has debtor reference: ${application.debtor}`);
                            }
                        } else {
                            console.error(`   ❌ Student user not found for application: ${application._id}`);
                        }
                    } catch (debtorError) {
                        console.error('   ❌ Error creating/updating debtor account:', debtorError);
                        // Don't fail the approval process if debtor creation fails
                        // But log it for investigation
                        console.error('   🔍 Debtor creation failed for application:', {
                            applicationId: application._id,
                            studentId: application.student,
                            error: debtorError.message
                        });
                    }

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

                    // Send room change approval notification if this is a room change request (non-blocking)
                    if (application.requestType === 'upgrade' || application.requestType === 'downgrade') {
                        try {
                            await EmailNotificationService.sendRoomChangeApprovalNotification(application, req.user);
                        } catch (emailError) {
                            console.error('Failed to send room change approval email notification:', emailError);
                            // Don't fail the request if email fails
                        }
                    }

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

                // Send room change rejection notification if this is a room change request (non-blocking)
                if (application.requestType === 'upgrade' || application.requestType === 'downgrade') {
                    try {
                        await EmailNotificationService.sendRoomChangeRejectionNotification(application, req.user, 'Application could not be approved at this time');
                    } catch (emailError) {
                        console.error('Failed to send room change rejection email notification:', emailError);
                        // Don't fail the request if email fails
                    }
                }
                
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
                const waitlistResidence = await Residence.findOne({ 'rooms.roomNumber': roomNumber });
                let waitlistRoomInfo = null;
                
                if (waitlistResidence) {
                    const waitlistRoom = waitlistResidence.rooms.find(r => r.roomNumber === roomNumber);
                    if (waitlistRoom) {
                        application.roomOccupancy = {
                            current: waitlistRoom.currentOccupancy,
                            capacity: waitlistRoom.capacity || (waitlistRoom.type === 'single' ? 1 : waitlistRoom.type === 'double' ? 2 : waitlistRoom.type === 'studio' ? 1 : 4)
                        };
                        
                        // Prepare room information to return to the frontend
                        waitlistRoomInfo = {
                            name: roomNumber,
                            status: waitlistRoom.status,
                            currentOccupancy: waitlistRoom.currentOccupancy,
                            capacity: waitlistRoom.capacity,
                            occupancyDisplay: `${waitlistRoom.currentOccupancy}/${waitlistRoom.capacity}`
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
                    room: waitlistRoomInfo
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
                    residence: application.roomOccupancy?.residence,
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
        await User.findByIdAndUpdate(
            application.student,
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

        res.json({
            message: 'Payment confirmed and room allocated successfully',
            application,
            room: {
                number: roomNumber,
                occupancy: `${room.currentOccupancy}/${room.capacity}`,
                status: room.status
            }
        });

    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update room validity for a user
exports.updateRoomValidity = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newValidUntil } = req.body;
        
        if (!newValidUntil) {
            return res.status(400).json({ error: 'New valid until date is required' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.role !== 'student') {
            return res.status(400).json({ error: 'User is not a student' });
        }

// Update room validity
        await User.findByIdAndUpdate(userId, {
            roomValidUntil: new Date(newValidUntil)
        });
        
        console.log(`✅ Updated room validity for student ${user.email} to ${newValidUntil}`);

        res.json({
            message: 'Room validity updated successfully',
            userId,
            newValidUntil
        });
        
    } catch (error) {
        console.error('❌ Error updating room validity:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Sync room occupancy with allocations
exports.syncRoomOccupancy = async (req, res) => {
    try {
        console.log('🔄 Syncing room occupancy with allocations...');
        
        const Residence = require('../../models/Residence');
        const residences = await Residence.find({});
        
        let updatedRooms = 0;
        
        for (const residence of residences) {
            for (const room of residence.rooms) {
                // Count active applications for this room
                const activeApplications = await Application.countDocuments({
                    allocatedRoom: room.roomNumber,
                    status: 'approved',
                    paymentStatus: { $in: ['paid', 'unpaid'] }
                });
                
                // Update room occupancy
                if (room.currentOccupancy !== activeApplications) {
                    room.currentOccupancy = activeApplications;
                    
                    // Update room status based on occupancy
                    if (room.currentOccupancy >= room.capacity) {
                        room.status = 'occupied';
                    } else if (room.currentOccupancy > 0) {
                        room.status = 'reserved';
                    } else {
                        room.status = 'available';
                    }
                    
                    updatedRooms++;
                }
            }
            
                await residence.save();
            }
        
        console.log(`✅ Synced ${updatedRooms} rooms across ${residences.length} residences`);
        
        res.json({
            message: 'Room occupancy synced successfully',
            updatedRooms,
            totalResidences: residences.length
        });
        
    } catch (error) {
        console.error('❌ Error syncing room occupancy:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete application
exports.deleteApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await Application.findById(applicationId);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Check if application is already approved and has a debtor
        if (application.status === 'approved' && application.debtor) {
            return res.status(400).json({ 
                error: 'Cannot delete approved application with active debtor account. Please contact finance department.' 
            });
        }

        // If application has a student, remove the room allocation
        if (application.student) {
            await User.findByIdAndUpdate(
                application.student,
                {
                    $unset: {
                        currentRoom: 1,
                        waitlistedRoom: 1,
                        roomValidUntil: 1,
                        roomApprovalDate: 1,
                        residence: 1
                    }
                }
            );
        }

        // Delete the application
        await Application.findByIdAndDelete(applicationId);
        
        res.json({
            message: 'Application deleted successfully',
            deletedApplicationId: applicationId
        });

    } catch (error) {
        console.error('Error in deleteApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get expired students
exports.getExpiredStudents = async (req, res) => {
    try {
        console.log('🔍 Getting expired students...');
        
        const currentDate = new Date();
        
        // Find students whose room validity has expired
        const expiredStudents = await User.find({
            role: 'student',
            roomValidUntil: { $lt: currentDate },
            currentRoom: { $exists: true, $ne: null }
        }).select('firstName lastName email currentRoom roomValidUntil roomApprovalDate residence')
          .populate('residence', 'name');
        
        console.log(`✅ Found ${expiredStudents.length} expired students`);
        
        res.json({
            success: true,
            count: expiredStudents.length,
            expiredStudents: expiredStudents.map(student => ({
                id: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                currentRoom: student.currentRoom,
                roomValidUntil: student.roomValidUntil,
                roomApprovalDate: student.roomApprovalDate,
                residence: student.residence ? {
                    id: student.residence._id,
                    name: student.residence.name
                } : null,
                daysExpired: Math.ceil((currentDate - student.roomValidUntil) / (1000 * 60 * 60 * 24))
            }))
        });
        
    } catch (error) {
        console.error('❌ Error getting expired students:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 