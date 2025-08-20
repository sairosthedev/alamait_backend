const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const { createDebtorForStudent } = require('../src/services/debtorService');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function debugRoomPriceExtraction() {
    try {
        console.log('\n🔍 Debugging Room Price Extraction...');
        console.log('=' .repeat(60));

        // Find the specific application
        const application = await Application.findOne({
            email: 'macdonald.sairos@students.uz.ac.zw',
            status: 'approved'
        }).populate('residence', 'name rooms');

        if (!application) {
            console.log('❌ No approved application found');
            return;
        }

        console.log(`📋 Application found: ${application._id}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Application Code: ${application.applicationCode}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Preferred Room: ${application.preferredRoom}`);
        console.log(`   Residence: ${application.residence ? application.residence.name : 'Not set'}`);

        if (application.residence && application.residence.rooms) {
            console.log(`\n🏠 Residence Rooms (${application.residence.rooms.length}):`);
            application.residence.rooms.forEach((room, index) => {
                console.log(`   ${index + 1}. ${room.roomNumber} - $${room.price} (${room.type})`);
                if (room.roomNumber === application.allocatedRoom) {
                    console.log(`      ⭐ THIS IS THE ALLOCATED ROOM - PRICE: $${room.price}`);
                }
            });

            // Test the exact logic from debtorService
            const roomNumber = application.allocatedRoom || application.preferredRoom || application.roomNumber;
            console.log(`\n🔍 Looking for room: "${roomNumber}"`);
            
            const room = application.residence.rooms.find(r => 
                r.roomNumber === roomNumber || r.name === roomNumber
            );
            
            if (room && room.price) {
                console.log(`✅ Found room price: $${room.price}`);
            } else {
                console.log(`❌ Room not found or no price`);
                console.log(`   Searching for: "${roomNumber}"`);
                console.log(`   Available rooms:`, application.residence.rooms.map(r => r.roomNumber));
            }
        }

        // Find the user
        const user = await User.findOne({ applicationCode: application.applicationCode });
        if (!user) {
            console.log('❌ No user found with this application code');
            return;
        }

        console.log(`\n👤 User found: ${user.firstName} ${user.lastName} (${user.email})`);

        // Test the debtor creation/update process
        console.log(`\n🧪 Testing debtor creation/update...`);
        const debtor = await createDebtorForStudent(user, {
            application: application._id,
            applicationCode: application.applicationCode,
            createdBy: user._id
        });

        if (debtor) {
            console.log(`\n✅ Debtor processed: ${debtor.debtorCode}`);
            console.log(`   Room Price: $${debtor.roomPrice}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            console.log(`   Application Link: ${debtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${debtor.applicationCode || 'NOT SET'}`);
        }

    } catch (error) {
        console.error('❌ Error debugging room price extraction:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await debugRoomPriceExtraction();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { debugRoomPriceExtraction };
