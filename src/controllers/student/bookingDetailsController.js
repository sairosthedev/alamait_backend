const Booking = require('../../models/Booking');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const { sendEmail } = require('../../utils/email');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const Lease = require('../../models/Lease');
const EmailNotificationService = require('../../services/emailNotificationService');

// Get current booking
exports.getCurrentBooking = async (req, res) => {
    try {
        ('Getting current booking for user:', {
            userId: req.user?._id,
            email: req.user?.email,
            role: req.user?.role,
            fullUser: req.user
        });
        
        if (!req.user || !req.user._id || !req.user.email) {
            console.error('User object is missing or invalid:', {
                user: req.user,
                headers: req.headers
            });
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // First check for active booking
        try {
            ('Querying for active booking with criteria:', {
                student: req.user._id,
                status: 'active'
            });

            const currentBooking = await Booking.findOne({
                student: req.user._id,
                status: 'active'
            })
            .populate('residence', 'name address image');

            ('Current booking query result:', {
                found: !!currentBooking,
                booking: currentBooking ? {
                    id: currentBooking._id,
                    student: currentBooking.student,
                    status: currentBooking.status,
                    roomNumber: currentBooking.room?.roomNumber
                } : null
            });

            if (currentBooking) {
                ('Found active booking:', {
                    bookingId: currentBooking._id,
                    roomNumber: currentBooking.room?.roomNumber,
                    status: currentBooking.status,
                    student: currentBooking.student
                });
                
                return res.json({
                    success: true,
                    booking: {
                        id: currentBooking._id,
                        roomNumber: currentBooking.room?.roomNumber || 'N/A',
                        roomType: currentBooking.room?.type || 'N/A',
                        startDate: currentBooking.startDate,
                        endDate: currentBooking.endDate,
                        monthlyRent: currentBooking.room?.price || 0,
                        status: currentBooking.status,
                        image: currentBooking.residence?.image || '',
                        features: currentBooking.room?.features || []
                    }
                });
            }
        } catch (bookingError) {
            console.error('Error querying current booking:', {
                error: bookingError.message,
                stack: bookingError.stack
            });
            // Continue to check for approved application
        }

        ('No active booking found, checking for approved application');
        
        // If no active booking, check for approved application
        try {
            const applicationQuery = {
                $or: [
                    { student: req.user._id },
                    { email: req.user.email }
                ],
                status: 'approved',
                applicationCode: { $exists: true }
            };

            ('Querying for approved application with criteria:', applicationQuery);

            const approvedApplication = await Application.findOne(applicationQuery)
                .sort({ actionDate: -1 });

            ('Approved application query result:', {
                found: !!approvedApplication,
                application: approvedApplication ? {
                    id: approvedApplication._id,
                    student: approvedApplication.student,
                    email: approvedApplication.email,
                    status: approvedApplication.status,
                    applicationCode: approvedApplication.applicationCode
                } : null
            });

            if (approvedApplication) {
                ('Found approved application:', {
                    applicationId: approvedApplication._id,
                    applicationCode: approvedApplication.applicationCode,
                    allocatedRoom: approvedApplication.allocatedRoom,
                    student: approvedApplication.student,
                    email: approvedApplication.email
                });
                
                // Get room details from the approved application
                const residence = await Residence.findOne({
                    'rooms.roomNumber': approvedApplication.allocatedRoom,
                    'rooms.status': 'occupied'
                }).select('name address image rooms').lean();

                if (!residence) {
                    ('Room not found by roomNumber, returning application details:', {
                        roomNumber: approvedApplication.allocatedRoom
                    });
                    
                    return res.json({
                        success: true,
                        booking: {
                            id: approvedApplication._id,
                            roomNumber: approvedApplication.allocatedRoom || 'N/A',
                            roomType: 'Standard', // Default type since we don't have room details
                            startDate: null,
                            endDate: null,
                            monthlyRent: 0, // Default price since we don't have room details
                            status: 'approved',
                            image: '', // Default empty image since we don't have room details
                            features: [], // Default empty features since we don't have room details
                            applicationCode: approvedApplication.applicationCode,
                            applicationDate: approvedApplication.applicationDate
                        }
                    });
                }

                const room = residence.rooms.find(r => r.roomNumber === approvedApplication.allocatedRoom);

                ('Found allocated room:', {
                    roomId: room._id,
                    roomNumber: room.roomNumber,
                    type: room.type
                });

                return res.json({
                    success: true,
                    booking: {
                        id: approvedApplication._id,
                        roomNumber: room.roomNumber || 'N/A',
                        roomType: room.type || 'N/A',
                        startDate: null,
                        endDate: null,
                        monthlyRent: room.price || 0,
                        status: 'approved',
                        image: residence.image || '',
                        features: room.features || [],
                        applicationCode: approvedApplication.applicationCode,
                        applicationDate: approvedApplication.applicationDate
                    }
                });
            }
        } catch (applicationError) {
            console.error('Error querying approved application:', {
                error: applicationError.message,
                stack: applicationError.stack
            });
        }

        // If no booking or application found, check for allocated room
        try {
            ('Checking for allocated room...');
            
            // First check user's currentRoom field
            if (req.user.currentRoom) {
                ('User has currentRoom:', req.user.currentRoom);
                const residence = await Residence.findOne({
                    'rooms.roomNumber': req.user.currentRoom,
                    'rooms.status': 'occupied'
                }).select('name address image rooms').lean();

                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === req.user.currentRoom);
                    
                    ('Found room from currentRoom field:', {
                        roomId: room._id,
                        roomNumber: room.roomNumber,
                        type: room.type,
                        price: room.price
                    });

                    return res.json({
                        success: true,
                        booking: {
                            id: room._id,
                            roomNumber: room.roomNumber || 'N/A',
                            roomType: room.type || 'N/A',
                            startDate: null,
                            endDate: null,
                            monthlyRent: room.price || 0,
                            status: 'occupied',
                            image: residence.image || '',
                            features: room.features || []
                        }
                    });
                }
            }
            
            // Then check for room with user in occupants
            const residenceWithOccupant = await Residence.findOne({
                'rooms.occupants': req.user._id,
                'rooms.status': 'occupied'
            }).select('name address image rooms').lean();

            if (residenceWithOccupant) {
                const allocatedRoom = residenceWithOccupant.rooms.find(r => 
                    r.occupants && r.occupants.some(occupant => occupant.toString() === req.user._id.toString())
                );

                ('Allocated room query result:', {
                    found: !!allocatedRoom,
                    room: allocatedRoom ? {
                        id: allocatedRoom._id,
                        roomNumber: allocatedRoom.roomNumber,
                        type: allocatedRoom.type,
                        price: allocatedRoom.price,
                        occupants: allocatedRoom.occupants
                    } : null
                });

                if (allocatedRoom) {
                    ('Found allocated room:', {
                        roomId: allocatedRoom._id,
                        roomNumber: allocatedRoom.roomNumber,
                        type: allocatedRoom.type,
                        price: allocatedRoom.price,
                        occupants: allocatedRoom.occupants
                    });

                    return res.json({
                        success: true,
                        booking: {
                            id: allocatedRoom._id,
                            roomNumber: allocatedRoom.roomNumber || 'N/A',
                            roomType: allocatedRoom.type || 'N/A',
                            startDate: null,
                            endDate: null,
                            monthlyRent: allocatedRoom.price || 0,
                            status: 'occupied',
                            image: residenceWithOccupant.image || '',
                            features: allocatedRoom.features || []
                        }
                    });
                }
            }

            // Finally check residence rooms
            const residence = await Residence.findOne({
                'rooms.currentOccupancy': req.user._id
            });

            if (residence) {
                const room = residence.rooms.find(r => r.currentOccupancy?.toString() === req.user._id.toString());
                if (room) {
                    ('Found room in residence:', {
                        residenceId: residence._id,
                        roomNumber: room.roomNumber,
                        type: room.type,
                        price: room.price
                    });

                    return res.json({
                        success: true,
                        booking: {
                            id: room._id || residence._id,
                            roomNumber: room.roomNumber || 'N/A',
                            roomType: room.type || 'N/A',
                            startDate: null,
                            endDate: null,
                            monthlyRent: room.price || 0,
                            status: 'occupied',
                            image: residence.image || '',
                            features: room.features || []
                        }
                    });
                }
            }
        } catch (roomError) {
            console.error('Error querying allocated room:', {
                error: roomError.message,
                stack: roomError.stack,
                userId: req.user._id
            });
        }

        ('No booking, application, or allocated room found');
        
        // If nothing found
        return res.status(404).json({ 
            success: false,
            message: 'No active booking or approved application found' 
        });
    } catch (error) {
        console.error('Error in getCurrentBooking:', {
            error: error.message,
            stack: error.stack,
            user: req.user ? {
                id: req.user._id,
                email: req.user.email,
                role: req.user.role
            } : 'No user object'
        });
        
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get booking history
exports.getBookingHistory = async (req, res) => {
    try {
        const bookingHistory = await Booking.find({
            student: req.user._id,
            status: { $in: ['completed', 'cancelled'] }
        })
        .sort({ endDate: -1 })
        .select('roomNumber roomType startDate endDate status');

        res.json({
            success: true,
            history: bookingHistory.map(booking => ({
                id: booking._id,
                roomNumber: booking.roomNumber,
                roomType: booking.roomType,
                startDate: booking.startDate,
                endDate: booking.endDate,
                status: booking.status
            }))
        });
    } catch (error) {
        console.error('Error in getBookingHistory:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// Get available rooms
exports.getAvailableRooms = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        ('Getting available rooms with dates:', { startDate, endDate });

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        // Get current booking to determine available rooms
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        }).populate('residence');

        ('Current booking:', {
            found: !!currentBooking,
            bookingId: currentBooking?._id,
            residenceId: currentBooking?.residence?._id
        });

        // Get current room number if booking exists
        const currentRoomNumber = currentBooking?.room?.roomNumber || currentBooking?.roomNumber;
        
        // If user has a current booking, only show rooms from the same residence
        if (currentBooking && currentBooking.residence) {
            // Find the residence with the current booking
            const residence = await Residence.findById(currentBooking.residence._id);
            
            if (!residence) {
                ('Residence not found for current booking');
                return res.status(404).json({
                    success: false,
                    message: 'Residence not found'
                });
            }
            
            ('Found residence:', {
                id: residence._id,
                name: residence.name,
                totalRooms: residence.rooms.length
            });
            
            // Filter available rooms in the same residence
            const availableRooms = residence.rooms.filter(room => {
                // Skip the current room
                if (room.roomNumber === currentRoomNumber) {
                    ('Skipping current room:', room.roomNumber);
                    return false;
                }
                
                // Determine if room is available based on occupancy
                const currentOccupancy = room.currentOccupancy || 0;
                const capacity = room.capacity || 1;
                const isAvailable = currentOccupancy < capacity;
                
                ('Room availability check:', {
                    roomNumber: room.roomNumber,
                    currentOccupancy,
                    capacity,
                    isAvailable
                });
                
                return isAvailable;
            });

            ('Available rooms found:', availableRooms.length);

            // Format rooms for response
            const formattedRooms = availableRooms.map(room => ({
                id: room._id || room.roomNumber,
                roomNumber: room.roomNumber,
                name: `Room ${room.roomNumber}`,
                type: room.type,
                price: room.price,
                features: room.features || [],
                amenities: room.amenities || [],
                size: room.area ? `${room.area} sq ft` : 'N/A',
                floor: room.floor || 'N/A',
                image: room.images && room.images.length > 0 ? room.images[0] : '',
                capacity: room.capacity || 1,
                currentOccupancy: room.currentOccupancy || 0,
                residenceName: residence.name,
                residenceId: residence._id,
                // Add more residence details
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address,
                    amenities: residence.amenities || [],
                    contactInfo: residence.contactInfo || {},
                    description: residence.description || '',
                    images: residence.images || []
                }
            }));

            return res.json({
                success: true,
                rooms: formattedRooms
            });
        } else {
            // If no current booking, fetch all residences and return all available rooms
            ('No current booking found, fetching all active residences');
            const residences = await Residence.find({ status: 'active' });
            
            ('Found active residences:', residences.length);
            
            let allAvailableRooms = [];
            
            // Collect all available rooms from all residences
            residences.forEach(residence => {
                ('Processing residence:', {
                    id: residence._id,
                    name: residence.name,
                    totalRooms: residence.rooms.length
                });
                
                const availableRooms = residence.rooms.filter(room => {
                    const currentOccupancy = room.currentOccupancy || 0;
                    const capacity = room.capacity || 1;
                    const isAvailable = currentOccupancy < capacity;
                    
                    ('Room availability check:', {
                        roomNumber: room.roomNumber,
                        currentOccupancy,
                        capacity,
                        isAvailable
                    });
                    
                    return isAvailable;
                });
                
                ('Available rooms found in residence:', {
                    residenceName: residence.name,
                    count: availableRooms.length
                });
                
                const formattedRooms = availableRooms.map(room => ({
                    id: room._id || room.roomNumber,
                    roomNumber: room.roomNumber,
                    name: `Room ${room.roomNumber}`,
                    type: room.type,
                    price: room.price,
                    features: room.features || [],
                    amenities: room.amenities || [],
                    size: room.area ? `${room.area} sq ft` : 'N/A',
                    floor: room.floor || 'N/A',
                    image: room.images && room.images.length > 0 ? room.images[0] : '',
                    capacity: room.capacity || 1,
                    currentOccupancy: room.currentOccupancy || 0,
                    residenceName: residence.name,
                    residenceId: residence._id,
                    // Add more residence details
                    residence: {
                        id: residence._id,
                        name: residence.name,
                        address: residence.address,
                        amenities: residence.amenities || [],
                        contactInfo: residence.contactInfo || {},
                        description: residence.description || '',
                        images: residence.images || []
                    }
                }));
                
                allAvailableRooms = [...allAvailableRooms, ...formattedRooms];
            });
            
            ('Total available rooms found:', allAvailableRooms.length);
            
            return res.json({
                success: true,
                rooms: allAvailableRooms
            });
        }
    } catch (error) {
        console.error('Error in getAvailableRooms:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get approved application
exports.getApprovedApplication = async (req, res) => {
    try {
        const application = await Application.findOne({
            email: req.user.email,
            status: 'approved',
            applicationCode: { $exists: true }
        }).sort({ actionDate: -1 });

        if (!application) {
            return res.status(404).json({ 
                success: false,
                message: 'No approved application found' 
            });
        }

        res.json({ 
            success: true,
            application: {
                applicationCode: application.applicationCode,
                allocatedRoom: application.allocatedRoom,
                applicationDate: application.applicationDate,
                status: application.status
            }
        });
    } catch (error) {
        console.error('Error in getApprovedApplication:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// Request room change
exports.requestRoomChange = async (req, res) => {
    try {
        const { roomId, startDate, endDate, currentBookingId } = req.body;

        // Validate request
        if (!roomId || !startDate || !endDate || !currentBookingId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get current booking
        const currentBooking = await Booking.findById(currentBookingId)
            .populate('residence');

        if (!currentBooking) {
            return res.status(404).json({
                success: false,
                message: 'Current booking not found'
            });
        }

        // Get current room details
        const currentRoomNumber = currentBooking.room?.roomNumber || currentBooking.roomNumber;
        const currentRoomPrice = currentBooking.room?.price || 0;

        // Find the residence with the current booking
        const residence = await Residence.findById(currentBooking.residence._id);
        
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Find the requested room in the residence
        const requestedRoom = residence.rooms.find(room => 
            room.roomNumber === roomId || room._id.toString() === roomId
        );

        if (!requestedRoom) {
            return res.status(404).json({
                success: false,
                message: 'Requested room not found'
            });
        }

        // Check if room is available
        const currentOccupancy = requestedRoom.currentOccupancy || 0;
        const capacity = requestedRoom.capacity || 1;
        
        if (currentOccupancy >= capacity) {
            // Re-check using accurate occupancy and sync once if needed
            const RoomOccupancyUtils = require('../../utils/roomOccupancyUtils');
            const occ = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(requestedRoom.residence, requestedRoom.roomNumber || requestedRoom.name);
            if (occ.currentOccupancy >= occ.capacity) {
                await RoomOccupancyUtils.updateRoomOccupancy(requestedRoom.residence, requestedRoom.roomNumber || requestedRoom.name);
                const occ2 = await RoomOccupancyUtils.calculateAccurateRoomOccupancy(requestedRoom.residence, requestedRoom.roomNumber || requestedRoom.name);
                if (occ2.currentOccupancy >= occ2.capacity) {
                    return res.status(400).json({ success: false, message: 'Room is at full capacity' });
                }
            }
        }

        // Create application for room change
        const application = new Application({
            student: req.user._id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            phone: req.user.phone,
            requestType: requestedRoom.price > currentRoomPrice ? 'upgrade' : 'downgrade',
            preferredRoom: requestedRoom.roomNumber,
            currentRoom: currentRoomNumber,
            reason: `Room ${requestedRoom.price > currentRoomPrice ? 'upgrade' : 'downgrade'} request from ${currentRoomNumber} to ${requestedRoom.roomNumber}`,
            status: 'pending',
            applicationDate: new Date(),
            residence: residence._id
        });

        await application.save();

        // Send room change request notification (non-blocking)
        try {
            await EmailNotificationService.sendRoomChangeRequestNotification(
                application, 
                requestedRoom, 
                currentRoomNumber, 
                req.user
            );
        } catch (emailError) {
            console.error('Failed to send room change request email notification:', emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Room change request submitted successfully',
            application: {
                id: application._id,
                requestType: application.requestType,
                preferredRoom: application.preferredRoom,
                currentRoom: application.currentRoom,
                status: application.status,
                applicationDate: application.applicationDate
            },
            room: {
                id: requestedRoom._id,
                roomNumber: requestedRoom.roomNumber,
                type: requestedRoom.type,
                price: requestedRoom.price,
                features: requestedRoom.features || [],
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address
                }
            }
        });
    } catch (error) {
        console.error('Error in requestRoomChange:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 