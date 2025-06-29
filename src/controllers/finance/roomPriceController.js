const Residence = require('../../models/Residence');

// Get all room prices (for finance) - fetching from rooms in residences collection
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

        // Build filter object for residences
        const residenceFilter = {};
        
        // Treat 'all' and '' as no filter
        if (residence && residence !== 'all' && residence !== '') {
            residenceFilter._id = residence;
        }

        // Build filter object for rooms within residences
        const roomFilter = {};
        
        if (roomType && roomType !== 'all' && roomType !== '') {
            roomFilter['rooms.type'] = roomType;
        }
        
        // Price filtering
        if (minPrice || maxPrice) {
            roomFilter['rooms.price'] = {};
            if (minPrice) roomFilter['rooms.price'].$gte = parseFloat(minPrice);
            if (maxPrice) roomFilter['rooms.price'].$lte = parseFloat(maxPrice);
        }

        // Combine filters
        const combinedFilter = { ...residenceFilter, ...roomFilter };

        // Get residences with rooms
        const residences = await Residence.find(combinedFilter)
            .select('name address rooms')
            .lean();

        // Extract and flatten all rooms from all residences
        let allRooms = [];
        residences.forEach(residence => {
            const rooms = residence.rooms.map(room => ({
                ...room,
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address
                }
            }));
            allRooms = [...allRooms, ...rooms];
        });

        // Apply room-level filters
        let filteredRooms = allRooms;
        
        if (roomType) {
            filteredRooms = filteredRooms.filter(room => room.type === roomType);
        }
        
        if (minPrice || maxPrice) {
            filteredRooms = filteredRooms.filter(room => {
                if (minPrice && room.price < parseFloat(minPrice)) return false;
                if (maxPrice && room.price > parseFloat(maxPrice)) return false;
                return true;
            });
        }

        // Sorting
        filteredRooms.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy === 'price') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        // Pagination
        const total = filteredRooms.length;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedRooms = filteredRooms.slice(skip, skip + parseInt(limit));

        // Format rooms for response
        const formattedRooms = paginatedRooms.map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy || 0,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features || [],
            residence: room.residence,
            occupancyRate: room.capacity > 0 ? Math.round(((room.currentOccupancy || 0) / room.capacity) * 100) : 0
        }));

        res.json({
            success: true,
            roomPrices: formattedRooms,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Finance: Error in getAllRoomPrices:', error);
        res.status(500).json({ success: false, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
};

// Get single room price (for finance) - fetching from rooms in residences collection
exports.getRoomPrice = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the residence that contains this room
        const residence = await Residence.findOne({
            'rooms._id': id
        }).select('name address rooms').lean();

        if (!residence) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Find the specific room
        const room = residence.rooms.find(r => r._id.toString() === id);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const formattedRoom = {
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy || 0,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features || [],
            residence: {
                id: residence._id,
                name: residence.name,
                address: residence.address
            },
            occupancyRate: room.capacity > 0 ? Math.round(((room.currentOccupancy || 0) / room.capacity) * 100) : 0
        };

        res.json(formattedRoom);
    } catch (error) {
        console.error('Finance: Error in getRoomPrice:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get room pricing statistics (for finance) - fetching from rooms in residences collection
exports.getRoomPriceStats = async (req, res) => {
    try {
        const { residence, roomType } = req.query;
        
        // Build filter object for residences
        const residenceFilter = {};
        
        // Treat 'all' and '' as no filter
        if (residence && residence !== 'all' && residence !== '') {
            residenceFilter._id = residence;
        }

        // Build filter object for rooms within residences
        const roomFilter = {};
        
        if (roomType && roomType !== 'all' && roomType !== '') {
            roomFilter['rooms.type'] = roomType;
        }

        // Combine filters
        const combinedFilter = { ...residenceFilter, ...roomFilter };

        // Get residences with rooms
        const residences = await Residence.find(combinedFilter)
            .select('name rooms')
            .lean();

        // Extract and flatten all rooms from all residences
        let allRooms = [];
        residences.forEach(residence => {
            const rooms = residence.rooms.map(room => ({
                ...room,
                residenceId: residence._id,
                residenceName: residence.name
            }));
            allRooms = [...allRooms, ...rooms];
        });

        // Apply room-level filters
        let filteredRooms = allRooms;
        
        if (roomType) {
            filteredRooms = filteredRooms.filter(room => room.type === roomType);
        }

        const totalRooms = filteredRooms.length;
        
        // Get rooms by type
        const roomsByType = {};
        filteredRooms.forEach(room => {
            if (!roomsByType[room.type]) {
                roomsByType[room.type] = {
                    count: 0,
                    totalPrice: 0,
                    minPrice: Infinity,
                    maxPrice: 0
                };
            }
            roomsByType[room.type].count++;
            roomsByType[room.type].totalPrice += room.price;
            roomsByType[room.type].minPrice = Math.min(roomsByType[room.type].minPrice, room.price);
            roomsByType[room.type].maxPrice = Math.max(roomsByType[room.type].maxPrice, room.price);
        });

        const formattedRoomsByType = Object.entries(roomsByType).map(([type, data]) => ({
            _id: type,
            count: data.count,
            avgPrice: Math.round((data.totalPrice / data.count) * 100) / 100,
            minPrice: data.minPrice === Infinity ? 0 : data.minPrice,
            maxPrice: data.maxPrice
        })).sort((a, b) => b.avgPrice - a.avgPrice);
        
        // Get rooms by residence
        const roomsByResidence = {};
        filteredRooms.forEach(room => {
            if (!roomsByResidence[room.residenceId]) {
                roomsByResidence[room.residenceId] = {
                    residenceName: room.residenceName,
                    count: 0,
                    totalPrice: 0
                };
            }
            roomsByResidence[room.residenceId].count++;
            roomsByResidence[room.residenceId].totalPrice += room.price;
        });

        const formattedRoomsByResidence = Object.entries(roomsByResidence).map(([residenceId, data]) => ({
            residenceId,
            residenceName: data.residenceName,
            count: data.count,
            avgPrice: Math.round((data.totalPrice / data.count) * 100) / 100,
            totalRevenue: Math.round(data.totalPrice * 100) / 100
        })).sort((a, b) => b.avgPrice - a.avgPrice);

        // Get price ranges
        const prices = filteredRooms.map(room => room.price);
        const priceRanges = {
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            avgPrice: prices.length > 0 ? Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) * 100) / 100 : 0,
            totalRevenue: Math.round(prices.reduce((sum, price) => sum + price, 0) * 100) / 100
        };

        // Get rooms by status
        const roomsByStatus = {};
        filteredRooms.forEach(room => {
            const status = room.status || 'available';
            roomsByStatus[status] = (roomsByStatus[status] || 0) + 1;
        });

        const formattedRoomsByStatus = Object.entries(roomsByStatus).map(([status, count]) => ({
            _id: status,
            count
        }));

        // Get recent room updates (last 5)
        const recentRooms = filteredRooms
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
            .slice(0, 5)
            .map(room => ({
                id: room._id,
                roomNumber: room.roomNumber,
                type: room.type,
                price: room.price,
                status: room.status,
                residenceName: room.residenceName,
                updatedAt: room.updatedAt
            }));

        res.json({
            success: true,
            stats: {
                totalRooms,
                roomsByType: formattedRoomsByType,
                roomsByResidence: formattedRoomsByResidence,
                roomsByStatus: formattedRoomsByStatus,
                priceRanges,
                recentRooms
            }
        });
    } catch (error) {
        console.error('Finance: Error in getRoomPriceStats:', error);
        res.status(500).json({ success: false, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
};

// Get room prices by residence (for finance) - fetching from rooms in residences collection
exports.getRoomPricesByResidence = async (req, res) => {
    try {
        const { residenceId } = req.params;
        
        const residence = await Residence.findById(residenceId)
            .select('name address rooms')
            .lean();

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        // Sort rooms by price
        const sortedRooms = residence.rooms.sort((a, b) => a.price - b.price);

        const formattedRooms = sortedRooms.map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy || 0,
            status: room.status,
            floor: room.floor,
            area: room.area,
            features: room.features || [],
            occupancyRate: room.capacity > 0 ? Math.round(((room.currentOccupancy || 0) / room.capacity) * 100) : 0
        }));

        const avgPrice = formattedRooms.length > 0 ? 
            Math.round((formattedRooms.reduce((sum, room) => sum + room.price, 0) / formattedRooms.length) * 100) / 100 : 0;

        res.json({
            success: true,
            residence: {
                id: residence._id,
                name: residence.name,
                address: residence.address
            },
            roomPrices: formattedRooms,
            totalRooms: formattedRooms.length,
            avgPrice
        });
    } catch (error) {
        console.error('Finance: Error in getRoomPricesByResidence:', error);
        res.status(500).json({ success: false, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
}; 