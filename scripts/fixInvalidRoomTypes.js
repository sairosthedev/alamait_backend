const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Define the Residence schema (simplified version for the script)
const residenceSchema = new mongoose.Schema({
    name: String,
    rooms: [{
        roomNumber: String,
        type: {
            type: String,
            enum: ['single', 'double', 'studio', 'apartment', 'triple', 'quad']
        },
        capacity: Number,
        price: Number,
        status: String,
        currentOccupancy: Number,
        floor: Number,
        area: Number
    }]
});

const Residence = mongoose.model('Residence', residenceSchema);

// Function to fix invalid room types
const fixInvalidRoomTypes = async () => {
    try {
        console.log('🔍 Searching for residences with invalid room types...');
        
        // Find all residences
        const residences = await Residence.find({});
        console.log(`Found ${residences.length} residences`);
        
        let totalFixed = 0;
        let totalResidencesUpdated = 0;
        
        for (const residence of residences) {
            let residenceUpdated = false;
            
            if (residence.rooms && residence.rooms.length > 0) {
                for (const room of residence.rooms) {
                    if (room.type && !['single', 'double', 'studio', 'apartment', 'triple', 'quad'].includes(room.type)) {
                        console.log(`❌ Found invalid room type: ${room.type} in room ${room.roomNumber} of residence ${residence.name}`);
                        
                        // Map invalid types to valid ones
                        let newType = 'single'; // default
                        
                        if (room.type === 'six') {
                            newType = 'quad'; // map 'six' to 'quad' (4-person room)
                        } else if (room.type === 'five') {
                            newType = 'quad'; // map 'five' to 'quad'
                        } else if (room.type === 'four') {
                            newType = 'quad';
                        } else if (room.type === 'three') {
                            newType = 'triple';
                        } else if (room.type === 'two') {
                            newType = 'double';
                        } else if (room.type === 'one') {
                            newType = 'single';
                        } else {
                            // For any other invalid type, try to determine based on capacity
                            if (room.capacity) {
                                if (room.capacity === 1) newType = 'single';
                                else if (room.capacity === 2) newType = 'double';
                                else if (room.capacity === 3) newType = 'triple';
                                else if (room.capacity >= 4) newType = 'quad';
                            }
                        }
                        
                        console.log(`✅ Mapping ${room.type} → ${newType} for room ${room.roomNumber}`);
                        room.type = newType;
                        totalFixed++;
                        residenceUpdated = true;
                    }
                }
                
                if (residenceUpdated) {
                    await residence.save();
                    totalResidencesUpdated++;
                    console.log(`✅ Updated residence: ${residence.name}`);
                }
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`Total room types fixed: ${totalFixed}`);
        console.log(`Total residences updated: ${totalResidencesUpdated}`);
        
        if (totalFixed === 0) {
            console.log('🎉 No invalid room types found! Database is clean.');
        } else {
            console.log('✅ All invalid room types have been fixed!');
        }
        
    } catch (error) {
        console.error('❌ Error fixing room types:', error);
    }
};

// Function to validate all room types
const validateRoomTypes = async () => {
    try {
        console.log('\n🔍 Validating all room types...');
        
        const residences = await Residence.find({});
        let invalidRooms = [];
        
        for (const residence of residences) {
            if (residence.rooms && residence.rooms.length > 0) {
                for (const room of residence.rooms) {
                    if (room.type && !['single', 'double', 'studio', 'apartment', 'triple', 'quad'].includes(room.type)) {
                        invalidRooms.push({
                            residence: residence.name,
                            room: room.roomNumber,
                            type: room.type
                        });
                    }
                }
            }
        }
        
        if (invalidRooms.length === 0) {
            console.log('✅ All room types are valid!');
        } else {
            console.log('❌ Found invalid room types:');
            invalidRooms.forEach(room => {
                console.log(`  - ${room.residence}: Room ${room.room} has invalid type "${room.type}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error validating room types:', error);
    }
};

// Main execution
const main = async () => {
    try {
        await connectDB();
        
        console.log('🚀 Starting room type validation and fix...\n');
        
        // First validate
        await validateRoomTypes();
        
        // Then fix
        await fixInvalidRoomTypes();
        
        // Validate again
        await validateRoomTypes();
        
        console.log('\n✨ Process completed!');
        
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    fixInvalidRoomTypes,
    validateRoomTypes
}; 