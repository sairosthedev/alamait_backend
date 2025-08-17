require('dotenv').config();
const mongoose = require('mongoose');

async function fixMacdonaldRoom() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Fixing Macdonald Executive/Exclusive Room Assignment...');
        console.log('======================================================');

        // Get St Kilda residence to find the Executive/Exclusive room
        const stKildaResidence = await mongoose.connection.db.collection('residences').findOne({
            name: { $regex: /st kilda/i }
        });

        if (!stKildaResidence) {
            console.log('❌ St Kilda residence not found');
            return;
        }

        console.log(`🏠 Found residence: ${stKildaResidence.name}`);
        
        // Find the Executive/Exclusive room
        const executiveRoom = stKildaResidence.rooms.find(room => 
            room.roomNumber === 'Exclusive Room' || 
            room.roomNumber === 'Executive Room' ||
            room.roomNumber.toLowerCase().includes('exclusive') ||
            room.roomNumber.toLowerCase().includes('executive')
        );

        if (!executiveRoom) {
            console.log('❌ Executive/Exclusive room not found in St Kilda');
            console.log('Available rooms:');
            stKildaResidence.rooms.forEach(room => {
                console.log(`   - ${room.roomNumber}: $${room.price} (${room.type})`);
            });
            return;
        }

        console.log(`✅ Found Executive/Exclusive room: ${executiveRoom.roomNumber}`);
        console.log(`   Price: $${executiveRoom.price}/month`);
        console.log(`   Type: ${executiveRoom.type}`);

        // Find Macdonald's debtor record - try multiple search approaches
        let macdonaldDebtor = await mongoose.connection.db.collection('debtors').findOne({
            'contactInfo.email': 'macdonaldsairos01@gmail.com'
        });

        if (!macdonaldDebtor) {
            // Try searching by name
            macdonaldDebtor = await mongoose.connection.db.collection('debtors').findOne({
                'contactInfo.name': { $regex: /macdonald/i }
            });
        }

        if (!macdonaldDebtor) {
            // Try searching by partial name
            macdonaldDebtor = await mongoose.connection.db.collection('debtors').findOne({
                $or: [
                    { 'contactInfo.name': { $regex: /macdonald/i } },
                    { 'contactInfo.name': { $regex: /macdonaldsairos/i } },
                    { 'contactInfo.name': { $regex: /airos/i } }
                ]
            });
        }

        if (!macdonaldDebtor) {
            // List all debtors to help identify
            console.log('❌ Macdonald debtor record not found. Listing all debtors:');
            const allDebtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
            allDebtors.forEach((debtor, index) => {
                console.log(`   ${index + 1}. ${debtor.contactInfo?.name || 'Unknown'} - ${debtor.contactInfo?.email || 'No email'}`);
            });
            return;
        }

        console.log(`\n👤 Found Macdonald: ${macdonaldDebtor.contactInfo?.name || 'Unknown'}`);
        console.log(`   Current Room: ${macdonaldDebtor.roomNumber || 'N/A'}`);
        console.log(`   Current Room Price: $${macdonaldDebtor.roomPrice || 'N/A'}`);
        console.log(`   Current Residence: ${macdonaldDebtor.residence || 'N/A'}`);

        // Calculate correct financial amounts
        const startDate = new Date(macdonaldDebtor.startDate);
        const endDate = new Date(macdonaldDebtor.endDate);
        const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        const correctTotalOwed = executiveRoom.price * monthsDiff;
        const correctCreditLimit = executiveRoom.price * 2;

        console.log(`\n📊 Financial Calculations:`);
        console.log(`   Billing Period: ${monthsDiff} months`);
        console.log(`   Room Price: $${executiveRoom.price}/month`);
        console.log(`   Total Owed: $${executiveRoom.price} × ${monthsDiff} months = $${correctTotalOwed}`);
        console.log(`   Credit Limit: $${executiveRoom.price} × 2 = $${correctCreditLimit}`);

        // Update Macdonald's debtor record
        await mongoose.connection.db.collection('debtors').updateOne(
            { _id: macdonaldDebtor._id },
            { 
                $set: { 
                    roomNumber: executiveRoom.roomNumber,
                    roomPrice: executiveRoom.price,
                    residence: stKildaResidence._id,
                    totalOwed: correctTotalOwed,
                    currentBalance: correctTotalOwed, // Assuming no payments made yet
                    creditLimit: correctCreditLimit,
                    overdueAmount: correctTotalOwed,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`\n✅ Successfully updated Macdonald's record:`);
        console.log(`   Room: ${executiveRoom.roomNumber}`);
        console.log(`   Room Price: $${executiveRoom.price}/month`);
        console.log(`   Residence: ${stKildaResidence.name}`);
        console.log(`   Total Owed: $${correctTotalOwed}`);
        console.log(`   Credit Limit: $${correctCreditLimit}`);

        // Show final state
        console.log('\n🔍 Final Macdonald Status:');
        console.log('==========================');
        const updatedDebtor = await mongoose.connection.db.collection('debtors').findOne({
            _id: macdonaldDebtor._id
        });
        
        console.log(`Name: ${updatedDebtor.contactInfo?.name || 'Unknown'}`);
        console.log(`Room: ${updatedDebtor.roomNumber} - $${updatedDebtor.roomPrice}/month`);
        console.log(`Residence: ${stKildaResidence.name}`);
        console.log(`Billing Period: ${updatedDebtor.billingPeriodLegacy || 'N/A'}`);
        console.log(`Total Owed: $${updatedDebtor.totalOwed}`);
        console.log(`Current Balance: $${updatedDebtor.currentBalance}`);
        console.log(`Status: ${updatedDebtor.status}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Macdonald Room Fix...');
fixMacdonaldRoom();
