const Residence = require('../models/Residence');
const { validationResult } = require('express-validator');

// Get St Kilda residence
exports.getStKildaResidence = async (req, res) => {
    try {
        const residence = await Residence.findOne({ name: "St Kilda Student House" });

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'St Kilda residence not found'
            });
        }

        // Ensure room status is consistent with occupancy
        let hasUpdates = false;
        residence.rooms.forEach(room => {
            // Get capacity based on room type if not set
            const capacity = room.capacity || (
                room.type === 'single' ? 1 : 
                room.type === 'double' ? 2 : 
                room.type === 'studio' ? 1 : 
                room.type === 'triple' ? 3 : 
                room.type === 'quad' ? 4 : 4
            );
            
            // Ensure currentOccupancy is a number
            let currentOccupancy = room.currentOccupancy;
            if (currentOccupancy === undefined || currentOccupancy === null) {
                currentOccupancy = 0;
                room.currentOccupancy = 0;
                hasUpdates = true;
            }
            
            // Update room status based on occupancy
            let newStatus = room.status;
            if (currentOccupancy === 0) {
                newStatus = 'available';
            } else if (currentOccupancy >= capacity) {
                newStatus = 'occupied';
            } else if (currentOccupancy > 0) {
                newStatus = 'reserved';
            }
            
            // Only update if status has changed
            if (room.status !== newStatus) {
                room.status = newStatus;
                hasUpdates = true;
            }
        });

        // Save changes if any updates were made
        if (hasUpdates) {
            await residence.save();
            ('Updated room statuses and occupancy for St Kilda residence');
        }

        res.status(200).json({
            success: true,
            data: residence
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching St Kilda residence',
            error: error.message
        });
    }
};

// Get Belvedere residence
exports.getBelvedereResidence = async (req, res) => {
    try {
        const residence = await Residence.findOne({ name: "Belvedere Student House" });

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Belvedere residence not found'
            });
        }

        // Ensure room status is consistent with occupancy
        let hasUpdates = false;
        residence.rooms.forEach(room => {
            // Get capacity based on room type if not set
            const capacity = room.capacity || (
                room.type === 'single' ? 1 : 
                room.type === 'double' ? 2 : 
                room.type === 'studio' ? 1 : 
                room.type === 'triple' ? 3 : 
                room.type === 'quad' ? 4 : 4
            );
            
            // Ensure currentOccupancy is a number
            let currentOccupancy = room.currentOccupancy;
            if (currentOccupancy === undefined || currentOccupancy === null) {
                currentOccupancy = 0;
                room.currentOccupancy = 0;
                hasUpdates = true;
            }
            
            // Update room status based on occupancy
            let newStatus = room.status;
            if (currentOccupancy === 0) {
                newStatus = 'available';
            } else if (currentOccupancy >= capacity) {
                newStatus = 'occupied';
            } else if (currentOccupancy > 0) {
                newStatus = 'reserved';
            }
            
            // Only update if status has changed
            if (room.status !== newStatus) {
                room.status = newStatus;
                hasUpdates = true;
            }
        });

        // Save changes if any updates were made
        if (hasUpdates) {
            await residence.save();
            ('Updated room statuses and occupancy for Belvedere residence');
        }

        res.status(200).json({
            success: true,
            data: residence
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching Belvedere residence',
            error: error.message
        });
    }
};

// Get Newlands residence
exports.getNewlandsResidence = async (req, res) => {
    try {
        const residence = await Residence.findOne({ name: 'Newlands' });
        
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Newlands residence not found'
            });
        }

        res.status(200).json({
            success: true,
            data: residence
        });
    } catch (error) {
        console.error('Error in getNewlandsResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching Newlands residence',
            error: error.message
        });
    }
};

// Get 1ACP residence
exports.get1ACPResidence = async (req, res) => {
    try {
        const residence = await Residence.findOne({ name: "1ACP" });

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: '1ACP residence not found'
            });
        }

        // Ensure room status is consistent with occupancy
        let hasUpdates = false;
        residence.rooms.forEach(room => {
            // Get capacity based on room type if not set
            const capacity = room.capacity || (
                room.type === 'single' ? 1 : 
                room.type === 'double' ? 2 : 
                room.type === 'studio' ? 1 : 
                room.type === 'triple' ? 3 : 
                room.type === 'quad' ? 4 : 
                room.type === 'pool' ? 5 : 4
            );
            
            // Ensure currentOccupancy is a number
            let currentOccupancy = room.currentOccupancy;
            if (currentOccupancy === undefined || currentOccupancy === null) {
                currentOccupancy = 0;
                room.currentOccupancy = 0;
                hasUpdates = true;
            }
            
            // Update room status based on occupancy
            let newStatus = room.status;
            if (currentOccupancy === 0) {
                newStatus = 'available';
            } else if (currentOccupancy >= capacity) {
                newStatus = 'occupied';
            } else if (currentOccupancy > 0) {
                newStatus = 'reserved';
            }
            
            // Only update if status has changed
            if (room.status !== newStatus) {
                room.status = newStatus;
                hasUpdates = true;
            }
        });

        // Save changes if any updates were made
        if (hasUpdates) {
            await residence.save();
            console.log('Updated room statuses and occupancy for 1ACP residence');
        }

        res.status(200).json({
            success: true,
            data: residence
        });
    } catch (error) {
        console.error('Error in getOneACPResidence:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching 1ACP residence',
            error: error.message
        });
    }
};

// Add a new residence
exports.addResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            name,
            description,
            address,
            location,
            rooms,
            amenities,
            rules,
            features,
            contactInfo
        } = req.body;

        // Create new residence
        const residence = new Residence({
            name,
            description,
            address,
            location,
            rooms,
            amenities,
            rules,
            features,
            manager: req.user.id, // Set the current user as manager
            contactInfo
        });

        await residence.save();

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

// Get all residences
exports.getAllResidences = async (req, res) => {
    try {
        const residences = await Residence.find()
            .populate('manager', 'name email');

        res.status(200).json({
            success: true,
            count: residences.length,
            data: residences
        });
    } catch (error) {
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
            .populate('manager', 'name email');

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
        const residence = await Residence.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        res.status(200).json({
            success: true,
            data: residence,
            message: 'Residence updated successfully'
        });
    } catch (error) {
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
        res.status(500).json({
            success: false,
            message: 'Error deleting residence',
            error: error.message
        });
    }
};

// Add a room to a residence
exports.addRoom = async (req, res) => {
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

        // Check if room number already exists
        const roomExists = residence.rooms.some(room => room.roomNumber === req.body.roomNumber);
        if (roomExists) {
            return res.status(400).json({
                success: false,
                message: 'Room number already exists'
            });
        }

        const newRoom = {
            roomNumber: req.body.roomNumber,
            type: req.body.type,
            capacity: req.body.capacity,
            price: req.body.price,
            status: req.body.status,
            currentOccupancy: req.body.currentOccupancy,
            features: req.body.features,
            amenities: req.body.amenities,
            floor: req.body.floor,
            area: req.body.area,
            images: req.body.images
        };

        residence.rooms.push(newRoom);
        await residence.save();

        res.status(201).json({
            success: true,
            data: residence,
            message: 'Room added successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding room',
            error: error.message
        });
    }
};

// Update a room in a residence
exports.updateRoom = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findById(req.params.residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        const roomIndex = residence.rooms.findIndex(
            room => room.roomNumber === req.params.roomNumber
        );

        if (roomIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Update room fields while preserving existing data
        residence.rooms[roomIndex] = {
            ...residence.rooms[roomIndex].toObject(),
            ...req.body
        };

        await residence.save();

        res.status(200).json({
            success: true,
            data: residence,
            message: 'Room updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating room',
            error: error.message
        });
    }
};

// Get residence by name
exports.getResidenceByName = async (req, res) => {
    try {
        const residence = await Residence.findOne({ name: req.params.name });

        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        res.status(200).json(residence);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching residence',
            error: error.message
        });
    }
}; 