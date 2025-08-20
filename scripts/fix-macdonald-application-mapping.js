const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
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

async function fixMacdonaldApplicationMapping() {
    try {
        console.log('\n🔍 Fixing Macdonald Sairos Application Mapping...');
        console.log('=' .repeat(60));

        // 1. Find Macdonald's user account
        const macdonaldUser = await User.findOne({
            email: 'macdonald.sairos@students.uz.ac.zw'
        });

        if (!macdonaldUser) {
            console.log('❌ Macdonald Sairos user not found!');
            return;
        }

        console.log(`👤 Found Macdonald Sairos:`);
        console.log(`   User ID: ${macdonaldUser._id}`);
        console.log(`   Name: ${macdonaldUser.firstName} ${macdonaldUser.lastName}`);
        console.log(`   Email: ${macdonaldUser.email}`);
        console.log(`   Application Code: ${macdonaldUser.applicationCode || 'NOT SET'}`);

        if (!macdonaldUser.applicationCode) {
            console.log('❌ User has no application code! Cannot proceed.');
            return;
        }

        // 2. Find application with matching code
        const application = await Application.findOne({
            applicationCode: macdonaldUser.applicationCode
        });

        if (!application) {
            console.log(`❌ No application found with code: ${macdonaldUser.applicationCode}`);
            return;
        }

        console.log(`📋 Found application:`);
        console.log(`   Application ID: ${application._id}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Allocated Room: ${application.allocatedRoom || 'Not set'}`);
        console.log(`   Residence: ${application.residence}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Current Student Field: ${application.student || 'NOT SET'}`);

        // 3. Update application with student field
        if (!application.student || application.student.toString() !== macdonaldUser._id.toString()) {
            application.student = macdonaldUser._id;
            await application.save();
            console.log(`✅ Updated application with student field: ${macdonaldUser._id}`);
        } else {
            console.log(`✅ Application already has correct student field`);
        }

        // 4. Check if debtor exists
        const existingDebtor = await Debtor.findOne({ user: macdonaldUser._id });
        
        if (existingDebtor) {
            console.log(`\n✅ Debtor already exists:`);
            console.log(`   Debtor ID: ${existingDebtor._id}`);
            console.log(`   Debtor Code: ${existingDebtor.debtorCode}`);
            console.log(`   Application Link: ${existingDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${existingDebtor.applicationCode || 'NOT SET'}`);

            // Update debtor with application link if missing
            if (!existingDebtor.application || !existingDebtor.applicationCode) {
                existingDebtor.application = application._id;
                existingDebtor.applicationCode = application.applicationCode;
                await existingDebtor.save();
                console.log(`🔗 Updated debtor with application link`);
            }

            // Link debtor back to application
            if (!application.debtor || application.debtor.toString() !== existingDebtor._id.toString()) {
                application.debtor = existingDebtor._id;
                await application.save();
                console.log(`🔗 Linked debtor back to application`);
            }

        } else {
            console.log(`\n❌ No debtor found for Macdonald!`);
            
            // 5. Create debtor if application is approved
            if (application.status === 'approved') {
                console.log(`🏗️  Application is approved, creating debtor account...`);
                
                try {
                    const { createDebtorForStudent } = require('../src/services/debtorService');
                    
                    // Get residence and room data
                    const residenceId = application.residence;
                    const roomNumber = application.allocatedRoom;
                    
                    if (residenceId && roomNumber) {
                        // Get room price from residence
                        const residence = await Residence.findById(residenceId);
                        let roomPrice = 0;
                        
                        if (residence) {
                            const room = residence.rooms.find(r => r.roomNumber === roomNumber);
                            if (room) {
                                roomPrice = room.price || 0;
                                console.log(`   Room Price: $${roomPrice}`);
                            }
                        }
                        
                        const debtor = await createDebtorForStudent(macdonaldUser, {
                            createdBy: macdonaldUser._id,
                            residenceId: residenceId,
                            roomNumber: roomNumber,
                            roomPrice: roomPrice,
                            startDate: application.startDate,
                            endDate: application.endDate,
                            application: application._id,
                            applicationCode: application.applicationCode
                        });
                        
                        if (debtor) {
                            console.log(`✅ Created debtor account: ${debtor.debtorCode}`);
                            
                            // Link the debtor back to the application
                            application.debtor = debtor._id;
                            await application.save();
                            console.log(`🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                        }
                    } else {
                        console.log(`⚠️  Cannot create debtor: Missing residence or room data`);
                        console.log(`   Residence: ${residenceId || 'Not set'}`);
                        console.log(`   Room: ${roomNumber || 'Not set'}`);
                    }
                } catch (debtorError) {
                    console.error(`❌ Error creating debtor account:`, debtorError.message);
                }
            } else {
                console.log(`ℹ️  Application not approved (${application.status}), debtor will be created when approved`);
            }
        }

        // 6. Final verification
        console.log(`\n🔍 Final Verification:`);
        const finalApplication = await Application.findById(application._id);
        const finalDebtor = await Debtor.findOne({ user: macdonaldUser._id });
        
        console.log(`   Application Student Field: ${finalApplication.student || 'NOT SET'}`);
        console.log(`   Application Debtor Field: ${finalApplication.debtor || 'NOT SET'}`);
        
        if (finalDebtor) {
            console.log(`   Debtor Application Link: ${finalDebtor.application || 'NOT LINKED'}`);
            console.log(`   Debtor Application Code: ${finalDebtor.applicationCode || 'NOT SET'}`);
        }

        console.log('\n🎯 Macdonald application mapping completed!');

    } catch (error) {
        console.error('❌ Error fixing Macdonald application mapping:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await fixMacdonaldApplicationMapping();
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

module.exports = { fixMacdonaldApplicationMapping };
