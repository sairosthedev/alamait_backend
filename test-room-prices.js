const mongoose = require('mongoose');
require('dotenv').config();

async function testRoomPrices() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Residence = require('./src/models/Residence');
        
        console.log('\n=== Testing Room Price Fetching ===');
        
        // Test 1: Get all residences
        const residences = await Residence.find().select('name rooms').lean();
        console.log(`Found ${residences.length} residences`);
        
        if (residences.length === 0) {
            console.log('No residences found in database');
            return;
        }
        
        // Test 2: Check rooms in first residence
        const firstResidence = residences[0];
        console.log(`\nFirst residence: ${firstResidence.name}`);
        console.log(`Number of rooms: ${firstResidence.rooms ? firstResidence.rooms.length : 0}`);
        
        if (firstResidence.rooms && firstResidence.rooms.length > 0) {
            console.log('\nSample rooms:');
            firstResidence.rooms.slice(0, 3).forEach((room, index) => {
                console.log(`  Room ${index + 1}:`);
                console.log(`    Room Number: ${room.roomNumber}`);
                console.log(`    Type: ${room.type}`);
                console.log(`    Price: ${room.price}`);
                console.log(`    Status: ${room.status}`);
                console.log(`    Capacity: ${room.capacity}`);
                console.log(`    Current Occupancy: ${room.currentOccupancy || 0}`);
            });
        }
        
        // Test 3: Simulate the room price controller logic
        console.log('\n=== Testing Room Price Controller Logic ===');
        
        const { 
            page = 1, 
            limit = 10, 
            residence, 
            roomType, 
            minPrice, 
            maxPrice,
            sortBy = 'price',
            sortOrder = 'asc'
        } = {};

        // Build filter object for residences
        const residenceFilter = {};
        
        if (residence) {
            residenceFilter._id = residence;
        }

        // Build filter object for rooms within residences
        const roomFilter = {};
        
        if (roomType) {
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
        console.log('Combined filter:', JSON.stringify(combinedFilter, null, 2));

        // Get residences with rooms
        const filteredResidences = await Residence.find(combinedFilter)
            .select('name address rooms')
            .lean();

        console.log(`Found ${filteredResidences.length} residences after filtering`);

        // Extract and flatten all rooms from all residences
        let allRooms = [];
        filteredResidences.forEach(residence => {
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

        console.log(`Total rooms found: ${allRooms.length}`);

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

        console.log(`Rooms after filtering: ${filteredRooms.length}`);

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

        console.log(`\nPagination results:`);
        console.log(`  Total rooms: ${total}`);
        console.log(`  Page: ${page}, Limit: ${limit}`);
        console.log(`  Skip: ${skip}`);
        console.log(`  Paginated rooms: ${paginatedRooms.length}`);

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

        console.log('\n=== Final Response Format ===');
        console.log('Sample formatted room:', JSON.stringify(formattedRooms[0], null, 2));
        
        const response = {
            rooms: formattedRooms,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        };

        console.log('\n=== Final Response ===');
        console.log('Response structure:', {
            roomsCount: response.rooms.length,
            pagination: response.pagination
        });

        console.log('\n✅ Room price fetching test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing room prices:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testRoomPrices(); 