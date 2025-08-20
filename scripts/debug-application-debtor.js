const mongoose = require('mongoose');
const Application = require('../src/models/Application');
const User = require('../src/models/User');
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

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

async function debugApplicationDebtor(applicationId) {
    try {
        console.log(`\n🔍 Debugging Application: ${applicationId}`);
        console.log('=' .repeat(50));

        // 1. Check if application exists and its status
        const application = await Application.findById(applicationId);
        if (!application) {
            console.log('❌ Application not found!');
            return;
        }

        console.log(`📋 Application Details:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Student ID: ${application.student}`);
        console.log(`   Email: ${application.email}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Debtor Field: ${application.debtor || 'NOT SET'}`);

        // 2. Check if application is actually approved
        if (application.status !== 'approved') {
            console.log(`\n❌ Application is NOT approved! Status: ${application.status}`);
            console.log('   Debtors are only created for approved applications.');
            return;
        }

        console.log(`\n✅ Application is approved - should have debtor`);

        // 3. Check if student user exists
        const studentUser = await User.findById(application.student);
        if (!studentUser) {
            console.log(`\n❌ Student user not found!`);
            console.log(`   Student ID: ${application.student}`);
            console.log(`   This is why no debtor was created.`);
            return;
        }

        console.log(`\n✅ Student user found:`);
        console.log(`   User ID: ${studentUser._id}`);
        console.log(`   Name: ${studentUser.firstName} ${studentUser.lastName}`);
        console.log(`   Email: ${studentUser.email}`);
        console.log(`   Role: ${studentUser.role}`);

        // 4. Check if debtor already exists for this user
        const existingDebtor = await Debtor.findOne({ user: studentUser._id });
        if (existingDebtor) {
            console.log(`\n✅ Debtor already exists:`);
            console.log(`   Debtor ID: ${existingDebtor._id}`);
            console.log(`   Debtor Code: ${existingDebtor.debtorCode}`);
            console.log(`   Account Code: ${existingDebtor.accountCode}`);
            console.log(`   Application Link: ${existingDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${existingDebtor.applicationCode || 'NOT SET'}`);
            
            if (!existingDebtor.application || !existingDebtor.applicationCode) {
                console.log(`\n⚠️  Debtor exists but NOT linked to application!`);
                console.log(`   This means the linking failed during approval.`);
            } else {
                console.log(`\n✅ Debtor is properly linked to application`);
            }
        } else {
            console.log(`\n❌ No debtor found for this user!`);
            console.log(`   This means debtor creation failed during approval.`);
        }

        // 5. Check residence and room data
        if (application.residence) {
            const residence = await Residence.findById(application.residence);
            if (residence) {
                console.log(`\n🏠 Residence Details:`);
                console.log(`   Name: ${residence.name}`);
                console.log(`   ID: ${residence._id}`);
                
                if (application.allocatedRoom) {
                    const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
                    if (room) {
                        console.log(`   Room: ${application.allocatedRoom}`);
                        console.log(`   Room Price: $${room.price || 'NOT SET'}`);
                        console.log(`   Room Capacity: ${room.capacity}`);
                        console.log(`   Room Status: ${room.status}`);
                        
                        if (!room.price) {
                            console.log(`\n⚠️  Room price is not set!`);
                            console.log(`   This could cause debtor creation to fail.`);
                        }
                    } else {
                        console.log(`\n❌ Allocated room not found in residence!`);
                        console.log(`   Room: ${application.allocatedRoom}`);
                    }
                }
            } else {
                console.log(`\n❌ Residence not found!`);
                console.log(`   Residence ID: ${application.residence}`);
            }
        }

        // 6. Check for any recent errors in logs
        console.log(`\n🔍 Debug Summary:`);
        if (application.status === 'approved' && !existingDebtor) {
            console.log(`   ❌ PROBLEM: Application approved but no debtor created`);
            console.log(`   Possible causes:`);
            console.log(`   1. Student user missing or invalid`);
            console.log(`   2. Room price not set`);
            console.log(`   3. Database error during debtor creation`);
            console.log(`   4. Silent failure in debtor service`);
        } else if (application.status === 'approved' && existingDebtor && !existingDebtor.application) {
            console.log(`   ⚠️  PROBLEM: Debtor exists but not linked to application`);
            console.log(`   This means the approval process didn't complete properly.`);
        } else if (application.status === 'approved' && existingDebtor && existingDebtor.application) {
            console.log(`   ✅ SUCCESS: Everything is working correctly`);
        }

    } catch (error) {
        console.error('❌ Error debugging application:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        
        // Get application ID from command line argument
        const applicationId = process.argv[2];
        if (!applicationId) {
            console.log('❌ Please provide an application ID as an argument');
            console.log('Usage: node scripts/debug-application-debtor.js <applicationId>');
            process.exit(1);
        }

        await debugApplicationDebtor(applicationId);
        
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

module.exports = { debugApplicationDebtor };
