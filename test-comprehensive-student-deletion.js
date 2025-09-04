const mongoose = require('mongoose');
const StudentDeletionService = require('./src/services/studentDeletionService');

// Import models for testing
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Payment = require('./src/models/Payment');
const Debtor = require('./src/models/Debtor');
const Booking = require('./src/models/Booking');
const Lease = require('./src/models/Lease');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const ExpiredStudent = require('./src/models/ExpiredStudent');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function testComprehensiveStudentDeletion() {
    try {
        console.log('🧪 Testing Comprehensive Student Deletion');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Create a test student
        const testStudent = await createTestStudent();
        console.log(`✅ Created test student: ${testStudent.email}`);

        // Create related data
        await createRelatedTestData(testStudent._id);
        console.log('✅ Created related test data');

        // Show data before deletion
        await showDataBeforeDeletion(testStudent._id);

        // Create mock admin user
        const adminUser = {
            _id: new mongoose.Types.ObjectId(),
            email: 'admin@test.com',
            role: 'admin'
        };

        // Test validation first
        console.log('\n🔍 Testing deletion validation...');
        const validation = await StudentDeletionService.validateDeletion(testStudent._id);
        console.log('Validation result:', validation);

        // Perform comprehensive deletion
        console.log('\n🗑️ Performing comprehensive deletion...');
        const deletionSummary = await StudentDeletionService.deleteStudentCompletely(
            testStudent._id.toString(),
            adminUser
        );

        // Show results
        console.log('\n📊 Deletion Summary:');
        console.log('Student:', deletionSummary.studentInfo);
        console.log('Collections affected:', Object.keys(deletionSummary.deletedCollections).length);
        console.log('Total records deleted:', 
            Object.values(deletionSummary.deletedCollections)
                .reduce((sum, item) => sum + item.count, 0)
        );
        console.log('Archived:', deletionSummary.archived);
        console.log('Errors:', deletionSummary.errors.length);

        if (deletionSummary.errors.length > 0) {
            console.log('❌ Errors encountered:');
            deletionSummary.errors.forEach(error => {
                console.log(`  - ${error.step}: ${error.error}`);
            });
        }

        // Detailed breakdown
        console.log('\n📋 Detailed breakdown:');
        Object.entries(deletionSummary.deletedCollections).forEach(([collection, info]) => {
            console.log(`  ${collection}: ${info.count} records (${info.description})`);
        });

        // Verify deletion
        await verifyDeletion(testStudent._id);

        // Check archived data
        const archived = await ExpiredStudent.findOne({ 
            'student._id': testStudent._id 
        });
        if (archived) {
            console.log('\n✅ Student data properly archived');
            console.log(`Archive reason: ${archived.reason}`);
            console.log(`Archive date: ${archived.archivedAt}`);
        } else {
            console.log('\n❌ Student data was not archived');
        }

        console.log('\n✅ Comprehensive student deletion test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

async function createTestStudent() {
    const testStudent = new User({
        email: `test.student.${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'Student',
        phone: '1234567890',
        role: 'student',
        applicationCode: `TEST-${Date.now()}`,
        isVerified: true
    });

    return await testStudent.save();
}

async function createRelatedTestData(studentId) {
    console.log('Creating related test data...');

    // Create application
    const application = new Application({
        student: studentId,
        firstName: 'Test',
        lastName: 'Student',
        email: `test.student.${Date.now()}@example.com`,
        phone: '1234567890',
        program: 'Computer Science',
        applicationCode: `APP-${Date.now()}`,
        status: 'approved'
    });
    await application.save();
    console.log('  ✅ Created application');

    // Create debtor
    const debtor = new Debtor({
        debtorCode: `DBT-${Date.now()}`,
        user: studentId,
        accountCode: `ACC-${Date.now()}`,
        status: 'active',
        currentBalance: 500,
        totalOwed: 1000,
        totalPaid: 500
    });
    await debtor.save();
    console.log('  ✅ Created debtor');

    // Create payments
    const payment1 = new Payment({
        paymentId: `PAY-${Date.now()}-1`,
        student: studentId,
        user: studentId,
        amount: 300,
        totalAmount: 300,
        paymentMonth: '2025-01',
        date: new Date(),
        status: 'completed'
    });
    await payment1.save();

    const payment2 = new Payment({
        paymentId: `PAY-${Date.now()}-2`,
        student: studentId,
        user: studentId,
        amount: 200,
        totalAmount: 200,
        paymentMonth: '2025-02',
        date: new Date(),
        status: 'completed'
    });
    await payment2.save();
    console.log('  ✅ Created payments');

    // Create transactions
    const transaction1 = new Transaction({
        reference: studentId.toString(),
        description: 'Test payment transaction',
        amount: 300,
        type: 'payment',
        date: new Date()
    });
    await transaction1.save();

    const transaction2 = new Transaction({
        reference: studentId.toString(),
        description: 'Test rent transaction',
        amount: 200,
        type: 'rent',
        date: new Date()
    });
    await transaction2.save();
    console.log('  ✅ Created transactions');

    // Create transaction entries
    const entry1 = new TransactionEntry({
        reference: studentId.toString(),
        description: 'Payment entry 1',
        debit: 300,
        credit: 0,
        accountCode: 'cash',
        entryType: 'payment'
    });
    await entry1.save();

    const entry2 = new TransactionEntry({
        reference: studentId.toString(),
        description: 'Payment entry 2',
        debit: 0,
        credit: 300,
        accountCode: 'debtor',
        entryType: 'payment'
    });
    await entry2.save();
    console.log('  ✅ Created transaction entries');

    // Create booking
    const booking = new Booking({
        student: studentId,
        residence: new mongoose.Types.ObjectId(),
        room: 'TEST-ROOM-101',
        status: 'completed',
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await booking.save();
    console.log('  ✅ Created booking');

    // Create lease
    const lease = new Lease({
        studentId: studentId,
        leaseAgreement: 'test-lease-agreement.pdf',
        signedAt: new Date()
    });
    await lease.save();
    console.log('  ✅ Created lease');
}

async function showDataBeforeDeletion(studentId) {
    console.log('\n📊 Data before deletion:');
    
    const student = await User.findById(studentId);
    console.log(`Student: ${student ? '✅' : '❌'}`);

    const applications = await Application.find({ student: studentId });
    console.log(`Applications: ${applications.length}`);

    const debtors = await Debtor.find({ user: studentId });
    console.log(`Debtors: ${debtors.length}`);

    const payments = await Payment.find({ 
        $or: [{ student: studentId }, { user: studentId }] 
    });
    console.log(`Payments: ${payments.length}`);

    const transactions = await Transaction.find({ reference: studentId.toString() });
    console.log(`Transactions: ${transactions.length}`);

    const entries = await TransactionEntry.find({ reference: studentId.toString() });
    console.log(`Transaction Entries: ${entries.length}`);

    const bookings = await Booking.find({ student: studentId });
    console.log(`Bookings: ${bookings.length}`);

    const leases = await Lease.find({ studentId: studentId });
    console.log(`Leases: ${leases.length}`);
}

async function verifyDeletion(studentId) {
    console.log('\n🔍 Verifying deletion...');
    
    const student = await User.findById(studentId);
    console.log(`Student exists: ${student ? '❌ FAILED' : '✅ DELETED'}`);

    const applications = await Application.find({ student: studentId });
    console.log(`Applications remaining: ${applications.length} ${applications.length === 0 ? '✅' : '❌'}`);

    const debtors = await Debtor.find({ user: studentId });
    console.log(`Debtors remaining: ${debtors.length} ${debtors.length === 0 ? '✅' : '❌'}`);

    const payments = await Payment.find({ 
        $or: [{ student: studentId }, { user: studentId }] 
    });
    console.log(`Payments remaining: ${payments.length} ${payments.length === 0 ? '✅' : '❌'}`);

    const transactions = await Transaction.find({ reference: studentId.toString() });
    console.log(`Transactions remaining: ${transactions.length} ${transactions.length === 0 ? '✅' : '❌'}`);

    const entries = await TransactionEntry.find({ reference: studentId.toString() });
    console.log(`Transaction entries remaining: ${entries.length} ${entries.length === 0 ? '✅' : '❌'}`);

    const bookings = await Booking.find({ student: studentId });
    console.log(`Bookings remaining: ${bookings.length} ${bookings.length === 0 ? '✅' : '❌'}`);

    const leases = await Lease.find({ studentId: studentId });
    console.log(`Leases remaining: ${leases.length} ${leases.length === 0 ? '✅' : '❌'}`);
}

// Run the test
if (require.main === module) {
    testComprehensiveStudentDeletion();
}

module.exports = { testComprehensiveStudentDeletion }; 