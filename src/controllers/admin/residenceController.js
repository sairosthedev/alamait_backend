const { validationResult } = require('express-validator');
const { Residence } = require('../../models/Residence');
const Application = require('../../models/Application');
const ResidencePaymentService = require('../../services/residencePaymentService');
const { body } = require('express-validator');

// Helper function to parse CSV room data
function parseCSVRoomData(csvData) {
    const lines = csvData.trim().split('\n');
    const rooms = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        const parts = line.split(',');
        if (parts.length < 7) {
            throw new Error(`Line ${i + 1}: Expected 7 fields, got ${parts.length}. Format: roomNumber,type,capacity,price,status,currentOccupancy,area`);
        }
        
        const [roomNumber, type, capacity, price, status, currentOccupancy, area] = parts.map(part => part.trim());
        
        // Convert string numbers to actual numbers
        const numCapacity = parseInt(capacity);
        const numPrice = parseFloat(price);
        const numCurrentOccupancy = parseInt(currentOccupancy);
        const numArea = parseFloat(area);
        
        // Validate conversions
        if (isNaN(numCapacity) || isNaN(numPrice) || isNaN(numCurrentOccupancy) || isNaN(numArea)) {
            throw new Error(`Line ${i + 1}: Invalid numeric values. Check capacity, price, currentOccupancy, and area.`);
        }
        
        rooms.push({
            roomNumber,
            type,
            capacity: numCapacity,
            price: numPrice,
            status,
            currentOccupancy: numCurrentOccupancy,
            floor: 1, // Default floor
            area: numArea,
            features: [],
            amenities: [],
            images: [],
            cleaningFrequency: 'weekly'
        });
    }
    
    return rooms;
}

// Helper function to validate room data
function validateRoomData(rooms) {
    const errors = [];
    const validRoomTypes = ['single', 'double', 'studio', 'apartment', 'triple', 'tripple', 'quad', 'Six-person room', 'six', 'fife'];
    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
    
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const roomIndex = i + 1;
        
        // Required fields
        if (!room.roomNumber) {
            errors.push(`Room ${roomIndex}: roomNumber is required`);
        }
        if (!room.type) {
            errors.push(`Room ${roomIndex}: type is required`);
        } else if (!validRoomTypes.includes(room.type)) {
            errors.push(`Room ${roomIndex}: Invalid type '${room.type}'. Valid types: ${validRoomTypes.join(', ')}`);
        }
        if (!room.capacity || room.capacity < 1) {
            errors.push(`Room ${roomIndex}: capacity must be at least 1`);
        }
        if (!room.price || room.price < 0) {
            errors.push(`Room ${roomIndex}: price must be a positive number`);
        }
        if (!room.floor || room.floor < 0) {
            errors.push(`Room ${roomIndex}: floor must be a non-negative number`);
        }
        if (!room.area || room.area < 0) {
            errors.push(`Room ${roomIndex}: area must be a positive number`);
        }
        if (room.status && !validStatuses.includes(room.status)) {
            errors.push(`Room ${roomIndex}: Invalid status '${room.status}'. Valid statuses: ${validStatuses.join(', ')}`);
        }
        if (room.currentOccupancy && room.currentOccupancy < 0) {
            errors.push(`Room ${roomIndex}: currentOccupancy must be a non-negative number`);
        }
    }
    
    return errors;
}

// Add new residence
exports.addResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Create new residence with all fields
        const residence = new Residence({
            name: req.body.name,
            description: req.body.description,
            address: {
                street: req.body.address.street,
                city: req.body.address.city,
                state: req.body.address.state,
                country: req.body.address.country
            },
            location: {
                type: 'Point',
                coordinates: req.body.location.coordinates
            },
            rooms: req.body.rooms.map(room => ({
                roomNumber: room.roomNumber,
                type: room.type,
                capacity: room.capacity,
                price: room.price,
                status: room.status || 'available',
                currentOccupancy: room.currentOccupancy || 0,
                features: room.features || [],
                amenities: room.amenities || [],
                floor: room.floor,
                area: room.area,
                images: room.images || []
            })),
            amenities: req.body.amenities || [],
            images: req.body.images || [],
            rules: req.body.rules || [], // <-- FIXED
            features: req.body.features || [],
            status: req.body.status || 'active',
            contactInfo: typeof req.body.contactInfo === 'object' && req.body.contactInfo !== null
  ? req.body.contactInfo
  : {},
            paymentConfiguration: req.body.paymentConfiguration || ResidencePaymentService.getDefaultConfiguration(),
            manager: req.user._id,
            type: req.body.type // <-- Ensure type is always set from payload
        });

        await residence.save();

        // Populate the response with manager info
        await residence.populate('manager', 'firstName lastName email');

        res.status(201).json({
            success: true,
            data: residence,
            message: 'Residence added successfully'
        });
    } catch (error) {
        console.error('Error in addResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding residence',
            error: error.message
        });
    }
};

// Create new residence (alternative implementation)
exports.createResidence = async (req, res) => {
  try {
    const residence = new Residence({
      ...req.body, // This spreads all fields, including type, from the payload
    });

    await residence.save();
    res.status(201).json({ success: true, message: 'Residence added successfully', data: residence });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding residence', error: error.message });
  }
};

// Get all residences
exports.getAllResidences = async (req, res) => {
    try {
        const residences = await Residence.find()
            .populate('manager', 'firstName lastName email')
            .sort({ createdAt: -1 });

        // For each residence, for each room, add approvedCount
        const residencesWithCounts = await Promise.all(residences.map(async (residence) => {
            const roomsWithCounts = await Promise.all((residence.rooms || []).map(async (room) => {
                const approvedCount = await Application.countDocuments({
                    status: 'approved',
                    allocatedRoom: room.roomNumber,
                    residence: residence._id
                });
                return {
                    ...room.toObject(),
                    approvedCount
                };
            }));
            return {
                ...residence.toObject(),
                rooms: roomsWithCounts
            };
        }));

        res.status(200).json({
            success: true,
            count: residencesWithCounts.length,
            data: residencesWithCounts
        });
    } catch (error) {
        console.error('Error in getAllResidences:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching residences',
            error: error.message
        });
    }
};

// Get single residence
exports.getResidence = async (req, res) => {
    try {
        const residence = await Residence.findById(req.params.id)
            .populate('manager', 'firstName lastName email');

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        res.status(200).json({
            success: true,
            data: residence
        });
    } catch (error) {
        console.error('Error in getResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching residence',
            error: error.message
        });
    }
};

// Update residence
exports.updateResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findById(req.params.id);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Update all fields
        residence.name = req.body.name;
        residence.description = req.body.description;
        residence.address = {
            street: req.body.address.street,
            city: req.body.address.city,
            state: req.body.address.state,
            country: req.body.address.country
        };
        residence.location = {
            type: 'Point',
            coordinates: req.body.location.coordinates
        };
        residence.rooms = req.body.rooms.map(room => ({
            roomNumber: room.roomNumber,
            type: room.type,
            capacity: room.capacity,
            price: room.price,
            status: room.status || 'available',
            currentOccupancy: room.currentOccupancy || 0,
            features: room.features || [],
            amenities: room.amenities || [],
            floor: room.floor,
            area: room.area,
            images: room.images || []
        }));
        residence.amenities = req.body.amenities || [];
        residence.images = req.body.images || [];
        residence.rules = req.body.rules || [];
        residence.features = req.body.features || [];
        residence.status = req.body.status || 'active';
        residence.contactInfo = req.body.contactInfo || {};
        
        // Update payment configuration if provided
        if (req.body.paymentConfiguration) {
            residence.paymentConfiguration = ResidencePaymentService.validatePaymentConfiguration(req.body.paymentConfiguration);
        }

        await residence.save();

        // Populate the response with manager info
        await residence.populate('manager', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: residence,
            message: 'Residence updated successfully'
        });
    } catch (error) {
        console.error('Error in updateResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating residence',
            error: error.message
        });
    }
};

// Delete residence
exports.deleteResidence = async (req, res) => {
    try {
        const residence = await Residence.findByIdAndDelete(req.params.id);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Residence deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting residence',
            error: error.message
        });
    }
};

// Get rooms for a specific residence
exports.getRoomsByResidence = async (req, res) => {
    try {
        const { residenceId } = req.params;
        
        if (!residenceId) {
            return res.status(400).json({
                success: false,
                message: 'Residence ID is required'
            });
        }

        const residence = await Residence.findById(residenceId)
            .select('name rooms')
            .lean();

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Return rooms with availability information
        const rooms = residence.rooms.map(room => ({
            roomNumber: room.roomNumber,
            type: room.type,
            capacity: room.capacity,
            price: room.price,
            status: room.status,
            currentOccupancy: room.currentOccupancy || 0,
            floor: room.floor,
            area: room.area,
            features: room.features || [],
            isAvailable: (room.currentOccupancy || 0) < room.capacity
        }));

        res.status(200).json({
            success: true,
            data: rooms,
            residenceName: residence.name
        });
    } catch (error) {
        console.error('Error in getRoomsByResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rooms for residence',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get rooms for a specific residence (alternative implementation)
exports.getResidenceRooms = async (req, res) => {
    try {
        const residence = await Residence.findById(req.params.id);
        
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Format rooms for response
        const formattedRooms = residence.rooms.map(room => ({
            roomNumber: room.roomNumber,
            type: room.type,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy || 0,
            status: room.status,
            price: room.price,
            floor: room.floor,
            area: room.area,
            features: room.features || [],
            isAvailable: room.status === 'available' || room.status === 'reserved'
        }));

        res.json({
            success: true,
            residence: {
                id: residence._id,
                name: residence.name
            },
            rooms: formattedRooms,
            totalRooms: formattedRooms.length,
            availableRooms: formattedRooms.filter(room => room.isAvailable).length
        });
    } catch (error) {
        console.error('Error in getResidenceRooms:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching residence rooms',
            error: error.message
        });
    }
};

// Add multiple rooms to a residence in bulk
exports.bulkAddRooms = async (req, res) => {
    try {
        let rooms = req.body.rooms;
        let csvData = req.body.csvData;

        // Check if CSV data is provided instead of JSON rooms
        if (csvData && typeof csvData === 'string') {
            try {
                rooms = parseCSVRoomData(csvData);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid CSV format. Expected: roomNumber,type,capacity,price,status,currentOccupancy,area',
                    error: error.message
                });
            }
        }

        // If neither rooms array nor csvData is provided
        if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Rooms array or CSV data is required and cannot be empty'
            });
        }

        // Validate the parsed rooms data
        const errors = validateRoomData(rooms);
        if (errors.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation errors found',
                errors: errors 
            });
        }

        const residence = await Residence.findById(req.params.id);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        const results = {
            success: true,
            summary: {
                total: rooms.length,
                added: 0,
                skipped: 0,
                failed: 0
            },
            details: {
                added: [],
                skipped: [],
                failed: []
            }
        };

        // Process each room
        for (let i = 0; i < rooms.length; i++) {
            const roomData = rooms[i];
            const roomIndex = i + 1;

            try {
                // Validate required fields
                if (!roomData.roomNumber || !roomData.type || !roomData.capacity || 
                    !roomData.price || !roomData.floor || !roomData.area) {
                    results.details.failed.push({
                        index: roomIndex,
                        roomNumber: roomData.roomNumber || 'N/A',
                        error: 'Missing required fields: roomNumber, type, capacity, price, floor, area',
                        data: roomData
                    });
                    results.summary.failed++;
                    continue;
                }

                // Check if room number already exists
                const roomExists = residence.rooms.some(room => room.roomNumber === roomData.roomNumber);
                if (roomExists) {
                    results.details.skipped.push({
                        index: roomIndex,
                        roomNumber: roomData.roomNumber,
                        reason: 'Room number already exists',
                        data: roomData
                    });
                    results.summary.skipped++;
                    continue;
                }

                // Create new room object
                const newRoom = {
                    roomNumber: roomData.roomNumber,
                    type: roomData.type,
                    capacity: parseInt(roomData.capacity),
                    price: parseFloat(roomData.price),
                    status: roomData.status || 'available',
                    currentOccupancy: parseInt(roomData.currentOccupancy) || 0,
                    features: roomData.features || [],
                    amenities: roomData.amenities || [],
                    floor: parseInt(roomData.floor),
                    area: parseFloat(roomData.area),
                    images: roomData.images || [],
                    cleaningFrequency: roomData.cleaningFrequency || 'weekly'
                };

                // Add room to residence
                residence.rooms.push(newRoom);
                results.details.added.push({
                    index: roomIndex,
                    roomNumber: newRoom.roomNumber,
                    data: newRoom
                });
                results.summary.added++;

            } catch (error) {
                console.error(`Error processing room ${roomIndex}:`, error);
                results.details.failed.push({
                    index: roomIndex,
                    roomNumber: roomData.roomNumber || 'N/A',
                    error: error.message,
                    data: roomData
                });
                results.summary.failed++;
            }
        }

        // Save residence with all new rooms
        if (results.summary.added > 0) {
            await residence.save();
        }

        res.status(201).json({
            success: true,
            message: `Bulk room addition completed. Added: ${results.summary.added}, Skipped: ${results.summary.skipped}, Failed: ${results.summary.failed}`,
            data: results
        });

    } catch (error) {
        console.error('Error in bulkAddRooms:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding rooms in bulk',
            error: error.message
        });
    }
};

body('contactInfo')
  .optional({ nullable: true })
  .custom(value => value === null || typeof value === 'object')
  .withMessage('Contact info must be an object or null')