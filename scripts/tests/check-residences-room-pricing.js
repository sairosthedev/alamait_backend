require('dotenv').config();
const mongoose = require('mongoose');

async function checkResidencesRoomPricing() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔍 Checking Residences Collection for Room Pricing...');
        console.log('==================================================');
        
        // Get all residences
        const residences = await mongoose.connection.db.collection('residences').find({}).toArray();
        console.log(`📊 Total residences: ${residences.length}`);
        
        residences.forEach((residence, index) => {
            console.log(`\n${index + 1}️⃣ ${residence.name}`);
            console.log(`   🆔 ID: ${residence._id}`);
            console.log(`   📍 Address: ${residence.address?.street}, ${residence.address?.city}`);
            console.log(`   🔍 Fields: ${Object.keys(residence).join(', ')}`);
            
            // Check if residences have rooms array
            if (residence.rooms && Array.isArray(residence.rooms)) {
                console.log(`   🏠 Rooms array length: ${residence.rooms.length}`);
                
                if (residence.rooms.length > 0) {
                    console.log('   📋 Sample room structure:');
                    const sampleRoom = residence.rooms[0];
                    console.log(`      Room fields: ${Object.keys(sampleRoom).join(', ')}`);
                    
                    // Check for price-related fields
                    const priceFields = Object.keys(sampleRoom).filter(field => 
                        field.toLowerCase().includes('price') || 
                        field.toLowerCase().includes('rate') ||
                        field.toLowerCase().includes('fee') ||
                        field.toLowerCase().includes('cost') ||
                        field.toLowerCase().includes('rent')
                    );
                    
                    if (priceFields.length > 0) {
                        console.log(`      💰 Price fields found: ${priceFields.join(', ')}`);
                        priceFields.forEach(field => {
                            console.log(`         ${field}: ${sampleRoom[field]}`);
                        });
                    } else {
                        console.log('      ❌ No price fields found in room');
                    }
                    
                    // Show all room data
                    console.log('      📄 Full room data:', JSON.stringify(sampleRoom, null, 2));
                }
            } else {
                console.log('   ❌ No rooms array found');
            }
            
            // Check for other potential pricing structures
            if (residence.roomPricing) {
                console.log('   💰 Found roomPricing field');
                console.log('      📄 Room pricing data:', JSON.stringify(residence.roomPricing, null, 2));
            }
            
            if (residence.pricing) {
                console.log('   💰 Found pricing field');
                console.log('      📄 Pricing data:', JSON.stringify(residence.pricing, null, 2));
            }
            
            if (residence.rates) {
                console.log('   💰 Found rates field');
                console.log('      📄 Rates data:', JSON.stringify(residence.rates, null, 2));
            }
        });
        
        // Check if there's a specific structure we can use
        console.log('\n🔍 Analyzing Room Structure...');
        console.log('===============================');
        
        const residenceWithRooms = residences.find(r => r.rooms && r.rooms.length > 0);
        if (residenceWithRooms) {
            console.log(`\n📋 Sample residence with rooms: ${residenceWithRooms.name}`);
            console.log('🏠 Room structure analysis:');
            
            residenceWithRooms.rooms.forEach((room, index) => {
                console.log(`\n   Room ${index + 1}:`);
                console.log(`      Name: ${room.name || 'N/A'}`);
                console.log(`      Type: ${room.type || 'N/A'}`);
                console.log(`      Price: ${room.price || 'N/A'}`);
                console.log(`      Rent: ${room.rent || 'N/A'}`);
                console.log(`      Rate: ${room.rate || 'N/A'}`);
                console.log(`      Fee: ${room.fee || 'N/A'}`);
                console.log(`      All fields: ${Object.keys(room).join(', ')}`);
            });
        }
        
        // Check applications to see how they reference rooms
        console.log('\n🔍 Checking Applications Room References...');
        console.log('===========================================');
        
        const applications = await mongoose.connection.db.collection('applications').find({
            status: 'approved'
        }).toArray();
        
        console.log(`📊 Approved applications: ${applications.length}`);
        
        if (applications.length > 0) {
            const sampleApp = applications[0];
            console.log('\n📋 Sample application:');
            console.log(`   Student: ${sampleApp.firstName} ${sampleApp.lastName}`);
            console.log(`   Residence ID: ${sampleApp.residence}`);
            console.log(`   Allocated Room: ${sampleApp.allocatedRoom}`);
            console.log(`   Preferred Room: ${sampleApp.preferredRoom}`);
            
            // Find the residence for this application
            const appResidence = residences.find(r => r._id.toString() === sampleApp.residence?.toString());
            if (appResidence) {
                console.log(`   Residence Name: ${appResidence.name}`);
                
                if (appResidence.rooms && Array.isArray(appResidence.rooms)) {
                    const allocatedRoom = sampleApp.allocatedRoom || sampleApp.preferredRoom;
                    const roomData = appResidence.rooms.find(r => r.roomNumber === allocatedRoom);
                    
                    if (roomData) {
                        console.log(`   🏠 Room data found:`, JSON.stringify(roomData, null, 2));
                    } else {
                        console.log(`   ❌ Room ${allocatedRoom} not found in residence rooms`);
                    }
                }
            }
        }
        
        console.log('\n💡 Recommendations:');
        console.log('===================');
        console.log('1. Use the rooms array within residences collection');
        console.log('2. Each room should have price/rent information');
        console.log('3. Link applications to specific rooms by name');
        console.log('4. Update rental accrual service to use residence.rooms pricing');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Residences Room Pricing Check...');
checkResidencesRoomPricing();
