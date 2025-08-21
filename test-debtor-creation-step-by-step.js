const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const Application = require('./src/models/Application');
const Residence = require('./src/models/Residence');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Test configuration
const TEST_EMAIL = `test-debtor-${Date.now()}@example.com`;
const TEST_RESIDENCE_ID = 'your-test-residence-id'; // Replace with actual residence ID

async function testDebtorCreationStepByStep() {
    try {
        console.log('🔍 Testing Debtor Creation Step by Step...');
        
        // Step 1: Check database connection
        console.log('\n1️⃣ Checking database connection...');
        const dbState = mongoose.connection.readyState;
        const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        console.log(`   Database state: ${dbStates[dbState]} (${dbState})`);
        
        if (dbState !== 1) {
            console.error('❌ Database not connected!');
            return;
        }
        console.log('✅ Database connected');
        
        // Step 2: Check if models are properly loaded
        console.log('\n2️⃣ Checking model imports...');
        console.log(`   User model: ${User ? '✅ Loaded' : '❌ Not loaded'}`);
        console.log(`   Debtor model: ${Debtor ? '✅ Loaded' : '❌ Not loaded'}`);
        console.log(`   Application model: ${Application ? '✅ Loaded' : '❌ Not loaded'}`);
        console.log(`   Residence model: ${Residence ? '✅ Loaded' : '❌ Not loaded'}`);
        console.log(`   createDebtorForStudent service: ${createDebtorForStudent ? '✅ Loaded' : '❌ Not loaded'}`);
        
        // Step 3: Check if test residence exists
        console.log('\n3️⃣ Checking test residence...');
        const residence = await Residence.findById(TEST_RESIDENCE_ID);
        if (!residence) {
            console.error('❌ Test residence not found. Please update TEST_RESIDENCE_ID with a valid residence ID.');
            return;
        }
        
        console.log(`✅ Found test residence: ${residence.name}`);
        console.log(`   Rooms available: ${residence.rooms?.length || 0}`);
        
        // Step 4: Find a room to use
        console.log('\n4️⃣ Finding test room...');
        const room = residence.rooms?.[0];
        if (!room) {
            console.error('❌ No rooms found in residence');
            return;
        }
        
        console.log(`✅ Found room: ${room.roomNumber} - $${room.price}/month`);
        
        // Step 5: Test static methods
        console.log('\n5️⃣ Testing Debtor static methods...');
        try {
            const debtorCode = await Debtor.generateDebtorCode();
            console.log(`✅ Debtor code generated: ${debtorCode}`);
        } catch (error) {
            console.error('❌ Failed to generate debtor code:', error.message);
        }
        
        try {
            const accountCode = await Debtor.generateAccountCode();
            console.log(`✅ Account code generated: ${accountCode}`);
        } catch (error) {
            console.error('❌ Failed to generate account code:', error.message);
        }
        
        // Step 6: Create test student
        console.log('\n6️⃣ Creating test student...');
        const testStudent = new User({
            email: TEST_EMAIL,
            firstName: 'Test',
            lastName: 'Student',
            phone: '+1234567890',
            password: 'tempPassword123',
            status: 'active',
            role: 'student',
            isVerified: true
        });
        
        await testStudent.save();
        console.log(`✅ Test student created: ${testStudent.email} (ID: ${testStudent._id})`);
        
        // Step 7: Create test application
        console.log('\n7️⃣ Creating test application...');
        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const application = new Application({
            student: testStudent._id,
            email: testStudent.email,
            firstName: testStudent.firstName,
            lastName: testStudent.lastName,
            phone: testStudent.phone,
            requestType: 'new',
            status: 'approved',
            paymentStatus: 'paid',
            startDate: new Date(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
            preferredRoom: room.roomNumber,
            allocatedRoom: room.roomNumber,
            residence: residence._id,
            applicationCode: applicationCode,
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: testStudent._id
        });
        
        await application.save();
        console.log(`✅ Test application created: ${application.applicationCode} (ID: ${application._id})`);
        
        // Step 8: Test debtor creation with exact parameters
        console.log('\n8️⃣ Testing createDebtorForStudent...');
        const debtorOptions = {
            residenceId: residence._id,
            roomNumber: room.roomNumber,
            createdBy: testStudent._id,
            application: application._id,
            applicationCode: application.applicationCode,
            startDate: application.startDate,
            endDate: application.endDate,
            roomPrice: room.price
        };
        
        console.log('Debtor options:', JSON.stringify(debtorOptions, null, 2));
        
        // Step 9: Call createDebtorForStudent
        console.log('\n9️⃣ Calling createDebtorForStudent...');
        const debtor = await createDebtorForStudent(testStudent, debtorOptions);
        
        if (debtor) {
            console.log(`✅ Debtor account created successfully!`);
            console.log(`   Debtor ID: ${debtor._id}`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Account Code: ${debtor.accountCode}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Residence: ${debtor.residence}`);
            console.log(`   Room: ${debtor.roomNumber}`);
            console.log(`   Application: ${debtor.application}`);
            
            // Step 10: Verify debtor exists in database
            console.log('\n🔟 Verifying debtor in database...');
            const savedDebtor = await Debtor.findOne({ user: testStudent._id });
            if (savedDebtor) {
                console.log(`✅ Debtor verified in database: ${savedDebtor._id}`);
                console.log(`   Application linked: ${savedDebtor.application ? 'Yes' : 'No'}`);
            } else {
                console.log('❌ Debtor not found in database');
            }
            
            // Step 11: Check if application was updated
            console.log('\n1️⃣1️⃣ Checking application update...');
            const updatedApplication = await Application.findById(application._id);
            if (updatedApplication.debtor) {
                console.log(`✅ Application updated with debtor reference: ${updatedApplication.debtor}`);
            } else {
                console.log('❌ Application not updated with debtor reference');
            }
            
        } else {
            console.log('⚠️  Debtor creation returned null');
        }
        
        // Step 12: Cleanup
        console.log('\n🧹 Cleaning up test data...');
        if (debtor) {
            await Debtor.deleteOne({ user: testStudent._id });
            console.log('✅ Debtor deleted');
        }
        await Application.deleteOne({ _id: application._id });
        console.log('✅ Application deleted');
        await User.deleteOne({ _id: testStudent._id });
        console.log('✅ Student deleted');
        
        console.log('\n🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Try to clean up on error
        try {
            const testStudent = await User.findOne({ email: TEST_EMAIL });
            if (testStudent) {
                await Debtor.deleteOne({ user: testStudent._id });
                await Application.deleteOne({ student: testStudent._id });
                await User.deleteOne({ _id: testStudent._id });
                console.log('✅ Cleanup completed after error');
            }
        } catch (cleanupError) {
            console.error('❌ Cleanup failed:', cleanupError.message);
        }
    }
}

// Run the test
testDebtorCreationStepByStep()
    .then(() => {
        console.log('Test script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
