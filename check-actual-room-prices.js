require('dotenv').config();
const mongoose = require('mongoose');

async function checkAndFixRoomPrices() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Checking Actual Room Prices in Residences...');
        console.log('=============================================');

        // Get all residences with their room pricing
        const residences = await mongoose.connection.db.collection('residences').find({}).toArray();
        console.log(`📊 Found ${residences.length} residences`);

        const residenceRoomMap = {};

        residences.forEach(residence => {
            console.log(`\n🏠 ${residence.name}:`);
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residenceRoomMap[residence._id.toString()] = {
                    name: residence.name,
                    rooms: residence.rooms
                };
                
                residence.rooms.forEach(room => {
                    console.log(`   Room ${room.roomNumber}: $${room.price || 'N/A'} (${room.type || 'N/A'})`);
                });
            } else {
                console.log('   ❌ No rooms array found');
            }
        });

        console.log('\n🔍 Checking Current Debtors...');
        console.log('==============================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        let updatedCount = 0;
        let errors = [];

        for (const debtor of debtors) {
            try {
                console.log(`\n👤 Processing: ${debtor.contactInfo?.name || 'Unknown'}`);
                console.log(`   Current Room Price: $${debtor.roomPrice || 'N/A'}`);
                console.log(`   Current Room Number: ${debtor.roomNumber || 'N/A'}`);
                console.log(`   Residence ID: ${debtor.residence || 'N/A'}`);

                let correctRoomPrice = 0;
                let correctRoomNumber = debtor.roomNumber;

                // Get the residence for this debtor
                if (debtor.residence && residenceRoomMap[debtor.residence.toString()]) {
                    const residence = residenceRoomMap[debtor.residence.toString()];
                    console.log(`   Residence: ${residence.name}`);

                    // Try to find the specific room
                    if (debtor.roomNumber) {
                        const room = residence.rooms.find(r => r.roomNumber === debtor.roomNumber);
                        if (room && room.price) {
                            correctRoomPrice = room.price;
                            console.log(`   ✅ Found room ${debtor.roomNumber} with correct price: $${correctRoomPrice}`);
                        } else {
                            console.log(`   ⚠️  Room ${debtor.roomNumber} not found or has no price`);
                        }
                    }

                    // If no specific room found, use first available room's price
                    if (!correctRoomPrice) {
                        const firstRoom = residence.rooms.find(r => r.price && r.price > 0);
                        if (firstRoom) {
                            correctRoomPrice = firstRoom.price;
                            correctRoomNumber = firstRoom.roomNumber;
                            console.log(`   ⚠️  Using fallback room ${firstRoom.roomNumber} with price: $${correctRoomPrice}`);
                        }
                    }

                    // Set default prices based on residence name if still no price
                    if (!correctRoomPrice) {
                        if (residence.name.includes('St Kilda')) {
                            correctRoomPrice = 1200;
                        } else if (residence.name.includes('Belvedere')) {
                            correctRoomPrice = 1500;
                        } else if (residence.name.includes('Ocean')) {
                            correctRoomPrice = 1800;
                        } else {
                            correctRoomPrice = 1200; // Default
                        }
                        console.log(`   ⚠️  Using default price for ${residence.name}: $${correctRoomPrice}`);
                    }

                } else {
                    console.log('   ❌ No residence found or residence has no rooms');
                    // Set default price
                    correctRoomPrice = 1200;
                }

                // Update the debtor if price is different
                if (correctRoomPrice !== (debtor.roomPrice || 0)) {
                    console.log(`   🔄 Updating room price from $${debtor.roomPrice || 'N/A'} to $${correctRoomPrice}`);
                    
                    await mongoose.connection.db.collection('debtors').updateOne(
                        { _id: debtor._id },
                        { 
                            $set: { 
                                roomPrice: correctRoomPrice,
                                roomNumber: correctRoomNumber,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    updatedCount++;
                    console.log(`   ✅ Updated successfully`);
                } else {
                    console.log(`   ✅ Room price is already correct: $${correctRoomPrice}`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor._id}:`, error.message);
                errors.push({ debtorId: debtor._id, error: error.message });
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully updated ${updatedCount} debtors`);
        if (errors.length > 0) {
            console.log(`❌ ${errors.length} errors occurred`);
            errors.forEach(error => {
                console.log(`   - Debtor ${error.debtorId}: ${error.error}`);
            });
        }

        // Show final state
        console.log('\n🔍 Final Debtor Status:');
        console.log('========================');
        const finalDebtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        finalDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'Unknown'}`);
            console.log(`   Room Price: $${debtor.roomPrice || 'N/A'}`);
            console.log(`   Room Number: ${debtor.roomNumber || 'N/A'}`);
            console.log(`   Status: ${debtor.status || 'N/A'}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Room Price Check and Fix...');
checkAndFixRoomPrices();
