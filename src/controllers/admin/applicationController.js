const Application = require('../../models/Application');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence'); // <-- FIXED
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
                roomCount: residence.rooms.length
            }))
        });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching applications',
            error: error.message 
        });
    }
};

// Get application by ID
exports.getApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get application
        const application = await Application.findById(id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                message: 'Application not found' 
            });
        }

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

        // Get room details for current and requested rooms
        const currentRoomDetails = application.currentRoom ? roomStatusMap[application.currentRoom] : null;
        const requestedRoomDetails = application.requestedRoom ? roomStatusMap[application.requestedRoom] : null;
        const allocatedRoomDetails = application.allocatedRoom ? roomStatusMap[application.allocatedRoom] : null;
        const waitlistedRoomDetails = application.waitlistedRoom ? roomStatusMap[application.waitlistedRoom] : null;
        
        // Calculate price difference for upgrades
        let priceDifference = null;
        if (application.requestType === 'upgrade' && currentRoomDetails && requestedRoomDetails) {
            priceDifference = requestedRoomDetails.price - currentRoomDetails.price;
        }
        
        // Transform application to match frontend format
        const transformedApplication = {
            id: application._id,
            studentName: `${application.firstName} ${application.lastName}`,
            email: application.email,
            contact: application.phone,
            requestType: application.requestType,
            status: application.status,
            paymentStatus: application.paymentStatus,
            applicationDate: application.applicationDate.toISOString().split('T')[0],
            startDate: application.startDate ? application.startDate.toISOString().split('T')[0] : null,
            endDate: application.endDate ? application.endDate.toISOString().split('T')[0] : null,
            preferredRoom: application.preferredRoom,
            alternateRooms: application.alternateRooms || [],
            currentRoom: application.currentRoom,
            currentRoomDetails: currentRoomDetails,
            requestedRoom: application.requestedRoom,
            requestedRoomDetails: requestedRoomDetails,
            reason: application.reason,
            allocatedRoom: application.allocatedRoom,
            allocatedRoomDetails: allocatedRoomDetails,
            waitlistedRoom: application.waitlistedRoom,
            waitlistedRoomDetails: waitlistedRoomDetails,
            roomOccupancy: application.roomOccupancy || { current: 0, capacity: 0 },
            applicationCode: application.applicationCode,
            priceDifference: priceDifference,
            residence: application.residence,
            residenceId: application.residence
        };

        res.json({
            success: true,
            application: transformedApplication
        });
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching application',
            error: error.message 
        });
    }
};

// Test function to see if route is being hit
exports.testUpdateApplicationStatus = async (req, res) => {
    console.log('🧪 TEST: updateApplicationStatus route hit!');
    console.log('Request body:', req.body);
    console.log('Request params:', req.params);
    console.log('User:', req.user);
    
    res.json({
        success: true,
        message: 'Test route hit successfully',
        data: {
            body: req.body,
            params: req.params,
            user: req.user ? { id: req.user._id, email: req.user.email } : 'No user'
        }
    });
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
    try {
        console.log('🔄 updateApplicationStatus called with:', {
            body: req.body,
            params: req.params,
            user: req.user ? { id: req.user._id, email: req.user.email } : 'No user'
        });

        const { action, roomNumber, residenceId } = req.body;
        const { applicationId } = req.params;

        console.log('📋 Processing application:', { action, roomNumber, residenceId, applicationId });

        const application = await Application.findById(applicationId);
        if (!application) {
            console.log('❌ Application not found:', applicationId);
            return res.status(404).json({ error: 'Application not found' });
        }

        console.log('✅ Found application:', {
            id: application._id,
            studentName: `${application.firstName} ${application.lastName}`,
            email: application.email,
            status: application.status
        });

        // Check if this is a re-application
        const isReapplication = application.isReapplication || false;
        const previousDebtorCode = application.previousDebtorCode;
        
        if (isReapplication) {
            console.log(`🔄 Processing re-application: ${application.applicationCode}`);
            console.log(`   Previous debtor: ${previousDebtorCode || 'None'}`);
            console.log(`   Previous student: ${application.previousStudentId || 'None'}`);
        }

        switch (action) {
            case 'approve':
                console.log('✅ Processing approval...');
                
                // Handle room allocation and approval
                if (!roomNumber || !residenceId) {
                    console.log('❌ Missing room number or residence ID');
                    return res.status(400).json({ error: 'Room number and residence ID are required for approval' });
                }

                // Find the residence and room
                const residence = await Residence.findById(residenceId);
                if (!residence) {
                    console.log('❌ Residence not found:', residenceId);
                    return res.status(404).json({ error: 'Residence not found' });
                }

                const room = residence.rooms.find(r => r.roomNumber === roomNumber);
                if (!room) {
                    console.log('❌ Room not found:', roomNumber, 'in residence:', residence.name);
                    return res.status(404).json({ error: 'Room not found in this residence' });
                }

                // Check room availability using accurate occupancy (exclude expired/forfeited/cancelled)
                const RoomOccupancyUtils = require('../../utils/roomOccupancyUtils');
                const occ = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residence._id, roomNumber);
                if (occ.currentOccupancy >= occ.capacity) {
                    console.log('❌ Room at full capacity (accurate):', roomNumber, occ);
                    // Try to sync occupancy just in case and re-evaluate once
                    await RoomOccupancyUtils.updateRoomOccupancy(residence._id, roomNumber);
                    const occ2 = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residence._id, roomNumber);
                    if (occ2.currentOccupancy >= occ2.capacity) {
                        return res.status(400).json({ error: 'Room is at full capacity' });
                    }
                }

                console.log('✅ Room validation passed:', {
                    roomNumber,
                    residenceName: residence.name,
                    currentOccupancy: room.currentOccupancy,
                    capacity: room.capacity
                });

                // Update application status and details
                application.status = 'approved';
                application.actionDate = new Date();
                application.actionBy = req.user._id;
                application.allocatedRoom = roomNumber;
                
                // Handle allocatedRoomDetails with proper error handling for schema mismatch
                try {
                    application.allocatedRoomDetails = {
                        roomNumber: roomNumber,
                        roomId: room._id,
                        price: room.price,
                        type: room.type,
                        capacity: room.capacity
                    };
                    
                    await application.save();
                    console.log('✅ Application saved successfully with allocatedRoomDetails');
                } catch (validationError) {
                    console.log('⚠️  Error saving application, trying to fix allocatedRoomDetails...');
                    console.log('🔧 Fixing allocatedRoomDetails validation error...');
                    
                    // Clear the problematic field first
                    application.allocatedRoomDetails = undefined;
                    await application.save();
                    
                    // Now try to set it again with the correct structure
                    try {
                        application.allocatedRoomDetails = {
                            roomNumber: roomNumber,
                            roomId: room._id,
                            price: room.price,
                            type: room.type,
                            capacity: room.capacity
                        };
                        await application.save();
                        console.log('✅ Application saved successfully after fixing allocatedRoomDetails');
                    } catch (secondError) {
                        console.log('⚠️  Still having issues with allocatedRoomDetails, saving without it...');
                        console.log('   Error details:', secondError.message);
                        // Save without allocatedRoomDetails to avoid blocking the approval
                        application.allocatedRoomDetails = undefined;
                        await application.save();
                        console.log('✅ Application saved without allocatedRoomDetails');
                    }
                }

                // Set admin approval
                application.approval.admin = {
                    approved: true,
                    approvedBy: req.user._id,
                    approvedByEmail: req.user.email,
                    approvedAt: new Date(),
                    notes: `Application approved by ${req.user.firstName} ${req.user.lastName}`
                };

                // Calculate validity period (4 months from now)
                const approvalDate = new Date();
                const validUntil = new Date(approvalDate);
                validUntil.setMonth(approvalDate.getMonth() + 4);

                if (application.requestType === 'upgrade') {
                    console.log('🔄 Processing room upgrade...');
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
                console.log('✅ Residence updated with new manager and room occupancy');

                // Handle student user creation/update for re-applications
                let student = null;
                
                if (isReapplication && application.previousStudentId) {
                    console.log('🔄 Finding existing student for re-application...');
                    // This is a re-application - find existing student
                    student = await User.findById(application.previousStudentId);
                    if (student) {
                        console.log(`✅ Found existing student for re-application: ${student.email}`);
                        
                        // Update existing student with new room and residence
                        await User.findByIdAndUpdate(student._id, {
                            $set: {
                                currentRoom: roomNumber,
                                roomValidUntil: validUntil,
                                roomApprovalDate: approvalDate,
                                residence: residence._id
                            }
                        });
                        
                        console.log(`✅ Updated existing student with new room: ${roomNumber}`);
                    }
                }
                
                // If no existing student found or this is a new application, check by email first
                if (!student) {
                    console.log('🔍 Checking for existing student by email...');
                    // Check if a user with this email already exists
                    student = await User.findOne({ email: application.email });
                    
                    if (student) {
                        console.log(`✅ Found existing student by email: ${student.email}`);
                        
                        // Update existing student with new room and residence
                        await User.findByIdAndUpdate(student._id, {
                            $set: {
                                currentRoom: roomNumber,
                                roomValidUntil: validUntil,
                                roomApprovalDate: approvalDate,
                                residence: residence._id,
                                role: 'student', // Ensure they have student role
                                isVerified: true
                            }
                        });
                        
                        console.log(`✅ Updated existing student with new room: ${roomNumber}`);
                    } else {
                        console.log('🆕 Creating new student user...');
                        // Create new student user
                        student = new User({
                            email: application.email,
                            firstName: application.firstName,
                            lastName: application.lastName,
                            phone: application.phone,
                            password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4),
                            role: 'student',
                            isVerified: true,
                            currentRoom: roomNumber,
                            roomValidUntil: validUntil,
                            roomApprovalDate: approvalDate,
                            residence: residence._id,
                            applicationCode: application.applicationCode
                        });
                        
                        await student.save();
                        console.log(`✅ Created new student user: ${student.email}`);
                    }
                }

                // Update application with residence reference and student link
                application.residence = residence._id;
                application.student = student._id;
                
                // Try to save the application with error handling for validation issues
                try {
                    await application.save();
                    console.log('✅ Application updated with residence and student links');
                } catch (saveError) {
                    console.log('⚠️  Error saving application:', saveError.message);
                    // If it's a different error, re-throw it
                    throw saveError;
                }

                // Create or update debtor account for the student
                try {
                    console.log(`🏗️  Creating/updating debtor account for student: ${student.email}`);
                    
                    const { createDebtorForStudent } = require('../../services/debtorService');
                    
                    // Pass re-application information to debtor service
                    const debtorOptions = {
                        residenceId: residence._id,
                        roomNumber: roomNumber,
                        createdBy: req.user._id,
                        startDate: application.startDate,
                        endDate: application.endDate,
                        roomPrice: room.price,
                        application: application._id,
                        applicationCode: application.applicationCode,
                        isReapplication: isReapplication,
                        previousDebtorCode: previousDebtorCode
                    };
                    
                    const debtor = await createDebtorForStudent(student, debtorOptions);
                    
                    if (debtor) {
                        console.log(`✅ Debtor account ${isReapplication ? 'updated' : 'created'}: ${debtor.debtorCode}`);
                        
                        // Link the debtor back to the application
                        application.debtor = debtor._id;
                        await application.save();
                        console.log(`🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                        
                        // 🆕 TRIGGER RENTAL ACCRUAL SERVICE - Lease starts now!
                        try {
                            console.log(`🏠 Triggering rental accrual service for lease start...`);
                            const RentalAccrualService = require('../../services/rentalAccrualService');
                            
                            const accrualResult = await RentalAccrualService.processLeaseStart(application);
                            
                            if (accrualResult && accrualResult.success) {
                                console.log(`✅ Rental accrual service completed successfully`);
                                console.log(`   - Initial accounting entries created`);
                                console.log(`   - Prorated rent, admin fees, and deposits recorded`);
                                console.log(`   - Lease start transaction: ${accrualResult.transactionId || 'N/A'}`);
                            } else {
                                console.log(`⚠️  Rental accrual service completed with warnings:`, accrualResult?.error || 'Unknown issue');
                            }
                        } catch (accrualError) {
                            console.error(`❌ Error in rental accrual service:`, accrualError);
                            console.log(`ℹ️  Application approved but rental accrual failed. Manual intervention may be needed.`);
                        }
                    } else {
                        console.log(`⚠️  Debtor creation returned null/undefined`);
                    }
                } catch (debtorError) {
                    console.error(`❌ Error creating/updating debtor account:`, debtorError);
                    console.log(`ℹ️  Application approved but debtor creation failed. Manual intervention may be needed.`);
                    console.log(`   Error details:`, debtorError.message);
                    // Don't fail the approval if debtor creation fails
                }

                // Send approval email
                const emailContent = `
                    Dear ${application.firstName} ${application.lastName},

                    Congratulations! Your application for Alamait Student Accommodation has been approved.

                    ${isReapplication ? `
                    🎉 Welcome back! Your re-application has been approved.
                    Your previous financial history has been preserved and linked to your new lease.
                    ` : ''}

                    Application Details:
                    - Application Code: ${application.applicationCode}
                    - Room: ${roomNumber}
                    - Residence: ${residence.name}
                    - Room Type: ${room.type}
                    - Monthly Rent: $${room.price}
                    - Approval Date: ${approvalDate.toLocaleDateString()}

                    ${isReapplication ? `
                    💰 Financial Continuity:
                    Your previous payment history and financial records have been maintained.
                    This ensures continuity in your accommodation account.
                    ` : ''}

                    Please complete your lease agreement and payment to secure your room.

                    Best regards,
                    Alamait Student Accommodation Team
                `;

                try {
                    const { sendEmail } = require('../../utils/email');
                    await sendEmail({
                        to: application.email,
                        subject: `Application Approved - Alamait Student Accommodation`,
                        text: emailContent
                    });
                    console.log(`✅ Approval email sent to: ${application.email}`);
                } catch (emailError) {
                    console.log(`⚠️  Failed to send approval email:`, emailError.message);
                    console.log(`ℹ️  Application approved but email notification failed.`);
                }

                console.log('✅ Application approval completed successfully');
                res.json({
                    success: true,
                    message: `Application approved successfully${isReapplication ? ' (Re-application)' : ''}`,
                    data: {
                        applicationId: application._id,
                        status: application.status,
                        allocatedRoom: roomNumber,
                        residence: residence.name,
                        studentId: student._id,
                        debtorCode: application.debtor ? 'Created' : 'Pending',
                        isReapplication: isReapplication
                    }
                });
                break;

            case 'reject':
                console.log('❌ Processing rejection...');
                application.status = 'rejected';
                
                // Send rejection email
                try {
                    const { sendEmail } = require('../../utils/email');
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
                    console.log(`✅ Rejection email sent to: ${application.email}`);
                } catch (emailError) {
                    console.log(`⚠️  Failed to send rejection email:`, emailError.message);
                }

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
                console.log('✅ Application rejection completed');
                res.json({ 
                    message: 'Application rejected successfully',
                    application
                });
                break;

            case 'waitlist':
                console.log('⏳ Processing waitlist...');
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
                try {
                    const { sendEmail } = require('../../utils/email');
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
                    console.log(`✅ Waitlist email sent to: ${application.email}`);
                } catch (emailError) {
                    console.log(`⚠️  Failed to send waitlist email:`, emailError.message);
                }
                
                await application.save();
                console.log('✅ Application waitlist completed');
                res.json({ 
                    message: 'Application waitlisted successfully',
                    application,
                    room: waitlistRoomInfo
                });
                break;

            default:
                console.log('❌ Invalid action:', action);
                return res.status(400).json({ error: 'Invalid action' });
        }

        // After saving/updating application
        try {
            await User.updateOne(
                { email: application.email },
                {
                    $set: {
                        residence: application.roomOccupancy?.residence,
                        currentRoom: application.allocatedRoom
                    }
                }
            );
            console.log('✅ User record updated');
        } catch (userUpdateError) {
            console.log('⚠️  Failed to update user record:', userUpdateError.message);
            console.log('ℹ️  Application approved but user record update failed.');
        }
        
    } catch (error) {
        console.error('❌ Error in updateApplicationStatus:', error);
        console.error('Error stack:', error.stack);
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
        
        // Only check capacity for non-approved applications (use accurate occupancy)
        if (application.status !== 'approved') {
            const RoomOccupancyUtils = require('../../utils/roomOccupancyUtils');
            const occ = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(residence._id, application.allocatedRoom);
            if (occ.currentOccupancy >= occ.capacity) {
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
        
        const { Residence } = require('../../models/Residence');
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