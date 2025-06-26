const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');
const Application = require('../../models/Application');
const User = require('../../models/User');
const Lease = require('../../models/Lease');

// @route   GET /api/student/residences
// @desc    Get all available residences
// @access  Private (Student only)
exports.getAvailableResidences = async (req, res) => {
    try {
        const residences = await Residence.find({ status: 'active' })
            .select('name description address amenities images features rules')
            .lean();

        // Format the response to include only necessary information
        const formattedResidences = residences.map(residence => ({
            id: residence._id,
            name: residence.name,
            description: residence.description,
            address: residence.address,
            amenities: residence.amenities,
            features: residence.features,
            rules: residence.rules,
            images: residence.images,
            availableRooms: residence.rooms.filter(room => 
                room.status === 'available' || room.status === 'reserved'
            ).length
        }));

        res.json({
            success: true,
            data: formattedResidences
        });
    } catch (error) {
        console.error('Error in getAvailableResidences:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch residences',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @route   GET /api/student/residences/:id
// @desc    Get detailed information about a specific residence
// @access  Private (Student only)
exports.getResidenceDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('residence');

        // Find the latest approved or waitlisted application for this user
        const application = await Application.findOne({
            student: req.user.id,
            status: { $in: ['approved', 'waitlisted'] }
        }).sort({ applicationDate: -1 });

        let residence = null;
        if (application && application.residence) {
            residence = application.residence; // <-- THIS IS THE RESIDENCE ID FROM APPLICATION
        } else {
            residence = user.residence; // fallback
        }

        const residenceDetails = await Residence.findById(residence)
            .select('-manager')
            .lean();

        if (!residenceDetails) {
            return res.status(404).json({
                success: false,
                error: 'Residence not found'
            });
        }

        // Format room information to include only necessary details
        const formattedRooms = residenceDetails.rooms.map(room => ({
            number: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy,
            status: room.status,
            features: room.features,
            floor: room.floor,
            area: room.area
        }));

        // Format the response
        const formattedResidence = {
            id: residenceDetails._id,
            name: residenceDetails.name,
            description: residenceDetails.description,
            address: residenceDetails.address,
            amenities: residenceDetails.amenities,
            features: residenceDetails.features,
            rules: residenceDetails.rules,
            images: residenceDetails.images,
            contactInfo: residenceDetails.contactInfo,
            rooms: formattedRooms,
            totalRooms: residenceDetails.rooms.length,
            availableRooms: residenceDetails.rooms.filter(room => 
                room.status === 'available' || room.status === 'reserved'
            ).length
        };

        res.json({
            success: true,
            data: formattedResidence
        });
    } catch (error) {
        console.error('Error in getResidenceDetails:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch residence details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @route   POST /api/student/lease
// @desc    Create a new lease
// @access  Private (Student only)
exports.createLease = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) {
            // Existing student: allow new application/lease
            await Application.create({
                student: user._id,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                // ...other fields
            });
        } else {
            // New student
            const newUser = await User.create({ ...req.body });
            await Application.create({
                student: newUser._id,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                // ...other fields
            });
        }

        res.json({
            success: true,
            data: leaseDoc
        });
    } catch (error) {
        console.error('Error in createLease:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create lease',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 