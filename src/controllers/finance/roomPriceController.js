const Residence = require('../../models/Residence');
const Room = require('../../models/Room');

// Get all room prices (for finance)
exports.getAllRoomPrices = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            residence, 
            roomType, 
            minPrice, 
            maxPrice,
            sortBy = 'price',
            sortOrder = 'asc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (residence) {
            filter.residence = residence;
        }
        
        if (roomType) {
            filter.type = roomType;
        }
        
        // Price filtering
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }

        // Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count for pagination
        const total = await Room.countDocuments(filter);
        
        // Get rooms with pagination and population
        const rooms = await Room.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('residence', 'name address')
            .lean();

        // Format rooms for response
        const formattedRooms = rooms.map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features,
            residence: room.residence ? {
                id: room.residence._id,
                name: room.residence.name,
                address: room.residence.address
            } : null,
            occupancyRate: room.capacity > 0 ? Math.round((room.currentOccupancy / room.capacity) * 100) : 0
        }));

        res.json({
            rooms: formattedRooms,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getAllRoomPrices:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single room price (for finance)
exports.getRoomPrice = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('residence', 'name address')
            .lean();

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const formattedRoom = {
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features,
            residence: room.residence ? {
                id: room.residence._id,
                name: room.residence.name,
                address: room.residence.address
            } : null,
            occupancyRate: room.capacity > 0 ? Math.round((room.currentOccupancy / room.capacity) * 100) : 0
        };

        res.json(formattedRoom);
    } catch (error) {
        console.error('Finance: Error in getRoomPrice:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get room pricing statistics (for finance)
exports.getRoomPriceStats = async (req, res) => {
    try {
        const { residence, roomType } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (residence) {
            filter.residence = residence;
        }
        
        if (roomType) {
            filter.type = roomType;
        }

        // Get total rooms
        const totalRooms = await Room.countDocuments(filter);
        
        // Get rooms by type
        const roomsByType = await Room.aggregate([
            { $match: filter },
            { $group: { 
                _id: '$type', 
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }},
            { $sort: { avgPrice: -1 } }
        ]);
        
        // Get rooms by residence
        const roomsByResidence = await Room.aggregate([
            { $match: filter },
            { $group: { 
                _id: '$residence', 
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                totalRevenue: { $sum: '$price' }
            }},
            { $sort: { avgPrice: -1 } }
        ]);

        // Populate residence names
        const residenceIds = roomsByResidence.map(item => item._id);
        const residences = await Residence.find({ _id: { $in: residenceIds } }, 'name');
        const residenceMap = {};
        residences.forEach(residence => {
            residenceMap[residence._id.toString()] = residence.name;
        });

        const formattedRoomsByResidence = roomsByResidence.map(item => ({
            residenceId: item._id,
            residenceName: residenceMap[item._id.toString()] || 'Unknown',
            count: item.count,
            avgPrice: Math.round(item.avgPrice * 100) / 100,
            totalRevenue: Math.round(item.totalRevenue * 100) / 100
        }));

        // Get price ranges
        const priceRanges = await Room.aggregate([
            { $match: filter },
            { $group: { 
                _id: null, 
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgPrice: { $avg: '$price' },
                totalRevenue: { $sum: '$price' }
            }}
        ]);

        // Get rooms by status
        const roomsByStatus = await Room.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Get recent room updates (last 5)
        const recentRooms = await Room.find(filter)
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('residence', 'name')
            .lean();

        const formattedRecentRooms = recentRooms.map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            status: room.status,
            residenceName: room.residence ? room.residence.name : 'Unknown',
            updatedAt: room.updatedAt
        }));

        res.json({
            totalRooms,
            roomsByType,
            roomsByResidence: formattedRoomsByResidence,
            roomsByStatus,
            priceRanges: priceRanges[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0, totalRevenue: 0 },
            recentRooms: formattedRecentRooms
        });
    } catch (error) {
        console.error('Finance: Error in getRoomPriceStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get room prices by residence (for finance)
exports.getRoomPricesByResidence = async (req, res) => {
    try {
        const { residenceId } = req.params;
        
        const rooms = await Room.find({ residence: residenceId })
            .populate('residence', 'name address')
            .sort({ price: 1 })
            .lean();

        const formattedRooms = rooms.map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features,
            occupancyRate: room.capacity > 0 ? Math.round((room.currentOccupancy / room.capacity) * 100) : 0
        }));

        res.json({
            residence: rooms[0]?.residence ? {
                id: rooms[0].residence._id,
                name: rooms[0].residence.name,
                address: rooms[0].residence.address
            } : null,
            rooms: formattedRooms,
            totalRooms: formattedRooms.length,
            avgPrice: formattedRooms.length > 0 ? 
                Math.round((formattedRooms.reduce((sum, room) => sum + room.price, 0) / formattedRooms.length) * 100) / 100 : 0
        });
    } catch (error) {
        console.error('Finance: Error in getRoomPricesByResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 