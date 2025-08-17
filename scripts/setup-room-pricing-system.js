require('dotenv').config();
const mongoose = require('mongoose');

async function setupRoomPricingSystem() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🏠 Setting Up Room Pricing System...');
        console.log('=====================================');
        
        // Get residences
        const residences = await mongoose.connection.db.collection('residences').find({}).toArray();
        const residenceMap = {};
        residences.forEach(residence => {
            residenceMap[residence._id.toString()] = residence;
        });
        
        // Define room pricing structure based on your properties
        const roomPricing = {
            // St Kilda Student House - Student rooms
            'St Kilda Student House': {
                'M1': { rent: 180, adminFee: 20, type: 'Student Room' },
                'M2': { rent: 180, adminFee: 20, type: 'Student Room' },
                'M3': { rent: 180, adminFee: 20, type: 'Student Room' },
                'M4': { rent: 180, adminFee: 20, type: 'Student Room' },
                'M5': { rent: 180, adminFee: 20, type: 'Student Room' },
                'M6': { rent: 180, adminFee: 20, type: 'Student Room' },
                'C1': { rent: 200, adminFee: 25, type: 'Corner Room' },
                'C2': { rent: 200, adminFee: 25, type: 'Corner Room' }
            },
            // Belvedere Student House - Premium rooms
            'Belvedere Student House': {
                'B1': { rent: 200, adminFee: 25, type: 'Premium Room' },
                'B2': { rent: 200, adminFee: 25, type: 'Premium Room' },
                'B3': { rent: 200, adminFee: 25, type: 'Premium Room' },
                'B4': { rent: 200, adminFee: 25, type: 'Premium Room' }
            },
            // Newlands - Standard rooms
            'Newlands': {
                'N1': { rent: 160, adminFee: 15, type: 'Standard Room' },
                'N2': { rent: 160, adminFee: 15, type: 'Standard Room' },
                'N3': { rent: 160, adminFee: 15, type: 'Standard Room' }
            },
            // 1ACP - Budget rooms
            '1ACP': {
                'A1': { rent: 140, adminFee: 15, type: 'Budget Room' },
                'A2': { rent: 140, adminFee: 15, type: 'Budget Room' },
                'A3': { rent: 140, adminFee: 15, type: 'Budget Room' }
            },
            // Fife Avenue - Executive rooms
            'Fife Avenue': {
                'F1': { rent: 220, adminFee: 30, type: 'Executive Room' },
                'F2': { rent: 220, adminFee: 30, type: 'Executive Room' },
                'F3': { rent: 220, adminFee: 30, type: 'Executive Room' }
            }
        };
        
        // Create rooms collection with pricing
        console.log('\n1️⃣ Creating rooms collection with pricing...');
        
        const roomsToInsert = [];
        
        Object.keys(roomPricing).forEach(residenceName => {
            const residence = residences.find(r => r.name === residenceName);
            if (residence) {
                Object.keys(roomPricing[residenceName]).forEach(roomName => {
                    const pricing = roomPricing[residenceName][roomName];
                    roomsToInsert.push({
                        name: roomName,
                        residence: residence._id,
                        residenceName: residenceName,
                        rent: pricing.rent,
                        adminFee: pricing.adminFee,
                        totalMonthly: pricing.rent + pricing.adminFee,
                        type: pricing.type,
                        status: 'available',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                });
            }
        });
        
        // Insert rooms with pricing
        if (roomsToInsert.length > 0) {
            await mongoose.connection.db.collection('rooms').insertMany(roomsToInsert);
            console.log(`   ✅ Created ${roomsToInsert.length} rooms with pricing`);
        }
        
        // Update applications with room pricing info
        console.log('\n2️⃣ Updating applications with room pricing...');
        
        const applications = await mongoose.connection.db.collection('applications').find({
            status: 'approved'
        }).toArray();
        
        let updatedApplications = 0;
        
        for (const app of applications) {
            const residenceId = app.residence?.toString();
            const residence = residences.find(r => r._id.toString() === residenceId);
            const allocatedRoom = app.allocatedRoom || app.preferredRoom;
            
            if (residence && allocatedRoom && roomPricing[residence.name] && roomPricing[residence.name][allocatedRoom]) {
                const pricing = roomPricing[residence.name][allocatedRoom];
                
                await mongoose.connection.db.collection('applications').updateOne(
                    { _id: app._id },
                    { 
                        $set: {
                            roomRent: pricing.rent,
                            roomAdminFee: pricing.adminFee,
                            roomTotalMonthly: pricing.totalMonthly,
                            roomType: pricing.type,
                            updatedAt: new Date()
                        }
                    }
                );
                
                updatedApplications++;
                console.log(`   ✅ Updated ${app.firstName} ${app.lastName} - ${allocatedRoom}: $${pricing.rent} + $${pricing.adminFee} = $${pricing.totalMonthly}`);
            }
        }
        
        console.log(`\n   📊 Updated ${updatedApplications} applications with room pricing`);
        
        // Verify the setup
        console.log('\n3️⃣ Verifying room pricing setup...');
        
        const roomsCount = await mongoose.connection.db.collection('rooms').countDocuments();
        const appsWithPricing = await mongoose.connection.db.collection('applications').countDocuments({
            roomRent: { $exists: true, $ne: null }
        });
        
        console.log(`   🏠 Total rooms with pricing: ${roomsCount}`);
        console.log(`   👥 Applications with pricing: ${appsWithPricing}`);
        
        // Show sample pricing
        console.log('\n4️⃣ Sample room pricing:');
        const sampleRooms = await mongoose.connection.db.collection('rooms').find({}).limit(5).toArray();
        sampleRooms.forEach(room => {
            console.log(`   🏠 ${room.name} (${room.residenceName}): $${room.rent} + $${room.adminFee} = $${room.totalMonthly}`);
        });
        
        // Show sample applications with pricing
        console.log('\n5️⃣ Sample applications with pricing:');
        const sampleApps = await mongoose.connection.db.collection('applications').find({
            roomRent: { $exists: true, $ne: null }
        }).limit(3).toArray();
        
        sampleApps.forEach(app => {
            console.log(`   👤 ${app.firstName} ${app.lastName}`);
            console.log(`      Room: ${app.allocatedRoom}`);
            console.log(`      Rent: $${app.roomRent}/month`);
            console.log(`      Admin Fee: $${app.roomAdminFee}/month`);
            console.log(`      Total: $${app.roomTotalMonthly}/month`);
            console.log('');
        });
        
        console.log('\n✅ Room Pricing System Setup Complete!');
        console.log('=====================================');
        console.log('💡 Now your rental accrual service can use individual room prices');
        console.log('💡 Each student will be charged based on their specific room');
        console.log('💡 Admin fees vary by residence type');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🚀 Starting Room Pricing System Setup...');
setupRoomPricingSystem();
