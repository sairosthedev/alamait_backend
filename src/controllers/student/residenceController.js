const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

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
        const residence = await Residence.findById(req.params.id)
            .select('-manager')
            .lean();

        if (!residence) {
            return res.status(404).json({
                success: false,
                error: 'Residence not found'
            });
        }

        // Format room information to include only necessary details
        const formattedRooms = residence.rooms.map(room => ({
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
            id: residence._id,
            name: residence.name,
            description: residence.description,
            address: residence.address,
            amenities: residence.amenities,
            features: residence.features,
            rules: residence.rules,
            images: residence.images,
            contactInfo: residence.contactInfo,
            rooms: formattedRooms,
            totalRooms: residence.rooms.length,
            availableRooms: residence.rooms.filter(room => 
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