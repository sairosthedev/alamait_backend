const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const Application = require('./src/models/Application');
const Residence = require('./src/models/Residence');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Test configuration
const TEST_EMAIL = `debug-student-${Date.now()}@example.com`;
const TEST_RESIDENCE_ID = 'your-test-residence-id'; // Replace with actual residence ID

async function debugManualAddStudent() {
    try {
        console.log('🔍 Debugging Manual Add Student Flow...');
        
        // 1. Check if test residence exists
        const residence = await Residence.findById(TEST_RESIDENCE_ID);
        if (!residence) {
            console.error('❌ Test residence not found. Please update TEST_RESIDENCE_ID with a valid residence ID.');
            return;
        }
        
        console.log(`✅ Found test residence: ${residence.name}`);
        console.log(`   Rooms available: ${residence.rooms?.length || 0}`);
        
        // 2. Find a room to use
        const room = residence.rooms?.[0];
        if (!room) {
            console.error('❌ No rooms found in residence');
            return;
        }
        
        console.log(`✅ Found room: ${room.roomNumber} - $${room.price}/month`);
        
        // 3. Test the exact data flow that manualAddStudent uses
        console.log('\n🏗️  Testing debtor creation with exact manualAddStudent data...');
        
        // Create test student (simulating the manualAddStudent flow)
        const testStudent = new User({
            email: TEST_EMAIL,
            firstName: 'Debug',
            lastName: 'Student',
            phone: '+1234567890',
            password: 'tempPassword123',
            status: 'active',
            role: 'student',
            isVerified: true
        });
        
        await testStudent.save();
        console.log(`✅ Test student created: ${testStudent.email}`);
        
        // Create test application (simulating the manualAddStudent flow)
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
            actionBy: testStudent._id // Using student ID for testing
        });
        
        await application.save();
        console.log(`✅ Test application created: ${application.applicationCode}`);
        
        // 4. Test debtor creation with exact same parameters as manualAddStudent
        console.log('\n💰 Testing createDebtorForStudent with exact parameters...');
        
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
        
        // 5. Call createDebtorForStudent directly
        const debtor = await createDebtorForStudent(testStudent, debtorOptions);
        
        if (debtor) {
            console.log(`✅ Debtor account created successfully!`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Account Code: ${debtor.accountCode}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Residence: ${debtor.residence}`);
            console.log(`   Room: ${debtor.roomNumber}`);
            console.log(`   Application: ${debtor.application}`);
            
            // 6. Verify debtor exists in database
            const savedDebtor = await Debtor.findOne({ user: testStudent._id });
            if (savedDebtor) {
                console.log(`✅ Debtor verified in database: ${savedDebtor._id}`);
                console.log(`   Application linked: ${savedDebtor.application ? 'Yes' : 'No'}`);
            } else {
                console.log('❌ Debtor not found in database');
            }
            
            // 7. Check if application was updated with debtor reference
            const updatedApplication = await Application.findById(application._id);
            if (updatedApplication.debtor) {
                console.log(`✅ Application updated with debtor reference: ${updatedApplication.debtor}`);
            } else {
                console.log('❌ Application not updated with debtor reference');
            }
            
        } else {
            console.log('⚠️  Debtor creation returned null');
        }
        
        // 8. Cleanup - remove test data
        console.log('\n🧹 Cleaning up test data...');
        if (debtor) {
            await Debtor.deleteOne({ user: testStudent._id });
            console.log('✅ Debtor deleted');
        }
        await Application.deleteOne({ _id: application._id });
        console.log('✅ Application deleted');
        await User.deleteOne({ _id: testStudent._id });
        console.log('✅ Student deleted');
        
        console.log('🎉 Debug test completed successfully!');
        
    } catch (error) {
        console.error('❌ Debug test failed:', error);
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

// Run the debug test
debugManualAddStudent()
    .then(() => {
        console.log('Debug script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Debug script failed:', error);
        process.exit(1);
    });
