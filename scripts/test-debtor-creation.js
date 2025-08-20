const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const { createDebtorForStudent } = require('../src/services/debtorService');

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

async function testDebtorCreation() {
    try {
        console.log('\n🧪 Testing Debtor Creation System...');
        console.log('=' .repeat(60));

        // 1. Find an approved application with application code
        const application = await Application.findOne({
            status: 'approved',
            applicationCode: { $exists: true, $ne: null }
        }).populate('residence', 'name rooms');

        if (!application) {
            console.log('❌ No approved applications with application codes found');
            return;
        }

        console.log(`📋 Found application:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Application Code: ${application.applicationCode}`);
        console.log(`   Email: ${application.email}`);
        console.log(`   Room: ${application.allocatedRoom || 'Not set'}`);
        console.log(`   Residence: ${application.residence ? application.residence.name : 'Not set'}`);

        // 2. Find user with matching application code
        const user = await User.findOne({ applicationCode: application.applicationCode });
        
        if (!user) {
            console.log(`❌ No user found with application code: ${application.applicationCode}`);
            console.log(`   This means the student hasn't registered yet`);
            return;
        }

        console.log(`\n👤 Found user:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Application Code: ${user.applicationCode}`);

        // 3. Check if debtor already exists
        const existingDebtor = await Debtor.findOne({ user: user._id });
        
        if (existingDebtor) {
            console.log(`\n✅ Debtor already exists:`);
            console.log(`   Debtor ID: ${existingDebtor._id}`);
            console.log(`   Debtor Code: ${existingDebtor.debtorCode}`);
            console.log(`   Application Link: ${existingDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${existingDebtor.applicationCode || 'NOT SET'}`);
            
            if (!existingDebtor.application || !existingDebtor.applicationCode) {
                console.log(`\n🔄 Updating existing debtor with application data...`);
                
                try {
                    const updatedDebtor = await createDebtorForStudent(user, {
                        createdBy: user._id,
                        residenceId: application.residence,
                        roomNumber: application.allocatedRoom,
                        startDate: application.startDate,
                        endDate: application.endDate,
                        application: application._id,
                        applicationCode: application.applicationCode
                    });
                    
                    if (updatedDebtor) {
                        console.log(`✅ Updated debtor with application data`);
                        console.log(`   Application Link: ${updatedDebtor.application}`);
                        console.log(`   Application Code: ${updatedDebtor.applicationCode}`);
                    }
                } catch (error) {
                    console.error(`❌ Error updating debtor:`, error.message);
                }
            }
        } else {
            console.log(`\n🏗️  Creating new debtor account...`);
            
            try {
                const debtor = await createDebtorForStudent(user, {
                    createdBy: user._id,
                    residenceId: application.residence,
                    roomNumber: application.allocatedRoom,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    application: application._id,
                    applicationCode: application.applicationCode
                });
                
                if (debtor) {
                    console.log(`✅ Created debtor account: ${debtor.debtorCode}`);
                    console.log(`   Application Link: ${debtor.application}`);
                    console.log(`   Application Code: ${debtor.applicationCode}`);
                    console.log(`   Room Price: $${debtor.roomPrice}`);
                    console.log(`   Total Owed: $${debtor.totalOwed}`);
                    
                    // Link debtor back to application
                    application.debtor = debtor._id;
                    await application.save();
                    console.log(`🔗 Linked debtor back to application`);
                }
            } catch (error) {
                console.error(`❌ Error creating debtor:`, error.message);
            }
        }

        // 4. Final verification
        console.log(`\n🔍 Final Verification:`);
        const finalDebtor = await Debtor.findOne({ user: user._id });
        const finalApplication = await Application.findById(application._id);
        
        if (finalDebtor) {
            console.log(`   Debtor: ${finalDebtor.debtorCode}`);
            console.log(`   Application Link: ${finalDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${finalDebtor.applicationCode || 'NOT SET'}`);
        }
        
        if (finalApplication) {
            console.log(`   Application Debtor Field: ${finalApplication.debtor || 'NOT SET'}`);
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Error in test:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testDebtorCreation();
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

module.exports = { testDebtorCreation };
