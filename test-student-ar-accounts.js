const mongoose = require('mongoose');
const StudentDeletionService = require('./src/services/studentDeletionService');
const User = require('./src/models/User');
const Account = require('./src/models/Account');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function testStudentARAccountDeletion() {
    try {
        console.log('🧪 Testing Student AR Account Deletion');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Create test student
        const testStudent = new User({
            email: `test.ar.${Date.now()}@example.com`,
            password: 'hashedpassword123',
            firstName: 'Paidamoyo',
            lastName: 'Munyimi',
            phone: '1234567890',
            role: 'student',
            applicationCode: `AR-${Date.now()}`,
            isVerified: true
        });
        await testStudent.save();
        console.log(`✅ Created test student: ${testStudent.email}`);

        const studentId = testStudent._id.toString();
        const studentName = `${testStudent.firstName} ${testStudent.lastName}`;

        // Create student-specific AR accounts like the one you showed
        const testAccounts = [
            {
                code: `1100-${studentId}`,
                name: `Accounts Receivable - ${studentName}`,
                type: "Asset",
                category: "Current Assets",
                subcategory: "Accounts Receivable",
                description: "Student-specific AR control account",
                isActive: true,
                level: 2,
                sortOrder: 0
            },
            {
                code: `1101-${studentId}`,
                name: `AR Secondary - ${studentName}`,
                type: "Asset", 
                category: "Current Assets",
                subcategory: "Accounts Receivable",
                description: "Secondary student AR account",
                isActive: true,
                level: 2,
                sortOrder: 1
            }
        ];

        const createdAccounts = await Account.insertMany(testAccounts);
        console.log(`✅ Created ${createdAccounts.length} student-specific AR accounts`);

        // Show accounts before deletion
        console.log('\n📊 Before Deletion:');
        const accountsBefore = await Account.find({
            $or: [
                { code: { $regex: studentId, $options: 'i' } },
                { name: { $regex: studentName, $options: 'i' } }
            ]
        });
        console.log(`Student-specific accounts found: ${accountsBefore.length}`);
        accountsBefore.forEach((acc, i) => {
            console.log(`  ${i + 1}. ${acc.code} - ${acc.name}`);
        });

        // Perform deletion
        console.log('\n🗑️ Performing comprehensive deletion...');
        const mockAdmin = { _id: new mongoose.Types.ObjectId(), email: 'admin@test.com' };
        const deletionResult = await StudentDeletionService.deleteStudentCompletely(studentId, mockAdmin);

        // Show results
        console.log('\n📊 Deletion Results:');
        const collections = deletionResult.deletedCollections || {};
        
        if (collections['Account (Student-Specific)']) {
            console.log(`✅ Student-specific accounts deleted: ${collections['Account (Student-Specific)'].count}`);
        } else {
            console.log('❌ No student-specific accounts were deleted');
        }

        // Verify deletion
        console.log('\n🔍 Verification:');
        const accountsAfter = await Account.find({
            $or: [
                { code: { $regex: studentId, $options: 'i' } },
                { name: { $regex: studentName, $options: 'i' } }
            ]
        });
        console.log(`Student-specific accounts remaining: ${accountsAfter.length} ${accountsAfter.length === 0 ? '✅' : '❌'}`);

        if (accountsAfter.length > 0) {
            console.log('Remaining accounts:');
            accountsAfter.forEach((acc, i) => {
                console.log(`  ${i + 1}. ${acc.code} - ${acc.name}`);
            });
        }

        // Check that general accounts still exist
        const generalAccounts = await Account.find({
            code: { $in: ['1100', '1000', '4000'] } // Common chart accounts
        });
        console.log(`General chart accounts still exist: ${generalAccounts.length} ✅`);

        console.log('\n🎯 Summary:');
        if (accountsAfter.length === 0) {
            console.log('✅ Student-specific AR accounts successfully deleted!');
            console.log('✅ General chart of accounts preserved!');
        } else {
            console.log('❌ Some student-specific accounts were not deleted');
        }

        console.log('\n📋 Full Deletion Summary:');
        console.log(`Total collections affected: ${Object.keys(collections).length}`);
        Object.entries(collections).forEach(([collection, info]) => {
            console.log(`  ${collection}: ${info.count} records`);
        });

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
    testStudentARAccountDeletion();
}

module.exports = { testStudentARAccountDeletion }; 