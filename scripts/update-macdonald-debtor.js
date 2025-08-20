const mongoose = require('mongoose');
const Debtor = require('../src/models/Debtor');
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');
const User = require('../src/models/User');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Specific debtor ID to update
const DEBTOR_ID = '68a5040c71426fbac6ed84ad';

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
        console.error('❌ Error disconnecting from MongoDB:', error);
    }
}

async function updateMacdonaldDebtor() {
    try {
        console.log('🔍 Finding debtor record for Macdonald Sairos...');
        
        // Find the specific debtor
        const debtor = await Debtor.findById(DEBTOR_ID);
        if (!debtor) {
            console.error(`❌ Debtor with ID ${DEBTOR_ID} not found`);
            return;
        }
        
        console.log(`✅ Found debtor: ${debtor.debtorCode}`);
        console.log(`   User: ${debtor.user}`);
        console.log(`   Current Status: ${debtor.status}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        
        // Find the user (student)
        const user = await User.findById(debtor.user);
        if (!user) {
            console.error(`❌ User not found for debtor: ${debtor.user}`);
            return;
        }
        
        console.log(`👤 Student: ${user.firstName} ${user.lastName} (${user.email})`);
        
        // Find the approved application for this student
        const application = await Application.findOne({
            student: user._id,
            status: 'approved'
        }).populate('residence', 'name rooms');
        
        if (!application) {
            console.error(`❌ No approved application found for student: ${user.email}`);
            return;
        }
        
        console.log(`📋 Application found:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Code: ${application.applicationCode}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Preferred Room: ${application.preferredRoom}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence?.name || 'Unknown'}`);
        
        // Get residence and room information
        const residence = application.residence;
        if (!residence) {
            console.error(`❌ Residence not found for application`);
            return;
        }
        
        // Find room price
        const roomNumber = application.allocatedRoom || application.preferredRoom;
        let roomPrice = 0;
        let roomDetails = null;
        
        if (residence.rooms && residence.rooms.length > 0) {
            const room = residence.rooms.find(r => 
                r.roomNumber === roomNumber || r.name === roomNumber
            );
            if (room) {
                roomPrice = room.price || 0;
                roomDetails = {
                    roomId: room._id,
                    roomType: room.type || room.name,
                    roomCapacity: room.capacity || 1,
                    roomFeatures: room.features || [],
                    roomAmenities: room.amenities || [],
                    roomFloor: room.floor || 1,
                    roomArea: room.area || 0
                };
                console.log(`🏠 Room found: ${room.name || room.roomNumber}`);
                console.log(`   Price: $${roomPrice}`);
                console.log(`   Type: ${room.type || room.name}`);
                console.log(`   Capacity: ${room.capacity || 1}`);
            }
        }
        
        if (!roomPrice) {
            roomPrice = 150; // Default fallback
            console.log(`⚠️  Room price not found, using default: $${roomPrice}`);
        }
        
        // Calculate lease duration and financial obligations
        const startDate = new Date(application.startDate);
        const endDate = new Date(application.endDate);
        const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        
        // Calculate admin fee based on residence
        let adminFee = 0;
        if (residence.name.toLowerCase().includes('st kilda')) {
            adminFee = 20; // St Kilda has $20 admin fee
        }
        
        // Calculate deposit (typically 1 month's rent)
        const deposit = roomPrice;
        
        // Calculate total owed
        const totalRent = roomPrice * monthsDiff;
        const expectedTotal = totalRent + adminFee + deposit;
        
        console.log(`💰 Financial Calculations:`);
        console.log(`   Lease Duration: ${monthsDiff} months`);
        console.log(`   Monthly Rent: $${roomPrice} × ${monthsDiff} = $${totalRent}`);
        console.log(`   Admin Fee: $${adminFee}`);
        console.log(`   Deposit: $${deposit}`);
        console.log(`   Total Owed: $${expectedTotal}`);
        
        // Prepare update data
        const updateData = {
            residence: residence._id,
            roomNumber: roomNumber,
            startDate: startDate,
            endDate: endDate,
            roomPrice: roomPrice,
            totalOwed: expectedTotal,
            currentBalance: expectedTotal - (debtor.totalPaid || 0),
            status: 'active',
            application: application._id,
            applicationCode: application.applicationCode,
            updatedAt: new Date()
        };
        
        // Add room details if available
        if (roomDetails) {
            updateData.roomDetails = roomDetails;
        }
        
        // Add billing period information
        updateData.billingPeriod = {
            type: monthsDiff === 3 ? 'quarterly' : 
                  monthsDiff === 6 ? 'semester' : 
                  monthsDiff === 12 ? 'annual' : 'monthly',
            duration: {
                value: monthsDiff,
                unit: 'months'
            },
            startDate: startDate,
            endDate: endDate,
            billingCycle: {
                frequency: 'monthly',
                dayOfMonth: 1,
                gracePeriod: 5
            },
            amount: {
                monthly: roomPrice,
                total: expectedTotal,
                currency: 'USD'
            },
            status: 'active',
            description: `Billing period for ${user.email}`,
            notes: `Updated from approved application ${application.applicationCode}`,
            autoRenewal: {
                enabled: false,
                renewalType: 'same_period',
                customRenewalPeriod: null
            }
        };
        
        // Add financial breakdown
        updateData.financialBreakdown = {
            monthlyRent: roomPrice,
            numberOfMonths: monthsDiff,
            totalRent: totalRent,
            adminFee: adminFee,
            deposit: deposit,
            totalOwed: expectedTotal
        };
        
        // Update the debtor
        console.log(`\n🔄 Updating debtor record...`);
        const updatedDebtor = await Debtor.findByIdAndUpdate(
            DEBTOR_ID,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (updatedDebtor) {
            console.log(`✅ Debtor updated successfully!`);
            console.log(`\n📊 Updated Debtor Details:`);
            console.log(`   Residence: ${updatedDebtor.residence}`);
            console.log(`   Room: ${updatedDebtor.roomNumber}`);
            console.log(`   Start Date: ${updatedDebtor.startDate}`);
            console.log(`   End Date: ${updatedDebtor.endDate}`);
            console.log(`   Room Price: $${updatedDebtor.roomPrice}`);
            console.log(`   Total Owed: $${updatedDebtor.totalOwed}`);
            console.log(`   Current Balance: $${updatedDebtor.currentBalance}`);
            console.log(`   Application: ${updatedDebtor.application}`);
            console.log(`   Application Code: ${updatedDebtor.applicationCode}`);
            console.log(`   Status: ${updatedDebtor.status}`);
            
            // Also update the application to link back to the debtor
            application.debtor = updatedDebtor._id;
            await application.save();
            console.log(`✅ Application linked back to debtor`);
            
        } else {
            console.error(`❌ Failed to update debtor`);
        }
        
    } catch (error) {
        console.error('❌ Error updating Macdonald debtor:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('🚀 Starting Macdonald debtor update...');
        
        await updateMacdonaldDebtor();
        
        console.log('\n🏁 Macdonald debtor update completed!');
        
    } catch (error) {
        console.error('❌ Error in main function:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

// Run the script
if (require.main === module) {
    (async () => {
        await connectToDatabase();
        await main();
        await disconnectFromDatabase();
        console.log('🏁 Script completed');
    })();
}

module.exports = { main, updateMacdonaldDebtor, connectToDatabase, disconnectFromDatabase };
