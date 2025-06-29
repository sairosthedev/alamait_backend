const Application = require('../../models/Application');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get all applications (for finance)
exports.getAllApplications = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            type,
            sortBy = 'applicationDate',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (status) {
            filter.status = status;
        }
        
        if (type) {
            filter.requestType = type;
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count for pagination
        const total = await Application.countDocuments(filter);
        
        // Get applications with pagination
        const applications = await Application.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get all residences to check room status
        const residences = await Residence.find({}, 'name rooms');
        
        // Create a map of room statuses
        const roomStatusMap = {};
        residences.forEach(residence => {
            residence.rooms.forEach(room => {
                roomStatusMap[room.roomNumber] = {
                    residence: residence.name,
                    status: room.status,
                    currentOccupancy: room.currentOccupancy,
                    capacity: room.capacity,
                    price: room.price,
                    type: room.type
                };
            });
        });

        // Format applications for response
        const formattedApplications = applications.map(app => {
            // Get room details for current and requested rooms
            const currentRoomDetails = app.currentRoom ? roomStatusMap[app.currentRoom] : null;
            const requestedRoomDetails = app.requestedRoom ? roomStatusMap[app.requestedRoom] : null;
            const allocatedRoomDetails = app.allocatedRoom ? roomStatusMap[app.allocatedRoom] : null;
            
            // Calculate price difference for upgrades
            let priceDifference = null;
            if (app.requestType === 'upgrade' && currentRoomDetails && requestedRoomDetails) {
                priceDifference = requestedRoomDetails.price - currentRoomDetails.price;
            }
            
            return {
                id: app._id,
                studentName: app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : 'N/A',
                email: app.email,
                contact: app.phone,
                requestType: app.requestType,
                status: app.status,
                paymentStatus: app.paymentStatus,
                applicationDate: app.applicationDate ? app.applicationDate.toISOString().split('T')[0] : null,
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
                applicationCode: app.applicationCode,
                priceDifference: priceDifference
            };
        });

        res.json({
            applications: formattedApplications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getAllApplications:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single application (for finance)
exports.getApplication = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id).lean();

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Get residence details if room is allocated
        let residenceDetails = null;
        if (application.allocatedRoom) {
            const residence = await Residence.findOne({
                'rooms.roomNumber': application.allocatedRoom
            }).select('name address rooms').lean();
            
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
                residenceDetails = {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address,
                    room: room ? {
                        roomNumber: room.roomNumber,
                        type: room.type,
                        price: room.price,
                        status: room.status,
                        currentOccupancy: room.currentOccupancy,
                        capacity: room.capacity
                    } : null
                };
            }
        }

        const formattedApplication = {
            id: application._id,
            studentName: application.firstName && application.lastName ? `${application.firstName} ${application.lastName}` : 'N/A',
            email: application.email,
            contact: application.phone,
            requestType: application.requestType,
            status: application.status,
            paymentStatus: application.paymentStatus,
            applicationDate: application.applicationDate ? application.applicationDate.toISOString().split('T')[0] : null,
            startDate: application.startDate ? application.startDate.toISOString().split('T')[0] : null,
            endDate: application.endDate ? application.endDate.toISOString().split('T')[0] : null,
            preferredRoom: application.preferredRoom,
            alternateRooms: application.alternateRooms || [],
            currentRoom: application.currentRoom,
            requestedRoom: application.requestedRoom,
            reason: application.reason,
            allocatedRoom: application.allocatedRoom,
            applicationCode: application.applicationCode,
            residence: residenceDetails
        };

        res.json(formattedApplication);
    } catch (error) {
        console.error('Finance: Error in getApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get application statistics (for finance)
exports.getApplicationStats = async (req, res) => {
    try {
        const { status, type } = req.query;
        
        console.log('Finance: Getting application stats with filters:', { status, type });
        
        // Build filter object
        const filter = {};
        
        if (status) {
            filter.status = status;
        }
        
        if (type) {
            filter.requestType = type;
        }

        console.log('Finance: Using filter:', filter);

        // Get total applications
        const totalApplications = await Application.countDocuments(filter);
        console.log('Finance: Total applications found:', totalApplications);
        
        // Get applications by status
        const applicationsByStatus = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        console.log('Finance: Applications by status:', applicationsByStatus);
        
        // Get applications by type
        const applicationsByType = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$requestType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('Finance: Applications by type:', applicationsByType);

        // Get applications by month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const applicationsByMonth = await Application.aggregate([
            { 
                $match: { 
                    ...filter,
                    applicationDate: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$applicationDate' },
                        month: { $month: '$applicationDate' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        console.log('Finance: Applications by month:', applicationsByMonth);

        // Get recent applications (last 5) - without population to avoid User model issues
        const recentApplications = await Application.find(filter)
            .sort({ applicationDate: -1 })
            .limit(5)
            .lean();

        console.log('Finance: Recent applications found:', recentApplications.length);

        const formattedRecentApplications = recentApplications.map(app => ({
            id: app._id,
            studentName: app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : 'N/A',
            requestType: app.requestType,
            status: app.status,
            applicationDate: app.applicationDate ? app.applicationDate.toISOString().split('T')[0] : null
        }));

        const response = {
            totalApplications,
            applicationsByStatus,
            applicationsByType,
            applicationsByMonth,
            recentApplications: formattedRecentApplications
        };

        console.log('Finance: Sending response:', response);

        res.json(response);
    } catch (error) {
        console.error('Finance: Error in getApplicationStats:', error);
        console.error('Finance: Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}; 