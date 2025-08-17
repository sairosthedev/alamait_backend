/**
 * 🏠 Fetch St Kilda Residence Rooms
 * 
 * This script fetches and displays all rooms for the St Kilda Student House
 * with detailed information about each room.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fetchStKildaRooms() {
    try {
        console.log('🏠 Fetching St Kilda Student House Rooms...\n');
        
        // Wait for connection to be ready
        await mongoose.connection.asPromise();
        
        // Get the residences collection
        const residencesCollection = mongoose.connection.db.collection('residences');
        
        // Find St Kilda residence by name
        const stKildaResidence = await residencesCollection.findOne({
            name: { $regex: /St Kilda/i }
        });
        
        if (!stKildaResidence) {
            console.log('❌ St Kilda residence not found');
            return;
        }
        
        console.log(`🏠 **St Kilda Student House**`);
        console.log(`📍 ID: ${stKildaResidence._id}`);
        console.log(`📝 Description: ${stKildaResidence.description || 'No description'}`);
        console.log(`📊 Total Rooms: ${stKildaResidence.rooms ? stKildaResidence.rooms.length : 0}`);
        
        if (stKildaResidence.address) {
            console.log(`📍 Address: ${JSON.stringify(stKildaResidence.address)}`);
        }
        
        if (stKildaResidence.location) {
            console.log(`🗺️  Location: ${JSON.stringify(stKildaResidence.location)}`);
        }
        
        // Display all rooms
        if (stKildaResidence.rooms && stKildaResidence.rooms.length > 0) {
            console.log('\n🚪 **Room Details:**');
            console.log('=====================================');
            
            stKildaResidence.rooms.forEach((room, index) => {
                console.log(`\n${index + 1}. **Room: ${room.name || room.roomNumber || 'Unnamed'}**`);
                
                if (room.description) {
                    console.log(`   📝 Description: ${room.description}`);
                }
                
                if (room.type) {
                    console.log(`   🏠 Type: ${room.type}`);
                }
                
                if (room.capacity) {
                    console.log(`   👥 Capacity: ${room.capacity} person(s)`);
                }
                
                if (room.price) {
                    console.log(`   💰 Price: $${room.price}`);
                }
                
                if (room.status) {
                    console.log(`   📊 Status: ${room.status}`);
                }
                
                if (room.amenities && room.amenities.length > 0) {
                    console.log(`   🎯 Amenities: ${room.amenities.join(', ')}`);
                }
                
                if (room.features && room.features.length > 0) {
                    console.log(`   ✨ Features: ${room.features.join(', ')}`);
                }
                
                // Show other room properties
                const otherFields = Object.keys(room).filter(key => 
                    !['name', 'roomNumber', 'description', 'type', 'capacity', 'price', 'status', 'amenities', 'features'].includes(key)
                );
                if (otherFields.length > 0) {
                    console.log(`   🔍 Other Fields: ${otherFields.join(', ')}`);
                }
            });
        } else {
            console.log('\n❌ No rooms found for St Kilda residence');
        }
        
        // Show residence amenities
        if (stKildaResidence.amenities && stKildaResidence.amenities.length > 0) {
            console.log('\n🎯 **Residence Amenities:**');
            console.log(`   ${stKildaResidence.amenities.join(', ')}`);
        }
        
        // Show residence features
        if (stKildaResidence.features && stKildaResidence.features.length > 0) {
            console.log('\n✨ **Residence Features:**');
            console.log(`   ${stKildaResidence.features.join(', ')}`);
        }
        
        // Show residence rules
        if (stKildaResidence.rules && stKildaResidence.rules.length > 0) {
            console.log('\n📋 **Residence Rules:**');
            stKildaResidence.rules.forEach((rule, index) => {
                console.log(`   ${index + 1}. ${rule}`);
            });
        }
        
        // Show contact info
        if (stKildaResidence.contactInfo) {
            console.log('\n📞 **Contact Information:**');
            console.log(`   ${JSON.stringify(stKildaResidence.contactInfo, null, 2)}`);
        }
        
        console.log('\n=====================================');
        console.log(`🏠 St Kilda Student House - ${stKildaResidence.rooms ? stKildaResidence.rooms.length : 0} rooms`);
        
    } catch (error) {
        console.error('❌ Error fetching St Kilda rooms:', error);
    }
}

async function main() {
    try {
        // Use connection string from .env file
        const connectionString = process.env.MONGODB_URI;
        
        if (!connectionString) {
            throw new Error('MONGODB_URI not found in .env file');
        }
        
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas');
        
        // Fetch St Kilda rooms
        await fetchStKildaRooms();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { fetchStKildaRooms };
