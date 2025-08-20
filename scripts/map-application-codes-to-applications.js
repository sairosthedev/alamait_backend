const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');

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

async function mapApplicationCodesToApplications() {
    try {
        console.log('\n🔍 Starting Application Code Mapping Process...');
        console.log('=' .repeat(60));

        // 1. Find all users with application codes
        const usersWithCodes = await User.find({
            applicationCode: { $exists: true, $ne: null, $ne: '' }
        }).select('_id email firstName lastName applicationCode role');

        console.log(`📊 Found ${usersWithCodes.length} users with application codes`);

        if (usersWithCodes.length === 0) {
            console.log('ℹ️  No users with application codes found');
            return;
        }

        let mappedCount = 0;
        let debtorCreatedCount = 0;
        let errors = [];

        // 2. Process each user
        for (const user of usersWithCodes) {
            try {
                console.log(`\n👤 Processing user: ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`   Application Code: ${user.applicationCode}`);
                console.log(`   User ID: ${user._id}`);

                // 3. Find applications with matching application code
                const applications = await Application.find({
                    applicationCode: user.applicationCode
                });

                if (applications.length === 0) {
                    console.log(`   ⚠️  No applications found with code: ${user.applicationCode}`);
                    continue;
                }

                console.log(`   📋 Found ${applications.length} application(s) with matching code`);

                // 4. Update each application with the student field
                for (const application of applications) {
                    try {
                        // Check if application already has a student
                        if (application.student && application.student.toString() === user._id.toString()) {
                            console.log(`   ✅ Application ${application._id} already linked to user ${user._id}`);
                            continue;
                        }

                        // Update the application with the student field
                        application.student = user._id;
                        await application.save();

                        console.log(`   🔗 Linked application ${application._id} to user ${user._id}`);
                        console.log(`      Application Status: ${application.status}`);
                        console.log(`      Allocated Room: ${application.allocatedRoom || 'Not set'}`);

                        mappedCount++;

                        // 5. If application is approved, create debtor account
                        if (application.status === 'approved') {
                            console.log(`   🏗️  Application is approved, checking if debtor exists...`);

                            // Check if debtor already exists for this user
                            const existingDebtor = await Debtor.findOne({ user: user._id });
                            
                            if (existingDebtor) {
                                console.log(`   ✅ Debtor already exists: ${existingDebtor.debtorCode}`);
                                
                                // Update debtor with application link if not already set
                                if (!existingDebtor.application || !existingDebtor.applicationCode) {
                                    existingDebtor.application = application._id;
                                    existingDebtor.applicationCode = application.applicationCode;
                                    await existingDebtor.save();
                                    console.log(`   🔗 Updated debtor with application link`);
                                }
                            } else {
                                console.log(`   🆕 Creating new debtor account for approved application...`);
                                
                                try {
                                    const { createDebtorForStudent } = require('../src/services/debtorService');
                                    
                                    // Get residence and room data from application
                                    const residenceId = application.residence;
                                    const roomNumber = application.allocatedRoom;
                                    
                                    if (residenceId && roomNumber) {
                                        const debtor = await createDebtorForStudent(user, {
                                            createdBy: user._id,
                                            residenceId: residenceId,
                                            roomNumber: roomNumber,
                                            startDate: application.startDate,
                                            endDate: application.endDate,
                                            application: application._id,
                                            applicationCode: application.applicationCode
                                        });
                                        
                                        if (debtor) {
                                            console.log(`   ✅ Created debtor account: ${debtor.debtorCode}`);
                                            debtorCreatedCount++;
                                            
                                            // Link the debtor back to the application
                                            application.debtor = debtor._id;
                                            await application.save();
                                            console.log(`   🔗 Linked debtor ${debtor._id} to application ${application._id}`);
                                        }
                                    } else {
                                        console.log(`   ⚠️  Cannot create debtor: Missing residence or room data`);
                                        console.log(`      Residence: ${residenceId || 'Not set'}`);
                                        console.log(`      Room: ${roomNumber || 'Not set'}`);
                                    }
                                } catch (debtorError) {
                                    console.error(`   ❌ Error creating debtor account:`, debtorError.message);
                                    errors.push({
                                        user: user.email,
                                        application: application._id,
                                        error: debtorError.message
                                    });
                                }
                            }
                        } else {
                            console.log(`   ℹ️  Application not approved (${application.status}), debtor will be created when approved`);
                        }

                    } catch (appError) {
                        console.error(`   ❌ Error processing application ${application._id}:`, appError.message);
                        errors.push({
                            user: user.email,
                            application: application._id,
                            error: appError.message
                        });
                    }
                }

            } catch (userError) {
                console.error(`❌ Error processing user ${user.email}:`, userError.message);
                errors.push({
                    user: user.email,
                    error: userError.message
                });
            }
        }

        // 6. Summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 MAPPING SUMMARY');
        console.log('=' .repeat(60));
        console.log(`✅ Applications mapped: ${mappedCount}`);
        console.log(`🏗️  Debtors created: ${debtorCreatedCount}`);
        console.log(`❌ Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\n❌ ERRORS ENCOUNTERED:');
            errors.forEach((error, index) => {
                console.log(`   ${index + 1}. User: ${error.user}`);
                if (error.application) {
                    console.log(`      Application: ${error.application}`);
                }
                console.log(`      Error: ${error.error}`);
            });
        }

        console.log('\n🎯 Process completed!');

    } catch (error) {
        console.error('❌ Error in mapping process:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await mapApplicationCodesToApplications();
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

module.exports = { mapApplicationCodesToApplications };
