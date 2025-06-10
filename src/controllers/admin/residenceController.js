const { validationResult } = require('express-validator');
const Residence = require('../../models/Residence');

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
            rules: req.body.rules || [],
            features: req.body.features || [],
            status: req.body.status || 'active',
            contactInfo: req.body.contactInfo || {},
            manager: req.user._id
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

// Get all residences
exports.getAllResidences = async (req, res) => {
    try {
        const residences = await Residence.find()
            .populate('manager', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: residences.length,
            data: residences
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