const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const Application = require('./src/models/Application');
const Residence = require('./src/models/Residence');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Test configuration - use the exact data from your error
const TEST_DATA = {
    email: "Kudzaicindyrellapemhiwa@gmail.com",
    firstName: "Kudzai C ",
    lastName: "Pemhiwa",
    phone: "0786209200",
    emergencyContact: {
        name: "Charity",
        relationship: "mother",
        phone: "0773557720"
    },
    residenceId: "67d723cf20f89c4ae69804f3",
    roomNumber: "M1",
    startDate: "2025-08-20",
    endDate: "2025-12-27",
    monthlyRent: 180,
    securityDeposit: 180,
    adminFee: 20
};

async function debugResidenceIdError() {
    try {
        console.log('🔍 Debugging Residence ID Error...');
        
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
        
        // Step 2: Check if test residence exists
        console.log('\n2️⃣ Checking test residence...');
        const residence = await Residence.findById(TEST_DATA.residenceId);
        if (!residence) {
            console.error('❌ Test residence not found!');
            return;
        }
        
        console.log(`✅ Found test residence: ${residence.name}`);
        console.log(`   Rooms available: ${residence.rooms?.length || 0}`);
        
        // Step 3: Find the specific room
        console.log('\n3️⃣ Finding test room...');
        const room = residence.rooms?.find(r => r.roomNumber === TEST_DATA.roomNumber);
        if (!room) {
            console.error('❌ Room M1 not found in residence');
            return;
        }
        
        console.log(`✅ Found room: ${room.roomNumber} - $${room.price}/month`);
        
        // Step 4: Create test student
        console.log('\n4️⃣ Creating test student...');
        const testStudent = new User({
            email: TEST_DATA.email,
            firstName: TEST_DATA.firstName,
            lastName: TEST_DATA.lastName,
            phone: TEST_DATA.phone,
            password: 'tempPassword123',
            status: 'active',
            emergencyContact: TEST_DATA.emergencyContact,
            role: 'student',
            isVerified: true
        });
        
        await testStudent.save();
        console.log(`✅ Test student created: ${testStudent.email} (ID: ${testStudent._id})`);
        
        // Step 5: Create test application
        console.log('\n5️⃣ Creating test application...');
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
            startDate: new Date(TEST_DATA.startDate),
            endDate: new Date(TEST_DATA.endDate),
            preferredRoom: TEST_DATA.roomNumber,
            allocatedRoom: TEST_DATA.roomNumber,
            residence: TEST_DATA.residenceId,
            applicationCode: applicationCode,
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: testStudent._id
        });
        
        await application.save();
        console.log(`✅ Test application created: ${application.applicationCode} (ID: ${application._id})`);
        
        // Step 6: Test debtor creation with exact parameters
        console.log('\n6️⃣ Testing createDebtorForStudent with exact parameters...');
        const debtorOptions = {
            residenceId: TEST_DATA.residenceId,
            roomNumber: TEST_DATA.roomNumber,
            createdBy: testStudent._id, // Using student ID as createdBy
            application: application._id,
            applicationCode: application.applicationCode,
            startDate: new Date(TEST_DATA.startDate),
            endDate: new Date(TEST_DATA.endDate),
            roomPrice: TEST_DATA.monthlyRent
        };
        
        console.log('Debtor options:', JSON.stringify(debtorOptions, null, 2));
        console.log('   residenceId type:', typeof debtorOptions.residenceId);
        console.log('   residenceId value:', debtorOptions.residenceId);
        
        // Step 7: Call createDebtorForStudent
        console.log('\n7️⃣ Calling createDebtorForStudent...');
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
        } else {
            console.log('⚠️  Debtor creation returned null');
        }
        
        // Step 8: Cleanup
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
            const testStudent = await User.findOne({ email: TEST_DATA.email });
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
debugResidenceIdError()
    .then(() => {
        console.log('Debug script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Debug script failed:', error);
        process.exit(1);
    });
