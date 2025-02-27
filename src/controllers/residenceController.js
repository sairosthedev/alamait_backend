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

        residence.rooms.push(req.body);
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