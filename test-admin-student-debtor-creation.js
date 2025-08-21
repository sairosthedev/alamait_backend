const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const Residence = require('./src/models/Residence');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Test configuration
const TEST_EMAIL = `test-student-${Date.now()}@example.com`;
const TEST_RESIDENCE_ID = 'your-test-residence-id'; // Replace with actual residence ID

async function testAdminStudentDebtorCreation() {
    try {
        console.log('🧪 Testing Admin Student Debtor Creation...');
        
        // 1. Check if test residence exists
        const residence = await Residence.findById(TEST_RESIDENCE_ID);
        if (!residence) {
            console.error('❌ Test residence not found. Please update TEST_RESIDENCE_ID with a valid residence ID.');
            return;
        }
        
        console.log(`✅ Found test residence: ${residence.name}`);
        
        // 2. Create a test student (simulating admin creation)
        const testStudent = new User({
            email: TEST_EMAIL,
            firstName: 'Test',
            lastName: 'Student',
            phone: '+1234567890',
            password: 'tempPassword123',
            status: 'active',
            role: 'student',
            isVerified: true,
            residence: TEST_RESIDENCE_ID
        });
        
        await testStudent.save();
        console.log(`✅ Test student created: ${testStudent.email}`);
        
        // 3. Try to create debtor account
        console.log('🏗️  Attempting to create debtor account...');
        
        const debtorOptions = {
            residenceId: TEST_RESIDENCE_ID,
            roomNumber: 'TEST-001',
            createdBy: testStudent._id, // Use student as creator for testing
            startDate: new Date(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
            roomPrice: 150,
            notes: 'Test debtor creation from admin student creation'
        };
        
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
        } else {
            console.log('⚠️  Debtor creation returned null');
        }
        
        // 4. Verify debtor exists in database
        const savedDebtor = await Debtor.findOne({ user: testStudent._id });
        if (savedDebtor) {
            console.log(`✅ Debtor verified in database: ${savedDebtor._id}`);
        } else {
            console.log('❌ Debtor not found in database');
        }
        
        // 5. Cleanup - remove test data
        console.log('🧹 Cleaning up test data...');
        await Debtor.deleteOne({ user: testStudent._id });
        await User.deleteOne({ _id: testStudent._id });
        console.log('✅ Test data cleaned up');
        
        console.log('🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Error details:', error.message);
        
        // Try to clean up on error
        try {
            const testStudent = await User.findOne({ email: TEST_EMAIL });
            if (testStudent) {
                await Debtor.deleteOne({ user: testStudent._id });
                await User.deleteOne({ _id: testStudent._id });
                console.log('✅ Cleanup completed after error');
            }
        } catch (cleanupError) {
            console.error('❌ Cleanup failed:', cleanupError.message);
        }
    }
}

// Run the test
testAdminStudentDebtorCreation()
    .then(() => {
        console.log('Test script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
