const Application = require('../../models/Application');
const { sendEmail } = require('../../utils/email');
const whatsappService = require('../../services/whatsappService');
const User = require('../../models/User');
const ExpiredStudent = require('../../models/ExpiredStudent');
const { Residence } = require('../../models/Residence');
const Debtor = require('../../models/Debtor');
const { validationResult } = require('express-validator');

// Submit new application
exports.submitApplication = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            requestType = 'new', // Default to 'new' if not provided
            preferredRoom,
            reason,
            residence,
            startDate,
            endDate,
            alternateRooms,
            additionalInfo
        } = req.body;

        // Check if this is a re-application from an existing student
        let existingUser = await User.findOne({ email: email.toLowerCase() });
        let isReapplication = false;
        let previousDebtor = null;
        let previousFinancialHistory = null;

        if (existingUser) {
            console.log(`🔄 Re-application detected for existing student: ${email}`);
            isReapplication = true;
            
            // Check if user has previous financial history (debtor account)
            previousDebtor = await Debtor.findOne({ user: existingUser._id });
            
            if (previousDebtor) {
                console.log(`💰 Found previous debtor account: ${previousDebtor.debtorCode}`);
                console.log(`   Previous balance: ${previousDebtor.currentBalance}`);
                console.log(`   Total paid: ${previousDebtor.totalPaid}`);
                console.log(`   Total owed: ${previousDebtor.totalOwed}`);
                
                // Get previous financial history from transactions
                const { Transaction } = require('../../models/Transaction');
                const previousTransactions = await Transaction.find({
                    'metadata.applicationId': { $exists: true },
                    $or: [
                        { 'metadata.applicationId': previousDebtor.applicationCode },
                        { 'metadata.applicationId': existingUser._id.toString() }
                    ]
                }).sort({ date: -1 }).limit(10);
                
                previousFinancialHistory = {
                    debtorCode: previousDebtor.debtorCode,
                    previousBalance: previousDebtor.currentBalance,
                    totalPaid: previousDebtor.totalPaid,
                    totalOwed: previousDebtor.totalOwed,
                    lastPaymentDate: previousDebtor.lastPaymentDate,
                    lastPaymentAmount: previousDebtor.lastPaymentAmount,
                    transactionCount: previousTransactions.length,
                    recentTransactions: previousTransactions.map(t => ({
                        date: t.date,
                        description: t.description,
                        amount: t.totalDebit || t.totalCredit,
                        type: t.source
                    }))
                };
                
                console.log(`📊 Previous financial summary:`, previousFinancialHistory);
            }
            
            // Check if user has any active applications or leases that haven't ended
            const activeApplication = await Application.findOne({
                email: email.toLowerCase(),
                status: { $in: ['pending', 'approved', 'waitlisted'] }
            });
            
            if (activeApplication) {
                return res.status(400).json({ 
                    error: 'You already have an active application. Please wait for the current application to be processed.',
                    existingApplication: {
                        id: activeApplication._id,
                        status: activeApplication.status,
                        applicationCode: activeApplication.applicationCode,
                        submittedDate: activeApplication.applicationDate
                    }
                });
            }
            
            // Check if user has any approved applications with leases that haven't ended yet
            const currentDate = new Date();
            const activeLease = await Application.findOne({
                email: email.toLowerCase(),
                status: 'approved',
                endDate: { $gt: currentDate } // Lease hasn't ended yet
            });
            
            if (activeLease) {
                return res.status(400).json({ 
                    error: 'You currently have an active lease that hasn\'t ended yet. Please wait until your lease ends to apply again.',
                    existingLease: {
                        id: activeLease._id,
                        applicationCode: activeLease.applicationCode,
                        startDate: activeLease.startDate,
                        endDate: activeLease.endDate,
                        daysRemaining: Math.ceil((new Date(activeLease.endDate) - currentDate) / (1000 * 60 * 60 * 24))
                    }
                });
            }
        }

        // Handle residence - if not provided, find the first available residence
        let residenceId = residence;
        if (!residenceId) {
            const defaultResidence = await Residence.findOne().select('_id');
            if (!defaultResidence) {
                return res.status(400).json({ error: 'No residence available for applications' });
            }
            residenceId = defaultResidence._id;
        }

        // Generate unique application code
        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Create application with re-application metadata
        const applicationData = {
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            requestType,
            preferredRoom,
            reason,
            residence: residenceId,
            startDate,
            endDate,
            alternateRooms,
            additionalInfo,
            applicationCode,
            status: 'pending',
            applicationDate: new Date(),
            // Add re-application metadata
            isReapplication: isReapplication,
            previousStudentId: existingUser?._id || null,
            previousDebtorCode: previousDebtor?.debtorCode || null,
            previousFinancialSummary: previousFinancialHistory
        };

        // If this is a re-application, link to existing user
        if (isReapplication && existingUser) {
            applicationData.student = existingUser._id;
            applicationData.requestType = 'renewal'; // Mark as renewal for admin processing
        }

        const application = new Application(applicationData);
        await application.save();

        console.log(`✅ Application ${isReapplication ? 're-' : ''}submitted successfully:`, {
            applicationCode: application.applicationCode,
            email: application.email,
            isReapplication: application.isReapplication,
            previousDebtorCode: application.previousDebtorCode
        });

        // Send confirmation email with re-application context
        const emailContent = `
            Dear ${firstName} ${lastName},

            Thank you for ${isReapplication ? 're-' : ''}submitting your application to Alamait Student Accommodation.
            
            ${isReapplication ? `
            📋 Re-Application Details:
            - This is a renewal application for your accommodation
            - Your previous financial history will be preserved
            - Previous debtor account: ${previousDebtor?.debtorCode || 'N/A'}
            - Previous balance: $${previousDebtor?.currentBalance || 0}
            - Total amount paid in previous lease: $${previousDebtor?.totalPaid || 0}
            ` : ''}
            
            Application Details:
            - Application Code: ${application.applicationCode}
            - Preferred Room: ${preferredRoom}
            ${reason ? `- Reason: ${reason}` : ''}
            ${startDate ? `- Desired Start Date: ${new Date(startDate).toLocaleDateString()}` : ''}
            ${endDate ? `- Desired End Date: ${new Date(endDate).toLocaleDateString()}` : ''}
            ${additionalInfo?.gender ? `- Gender: ${additionalInfo.gender}` : ''}
            ${additionalInfo?.dateOfBirth ? `- Date of Birth: ${new Date(additionalInfo.dateOfBirth).toLocaleDateString()}` : ''}
            ${additionalInfo?.specialRequirements ? `- Special Requirements: ${additionalInfo.specialRequirements}` : ''}
            
            ${isReapplication ? `
            💰 Financial History Preserved:
            Your previous payment history and financial records will be maintained.
            This ensures continuity in your accommodation account.
            ` : ''}
            
            Please keep this email for your records.
            
            Best regards,
            Alamait Student Accommodation Team
        `;

        await sendEmail({
            to: email,
            subject: `${isReapplication ? 'Re-' : ''}Application Received - Alamait Student Accommodation`,
            text: emailContent
        });

        // Send WhatsApp confirmation
        try {
            await whatsappService.sendMessage({
                to: phone,
                message: `Hi ${firstName}! Your ${isReapplication ? 're-' : ''}application for Alamait Student Accommodation has been received. Application Code: ${application.applicationCode}. We'll notify you once it's reviewed.`
            });
        } catch (whatsappError) {
            console.log('WhatsApp notification failed:', whatsappError.message);
        }

        // Return response with re-application context
        res.status(201).json({
            success: true,
            message: `Application ${isReapplication ? 're-' : ''}submitted successfully`,
            data: {
                applicationCode: application.applicationCode,
                email: application.email,
                status: application.status,
                isReapplication: application.isReapplication,
                previousFinancialSummary: application.previousFinancialSummary,
                message: isReapplication ? 
                    'Welcome back! Your previous financial history will be preserved.' : 
                    'New application submitted successfully.'
            }
        });

    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({ 
            error: 'Failed to submit application',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get application status
exports.getApplicationStatus = async (req, res) => {
    try {
        const { email } = req.params;

        const application = await Application.findOne({ email })
            .populate('residence', 'name address')
            .lean();

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json({
            success: true,
            application: {
                applicationCode: application.applicationCode,
                status: application.status,
                requestType: application.requestType,
                preferredRoom: application.preferredRoom,
                allocatedRoom: application.allocatedRoom,
                waitlistedRoom: application.waitlistedRoom,
                applicationDate: application.applicationDate,
                residence: application.residence
            }
        });
    } catch (error) {
        console.error('Error getting application status:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Check email usage
exports.checkEmailUsage = async (req, res) => {
    try {
        const email = req.params.email || req.query.email;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const application = await Application.findOne({ email });
        const user = await User.findOne({ email });

        res.json({
            success: true,
            emailExists: !!(application || user),
            hasApplication: !!application,
            hasUser: !!user
        });
    } catch (error) {
        console.error('Error checking email usage:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get public application data with room occupancy status
exports.getPublicApplicationData = async (req, res) => {
    try {
        const { residence, status, type } = req.query;

        // Build query for applications
        const applicationQuery = {};
        if (status) applicationQuery.status = status;
        if (type) applicationQuery.requestType = type;

        // Get applications with basic info (no sensitive data)
        const applications = await Application.find(applicationQuery)
            .select('applicationCode status requestType preferredRoom allocatedRoom waitlistedRoom applicationDate residence')
            .populate('residence', 'name address')
            .sort({ applicationDate: -1 })
            .lean();

        // Get all residences with room information
        const residenceQuery = {};
        if (residence) residenceQuery.name = { $regex: residence, $options: 'i' };

        const residences = await Residence.find(residenceQuery)
            .select('name address rooms.roomNumber rooms.type rooms.capacity rooms.price rooms.status rooms.currentOccupancy rooms.features rooms.floor rooms.area')
            .lean();

        // Calculate occupancy based on approved applications
        const approvedApplications = applications.filter(app => app.status === 'approved');
        const allocatedRooms = new Set();
        const waitlistedRooms = new Set();
        
        // Track allocated and waitlisted rooms from applications
        approvedApplications.forEach(app => {
            if (app.allocatedRoom) {
                allocatedRooms.add(app.allocatedRoom);
            }
            if (app.waitlistedRoom) {
                waitlistedRooms.add(app.waitlistedRoom);
            }
        });

        // Create room status map based on actual applications
        const roomStatusMap = {};
        const roomDetails = [];

        residences.forEach(residence => {
            residence.rooms.forEach(room => {
                const roomKey = `${residence.name}-${room.roomNumber}`;
                
                // Determine room status based on applications
                let actualStatus = 'available';
                let isAllocated = false;
                let isWaitlisted = false;
                
                if (allocatedRooms.has(room.roomNumber)) {
                    actualStatus = 'occupied';
                    isAllocated = true;
                } else if (waitlistedRooms.has(room.roomNumber)) {
                    actualStatus = 'reserved';
                    isWaitlisted = true;
                }

                // Get applications for this room
                const roomApplications = approvedApplications.filter(app => 
                    app.allocatedRoom === room.roomNumber || app.waitlistedRoom === room.roomNumber
                );

                roomStatusMap[roomKey] = {
                    residenceId: residence._id,
                    residenceName: residence.name,
                    residenceAddress: residence.address,
                    roomNumber: room.roomNumber,
                    type: room.type,
                    capacity: room.capacity,
                    currentOccupancy: isAllocated ? 1 : 0,
                    price: room.price,
                    status: actualStatus,
                    features: room.features,
                    floor: room.floor,
                    area: room.area,
                    occupancyRate: room.capacity > 0 ? (isAllocated ? 100 : 0) : 0,
                    isAvailable: actualStatus === 'available',
                    isOccupied: isAllocated,
                    isReserved: isWaitlisted,
                    isMaintenance: false,
                    // Application-based data
                    allocatedApplications: roomApplications.filter(app => app.allocatedRoom === room.roomNumber),
                    waitlistedApplications: roomApplications.filter(app => app.waitlistedRoom === room.roomNumber),
                    totalApplications: roomApplications.length
                };

                roomDetails.push({
                    id: roomKey,
                    ...roomStatusMap[roomKey]
                });
            });
        });

        // Calculate overall statistics based on applications
        const totalRooms = roomDetails.length;
        const availableRooms = roomDetails.filter(room => room.isAvailable).length;
        const occupiedRooms = roomDetails.filter(room => room.isOccupied).length;
        const reservedRooms = roomDetails.filter(room => room.isReserved).length;
        const maintenanceRooms = roomDetails.filter(room => room.isMaintenance).length;

        // Calculate occupancy by residence based on applications
        const residenceStats = residences.map(res => {
            const rooms = res.rooms;
            const totalRoomsInResidence = rooms.length;
            
            // Count rooms based on actual applications
            const availableRoomsInResidence = rooms.filter(r => 
                !allocatedRooms.has(r.roomNumber) && !waitlistedRooms.has(r.roomNumber)
            ).length;
            
            const occupiedRoomsInResidence = rooms.filter(r => 
                allocatedRooms.has(r.roomNumber)
            ).length;
            
            const reservedRoomsInResidence = rooms.filter(r => 
                waitlistedRooms.has(r.roomNumber)
            ).length;
            
            const maintenanceRoomsInResidence = 0; // No maintenance rooms tracked in applications

            return {
                id: res._id,
                name: res.name,
                address: res.address,
                totalRooms: totalRoomsInResidence,
                availableRooms: availableRoomsInResidence,
                occupiedRooms: occupiedRoomsInResidence,
                reservedRooms: reservedRoomsInResidence,
                maintenanceRooms: maintenanceRoomsInResidence,
                occupancyRate: totalRoomsInResidence > 0 ? 
                    ((occupiedRoomsInResidence + reservedRoomsInResidence) / totalRoomsInResidence) * 100 : 0,
                // Application-based statistics
                totalApplications: approvedApplications.filter(app => 
                    app.residence && app.residence._id.toString() === res._id.toString()
                ).length,
                allocatedApplications: approvedApplications.filter(app => 
                    app.residence && app.residence._id.toString() === res._id.toString() && app.allocatedRoom
                ).length,
                waitlistedApplications: approvedApplications.filter(app => 
                    app.residence && app.residence._id.toString() === res._id.toString() && app.waitlistedRoom
                ).length
            };
        });

        // Get application statistics
        const totalApplications = applications.length;
        const pendingApplications = applications.filter(app => app.status === 'pending').length;
        const approvedApplicationsCount = approvedApplications.length;
        const waitlistedApplications = applications.filter(app => app.status === 'waitlisted').length;
        const rejectedApplications = applications.filter(app => app.status === 'rejected').length;

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            statistics: {
                rooms: {
                    total: totalRooms,
                    available: availableRooms,
                    occupied: occupiedRooms,
                    reserved: reservedRooms,
                    maintenance: maintenanceRooms,
                    overallOccupancyRate: totalRooms > 0 ? ((occupiedRooms + reservedRooms) / totalRooms) * 100 : 0
                },
                applications: {
                    total: totalApplications,
                    pending: pendingApplications,
                    approved: approvedApplicationsCount,
                    waitlisted: waitlistedApplications,
                    rejected: rejectedApplications,
                    // Application-based occupancy
                    allocatedRooms: allocatedRooms.size,
                    waitlistedRooms: waitlistedRooms.size,
                    occupancyBasedOnApplications: true
                }
            },
            residences: residenceStats,
            rooms: roomDetails,
            applications: applications.map(app => ({
                applicationCode: app.applicationCode,
                status: app.status,
                requestType: app.requestType,
                preferredRoom: app.preferredRoom,
                allocatedRoom: app.allocatedRoom,
                waitlistedRoom: app.waitlistedRoom,
                applicationDate: app.applicationDate,
                residence: app.residence ? {
                    id: app.residence._id,
                    name: app.residence.name,
                    address: app.residence.address
                } : null
            }))
        });
    } catch (error) {
        console.error('Error getting public application data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error',
            message: error.message 
        });
    }
}; 