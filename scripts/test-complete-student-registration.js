const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');

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

async function testCompleteStudentRegistration() {
    try {
        console.log('\n🧪 TESTING COMPLETE STUDENT REGISTRATION FLOW');
        console.log('=' .repeat(70));

        // Step 1: Find an approved application
        console.log('\n1️⃣ FINDING APPROVED APPLICATION');
        console.log('-' .repeat(50));
        
        const application = await Application.findOne({ status: 'approved' }).populate('residence', 'name rooms');
        if (!application) {
            console.log('❌ No approved application found');
            return;
        }

        console.log(`📋 Found approved application:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Name: ${application.firstName} ${application.lastName}`);
        console.log(`   Email: ${application.email}`);
        console.log(`   Application Code: ${application.applicationCode}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence ? application.residence.name : 'NOT SET'}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Student Field: ${application.student || 'NOT LINKED'}`);
        console.log(`   Debtor Field: ${application.debtor || 'NOT LINKED'}`);

        // Step 2: Check current state - clean up if needed
        console.log('\n2️⃣ CLEANING UP EXISTING DATA');
        console.log('-' .repeat(50));
        
        // Delete existing user with this email/application code
        const existingUser = await User.findOne({ 
            $or: [
                { email: application.email },
                { applicationCode: application.applicationCode }
            ]
        });
        
        if (existingUser) {
            console.log(`🗑️ Deleting existing user: ${existingUser.firstName} ${existingUser.lastName}`);
            
            // Delete associated debtor
            const existingDebtor = await Debtor.findOne({ user: existingUser._id });
            if (existingDebtor) {
                await Debtor.findByIdAndDelete(existingDebtor._id);
                console.log(`   🗑️ Deleted associated debtor: ${existingDebtor.debtorCode}`);
            }
            
            await User.findByIdAndDelete(existingUser._id);
            console.log(`   ✅ Existing user deleted`);
        } else {
            console.log(`ℹ️ No existing user found - clean slate`);
        }

        // Reset application linking
        application.student = null;
        application.debtor = null;
        await application.save();
        console.log(`🔄 Reset application linking fields`);

        // Step 3: Extract expected room price from residence
        console.log('\n3️⃣ EXTRACTING EXPECTED ROOM PRICE');
        console.log('-' .repeat(50));
        
        let expectedRoomPrice = 0;
        if (application.residence && application.residence.rooms) {
            const room = application.residence.rooms.find(r => 
                r.roomNumber === application.allocatedRoom
            );
            if (room) {
                expectedRoomPrice = room.price;
                console.log(`🏠 Expected room price: $${expectedRoomPrice} (${application.allocatedRoom})`);
                console.log(`   Room type: ${room.type}`);
                console.log(`   Room status: ${room.status}`);
            } else {
                console.log(`❌ Room "${application.allocatedRoom}" not found in residence`);
            }
        }

        // Calculate expected financial totals
        const startDate = new Date(application.startDate);
        const endDate = new Date(application.endDate);
        const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        const expectedTotalRent = expectedRoomPrice * monthsDiff;
        const expectedAdminFee = application.residence.name.toLowerCase().includes('st kilda') ? 20 : 0;
        const expectedDeposit = expectedRoomPrice;
        const expectedTotalOwed = expectedTotalRent + expectedAdminFee + expectedDeposit;

        console.log(`💰 Expected Financial Calculation:`);
        console.log(`   Duration: ${monthsDiff} months`);
        console.log(`   Monthly Rent: $${expectedRoomPrice}`);
        console.log(`   Total Rent: $${expectedRoomPrice} × ${monthsDiff} = $${expectedTotalRent}`);
        console.log(`   Admin Fee: $${expectedAdminFee}`);
        console.log(`   Deposit: $${expectedDeposit}`);
        console.log(`   Expected Total Owed: $${expectedTotalOwed}`);

        // Step 4: Simulate student registration
        console.log('\n4️⃣ SIMULATING STUDENT REGISTRATION');
        console.log('-' .repeat(50));
        
        console.log(`🚀 Creating new student user with application code...`);
        const newStudent = new User({
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone,
            role: 'student',
            applicationCode: application.applicationCode,
            password: 'tempPassword123',
            isVerified: true
        });

        console.log(`💾 Saving student user (this should trigger middleware)...`);
        await newStudent.save();
        console.log(`✅ Student user created: ${newStudent._id}`);

        // Step 5: Wait for middleware to complete
        console.log('\n5️⃣ WAITING FOR MIDDLEWARE TO COMPLETE');
        console.log('-' .repeat(50));
        console.log(`⏳ Waiting 5 seconds for post-save middleware to complete...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 6: Check if application was linked
        console.log('\n6️⃣ CHECKING APPLICATION LINKING');
        console.log('-' .repeat(50));
        
        const updatedApplication = await Application.findById(application._id);
        if (updatedApplication.student) {
            console.log(`✅ Application linked to student: ${updatedApplication.student}`);
            if (updatedApplication.student.toString() === newStudent._id.toString()) {
                console.log(`   ✅ Student ID matches: ${newStudent._id}`);
            } else {
                console.log(`   ❌ Student ID mismatch: expected ${newStudent._id}, got ${updatedApplication.student}`);
            }
        } else {
            console.log(`❌ Application NOT linked to student`);
        }

        // Step 7: Check if debtor was created
        console.log('\n7️⃣ CHECKING DEBTOR CREATION');
        console.log('-' .repeat(50));
        
        const createdDebtor = await Debtor.findOne({ user: newStudent._id });
        if (createdDebtor) {
            console.log(`✅ Debtor created successfully!`);
            console.log(`   Debtor ID: ${createdDebtor._id}`);
            console.log(`   Debtor Code: ${createdDebtor.debtorCode}`);
            console.log(`   User Link: ${createdDebtor.user}`);
            console.log(`   Application Link: ${createdDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${createdDebtor.applicationCode || 'NOT SET'}`);
            console.log(`   Room Price: $${createdDebtor.roomPrice}`);
            console.log(`   Total Owed: $${createdDebtor.totalOwed}`);
            console.log(`   Current Balance: $${createdDebtor.currentBalance}`);
            console.log(`   Billing Period: ${createdDebtor.billingPeriodLegacy}`);
            console.log(`   Start Date: ${createdDebtor.startDate}`);
            console.log(`   End Date: ${createdDebtor.endDate}`);
            
            // Check if application was back-linked to debtor
            if (updatedApplication.debtor) {
                console.log(`   ✅ Application back-linked to debtor: ${updatedApplication.debtor}`);
                if (updatedApplication.debtor.toString() === createdDebtor._id.toString()) {
                    console.log(`      ✅ Debtor ID matches: ${createdDebtor._id}`);
                } else {
                    console.log(`      ❌ Debtor ID mismatch: expected ${createdDebtor._id}, got ${updatedApplication.debtor}`);
                }
            } else {
                console.log(`   ❌ Application NOT back-linked to debtor`);
            }
        } else {
            console.log(`❌ No debtor created for student ${newStudent._id}`);
        }

        // Step 8: Verify data accuracy
        console.log('\n8️⃣ VERIFYING DATA ACCURACY');
        console.log('-' .repeat(50));
        
        if (createdDebtor) {
            const checks = [
                { 
                    name: 'Room Price Match', 
                    expected: expectedRoomPrice, 
                    actual: createdDebtor.roomPrice,
                    passed: createdDebtor.roomPrice === expectedRoomPrice
                },
                { 
                    name: 'Total Owed Match', 
                    expected: expectedTotalOwed, 
                    actual: createdDebtor.totalOwed,
                    passed: createdDebtor.totalOwed === expectedTotalOwed
                },
                { 
                    name: 'Application Link', 
                    expected: application._id.toString(), 
                    actual: createdDebtor.application ? createdDebtor.application.toString() : 'NOT SET',
                    passed: createdDebtor.application && createdDebtor.application.toString() === application._id.toString()
                },
                { 
                    name: 'Application Code', 
                    expected: application.applicationCode, 
                    actual: createdDebtor.applicationCode || 'NOT SET',
                    passed: createdDebtor.applicationCode === application.applicationCode
                },
                { 
                    name: 'Billing Period', 
                    expected: `${monthsDiff} months`, 
                    actual: createdDebtor.billingPeriodLegacy || 'NOT SET',
                    passed: createdDebtor.billingPeriodLegacy === `${monthsDiff} months`
                }
            ];
            
            console.log(`🔍 Data Accuracy Verification:`);
            checks.forEach(check => {
                const status = check.passed ? '✅' : '❌';
                console.log(`   ${status} ${check.name}: ${check.actual} ${check.passed ? '' : `(expected: ${check.expected})`}`);
            });
            
            const passedChecks = checks.filter(c => c.passed).length;
            const totalChecks = checks.length;
            console.log(`\n📊 Accuracy Score: ${passedChecks}/${totalChecks} checks passed`);
        }

        // Step 9: Final verdict
        console.log('\n9️⃣ FINAL VERDICT');
        console.log('-' .repeat(50));
        
        const success = createdDebtor && 
                       createdDebtor.application && 
                       createdDebtor.applicationCode && 
                       createdDebtor.roomPrice === expectedRoomPrice && 
                       createdDebtor.totalOwed === expectedTotalOwed &&
                       updatedApplication.student &&
                       updatedApplication.debtor;
        
        if (success) {
            console.log(`🎉 SUCCESS: Student registration creates correct debtor!`);
            console.log(`   ✅ Debtor created with correct room price ($${expectedRoomPrice})`);
            console.log(`   ✅ Debtor created with correct total owed ($${expectedTotalOwed})`);
            console.log(`   ✅ Debtor properly linked to application`);
            console.log(`   ✅ Application properly linked to student and debtor`);
            console.log(`   ✅ All financial calculations are accurate`);
            console.log(`   ✅ Complete flow working perfectly!`);
        } else {
            console.log(`❌ FAILURE: Student registration has issues`);
            if (!createdDebtor) console.log(`   - No debtor created`);
            if (createdDebtor && !createdDebtor.application) console.log(`   - Debtor not linked to application`);
            if (createdDebtor && !createdDebtor.applicationCode) console.log(`   - Application code not set`);
            if (createdDebtor && createdDebtor.roomPrice !== expectedRoomPrice) console.log(`   - Wrong room price: got $${createdDebtor.roomPrice}, expected $${expectedRoomPrice}`);
            if (createdDebtor && createdDebtor.totalOwed !== expectedTotalOwed) console.log(`   - Wrong total owed: got $${createdDebtor.totalOwed}, expected $${expectedTotalOwed}`);
            if (!updatedApplication.student) console.log(`   - Application not linked to student`);
            if (!updatedApplication.debtor) console.log(`   - Application not linked to debtor`);
        }

        // Step 10: Cleanup (optional)
        console.log('\n🧹 CLEANUP (keeping data for verification)');
        console.log('-' .repeat(50));
        console.log(`ℹ️ Test data preserved for manual verification:`);
        console.log(`   Student User: ${newStudent._id}`);
        console.log(`   Application: ${application._id}`);
        console.log(`   Debtor: ${createdDebtor ? createdDebtor._id : 'NOT CREATED'}`);

    } catch (error) {
        console.error('❌ Error in complete student registration test:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testCompleteStudentRegistration();
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

module.exports = { testCompleteStudentRegistration };
