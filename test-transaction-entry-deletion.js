const mongoose = require('mongoose');
const StudentDeletionService = require('./src/services/studentDeletionService');
const User = require('./src/models/User');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function testTransactionEntryAndAccountDeletion() {
    try {
        console.log('🧪 Testing Transaction Entry & Account Deletion');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Create test student
        const testStudent = new User({
            email: `test.transaction.${Date.now()}@example.com`,
            password: 'hashedpassword123',
            firstName: 'Transaction',
            lastName: 'Test',
            phone: '1234567890',
            role: 'student',
            applicationCode: `TXN-${Date.now()}`,
            isVerified: true
        });
        await testStudent.save();
        console.log(`✅ Created test student: ${testStudent.email}`);

        const studentId = testStudent._id.toString();

        // Create various transaction entries with different patterns
        const testEntries = [
            // Pattern 1: Reference as string
            {
                reference: studentId,
                description: 'Test payment entry 1',
                accountCode: 'cash',
                debit: 100,
                credit: 0,
                entryType: 'payment'
            },
            // Pattern 2: Reference as ObjectId
            {
                reference: new mongoose.Types.ObjectId(studentId),
                description: 'Test payment entry 2',
                accountCode: 'debtors',
                debit: 0,
                credit: 100,
                entryType: 'payment'
            },
            // Pattern 3: Description contains email
            {
                reference: 'GENERAL-ENTRY',
                description: `Payment from ${testStudent.email}`,
                accountCode: 'cash',
                debit: 50,
                credit: 0,
                entryType: 'payment'
            },
            // Pattern 4: Description contains name
            {
                reference: 'RENT-ENTRY',
                description: `Rent payment for ${testStudent.firstName} ${testStudent.lastName}`,
                accountCode: 'rental_income',
                debit: 0,
                credit: 500,
                entryType: 'rent'
            },
            // Pattern 5: Payment reference pattern
            {
                reference: `PAYMENT-${studentId}`,
                description: 'Payment allocation entry',
                accountCode: 'cash',
                debit: 200,
                credit: 0,
                entryType: 'payment'
            }
        ];

        const createdEntries = await TransactionEntry.insertMany(testEntries);
        console.log(`✅ Created ${createdEntries.length} test transaction entries`);

        // Create test accounts
        const testAccounts = [
            {
                student: testStudent._id,
                accountCode: `STU-${studentId}`,
                balance: 1000,
                type: 'student_account'
            },
            {
                user: testStudent._id,
                accountCode: `USER-${studentId}`,
                balance: 500,
                type: 'user_account'
            }
        ];

        const createdAccounts = await Account.insertMany(testAccounts);
        console.log(`✅ Created ${createdAccounts.length} test accounts`);

        // Show counts before deletion
        console.log('\n📊 Before Deletion:');
        const entriesBefore = await TransactionEntry.find({
            $or: [
                { reference: studentId },
                { reference: new mongoose.Types.ObjectId(studentId) },
                { description: { $regex: testStudent.email, $options: 'i' } },
                { description: { $regex: `${testStudent.firstName} ${testStudent.lastName}`, $options: 'i' } },
                { reference: { $regex: `PAYMENT.*${studentId}`, $options: 'i' } }
            ]
        });
        console.log(`Transaction entries: ${entriesBefore.length}`);

        const accountsBefore = await Account.find({
            $or: [{ student: testStudent._id }, { user: testStudent._id }]
        });
        console.log(`Accounts: ${accountsBefore.length}`);

        // Perform deletion
        console.log('\n🗑️ Performing comprehensive deletion...');
        const mockAdmin = { _id: new mongoose.Types.ObjectId(), email: 'admin@test.com' };
        const deletionResult = await StudentDeletionService.deleteStudentCompletely(studentId, mockAdmin);

        // Show results
        console.log('\n📊 Deletion Results:');
        console.log('Collections affected:', Object.keys(deletionResult.deletedCollections || {}).length);
        
        // Check specific collections
        const collections = deletionResult.deletedCollections || {};
        if (collections['TransactionEntry']) {
            console.log(`TransactionEntry (basic): ${collections['TransactionEntry'].count} deleted`);
        }
        if (collections['TransactionEntry (Advanced)']) {
            console.log(`TransactionEntry (advanced): ${collections['TransactionEntry (Advanced)'].count} deleted`);
        }
        if (collections['Account']) {
            console.log(`Account: ${collections['Account'].count} deleted`);
        }

        // Verify deletion
        console.log('\n🔍 Verification:');
        const entriesAfter = await TransactionEntry.find({
            $or: [
                { reference: studentId },
                { reference: new mongoose.Types.ObjectId(studentId) },
                { description: { $regex: testStudent.email, $options: 'i' } },
                { description: { $regex: `${testStudent.firstName} ${testStudent.lastName}`, $options: 'i' } },
                { reference: { $regex: `PAYMENT.*${studentId}`, $options: 'i' } }
            ]
        });
        console.log(`Transaction entries remaining: ${entriesAfter.length} ${entriesAfter.length === 0 ? '✅' : '❌'}`);

        const accountsAfter = await Account.find({
            $or: [{ student: testStudent._id }, { user: testStudent._id }]
        });
        console.log(`Accounts remaining: ${accountsAfter.length} ${accountsAfter.length === 0 ? '✅' : '❌'}`);

        if (entriesAfter.length > 0) {
            console.log('Remaining entries:');
            entriesAfter.forEach((entry, index) => {
                console.log(`  ${index + 1}. Ref: ${entry.reference}, Desc: ${entry.description}`);
            });
        }

        if (accountsAfter.length > 0) {
            console.log('Remaining accounts:');
            accountsAfter.forEach((account, index) => {
                console.log(`  ${index + 1}. Code: ${account.accountCode}, Type: ${account.type}`);
            });
        }

        console.log('\n🎯 Summary:');
        if (entriesAfter.length === 0 && accountsAfter.length === 0) {
            console.log('✅ All transaction entries and accounts successfully deleted!');
        } else {
            console.log('❌ Some records were not deleted - check the patterns');
        }

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
    testTransactionEntryAndAccountDeletion();
}

module.exports = { testTransactionEntryAndAccountDeletion }; 