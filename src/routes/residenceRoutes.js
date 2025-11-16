const express = require('express');
const router = express.Router();
const { Residence } = require('../models/Residence');

// Get all residences (public route for frontend)
// OPTIMIZED: Added caching to reduce database load
router.get('/', async (req, res) => {
    try {
        const cacheService = require('../services/cacheService');
        const cacheKey = 'public-residences-active';
        
        // Try cache first (5 minute TTL)
        const cached = await cacheService.getOrSet(cacheKey, 300, async () => {
            const residences = await Residence.find({ status: 'active' })
                .select('name description address amenities images features rules rooms')
                .lean();

            // Format the response to include only necessary information
            return residences.map(residence => ({
                _id: residence._id,
                name: residence.name,
                description: residence.description,
                address: residence.address,
                amenities: residence.amenities,
                features: residence.features,
                rules: residence.rules,
                images: residence.images,
                rooms: residence.rooms.map(room => ({
                    roomNumber: room.roomNumber,
                    type: room.type,
                    capacity: room.capacity,
                    price: room.price,
                    status: room.status,
                    currentOccupancy: room.currentOccupancy,
                    features: room.features,
                    floor: room.floor,
                    area: room.area
                })),
                availableRooms: residence.rooms.filter(room => 
                    room.status === 'available' || room.status === 'reserved'
                ).length
            }));
        });

        res.json({
            success: true,
            data: cached
        });
    } catch (error) {
        console.error('Error in getResidences:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch residences',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get residence by ID
router.get('/:id', async (req, res) => {
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
        console.error('Error in getResidenceById:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch residence details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 