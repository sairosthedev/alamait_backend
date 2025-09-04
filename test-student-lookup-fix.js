const mongoose = require('mongoose');
const StudentDeletionService = require('./src/services/studentDeletionService');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function testStudentLookupFix() {
    try {
        console.log('🧪 Testing Student Lookup Fix');
        console.log('=' .repeat(50));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Create test student
        const student = new User({
            email: `test.lookup.${Date.now()}@example.com`,
            password: 'hashedpassword123',
            firstName: 'Lookup',
            lastName: 'Test',
            phone: '1234567890',
            role: 'student',
            applicationCode: `LOOKUP-${Date.now()}`,
            isVerified: true
        });
        await student.save();
        console.log(`✅ Created test student: ${student.email}`);

        // Create application that references the student
        const application = new Application({
            student: student._id,
            firstName: 'Lookup',
            lastName: 'Test',
            email: student.email,
            phone: '1234567890',
            program: 'Computer Science',
            applicationCode: student.applicationCode,
            status: 'approved'
        });
        await application.save();
        console.log(`✅ Created application: ${application._id}`);

        // Test 1: Lookup by User ID (should work)
        console.log('\n🔍 Test 1: Lookup by User ID');
        const lookup1 = await StudentDeletionService.findStudentById(student._id.toString());
        console.log('Result:', lookup1?.source, lookup1?.student?.email);

        // Test 2: Lookup by Application ID (should find User via email)
        console.log('\n🔍 Test 2: Lookup by Application ID');
        const lookup2 = await StudentDeletionService.findStudentById(application._id.toString());
        console.log('Result:', lookup2?.source, lookup2?.student?.email);

        // Test 3: Validation with User ID
        console.log('\n✅ Test 3: Validation with User ID');
        const validation1 = await StudentDeletionService.validateDeletion(student._id.toString());
        console.log('Can delete:', validation1.canDelete);
        console.log('Warnings:', validation1.warnings.length);
        console.log('Blockers:', validation1.blockers.length);

        // Test 4: Validation with Application ID (the problematic case)
        console.log('\n✅ Test 4: Validation with Application ID');
        const validation2 = await StudentDeletionService.validateDeletion(application._id.toString());
        console.log('Can delete:', validation2.canDelete);
        console.log('Warnings:', validation2.warnings.length);
        console.log('Blockers:', validation2.blockers.length);

        if (validation2.canDelete) {
            console.log('🎉 SUCCESS: Can now validate deletion using Application ID!');
        } else {
            console.log('❌ FAILED: Still cannot validate deletion with Application ID');
            console.log('Blockers:', validation2.blockers);
        }

        // Clean up
        await User.findByIdAndDelete(student._id);
        await Application.findByIdAndDelete(application._id);
        console.log('✅ Cleaned up test data');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the test
if (require.main === module) {
    testStudentLookupFix();
}

module.exports = { testStudentLookupFix }; 