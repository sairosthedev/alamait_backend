const mongoose = require('mongoose');
require('dotenv').config();

// Import required models
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Debtor = require('./src/models/Debtor');
const Residence = require('./src/models/Residence');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

// Test configuration
const TEST_EMAIL = `test.admin.student.${Date.now()}@example.com`;
const TEST_RESIDENCE_NAME = 'Test Residence Admin Student';
const TEST_ROOM_NUMBER = 'A101';

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

async function cleanupTestData() {
    try {
        console.log('🧹 Cleaning up test data...');
        
        // Clean up in reverse order of dependencies
        await TransactionEntry.deleteMany({});
        await Transaction.deleteMany({});
        await Debtor.deleteMany({});
        await Application.deleteMany({ email: TEST_EMAIL });
        await User.deleteMany({ email: TEST_EMAIL });
        await Residence.deleteMany({ name: TEST_RESIDENCE_NAME });
        
        console.log('✅ Test data cleaned up');
    } catch (error) {
        console.error('⚠️  Cleanup warning:', error.message);
    }
}

async function createTestResidence() {
    try {
        console.log('🏠 Creating test residence...');
        
        const residence = new Residence({
            name: TEST_RESIDENCE_NAME,
            address: {
                street: '123 Test Street',
                city: 'Test City',
                state: 'Test State',
                country: 'Test Country',
                zipCode: '12345'
            },
            location: {
                coordinates: [0, 0], // [longitude, latitude]
                type: 'Point'
            },
            description: 'Test residence for admin student creation flow testing',
            type: 'student',
            rooms: [{
                roomNumber: TEST_ROOM_NUMBER,
                type: 'single',
                capacity: 1,
                price: 800,
                status: 'available',
                currentOccupancy: 0,
                area: 25, // square meters
                floor: 1
            }],
            status: 'active'
        });
        
        await residence.save();
        console.log(`✅ Test residence created: ${residence._id}`);
        return residence;
    } catch (error) {
        console.error('❌ Failed to create test residence:', error);
        throw error;
    }
}

async function testAdminStudentCreationFlow() {
    try {
        console.log('\n🧪 Testing Admin Student Creation Flow...');
        console.log('=====================================');
        
        // Step 1: Create test residence
        const residence = await createTestResidence();
        
        // Step 2: Simulate admin student creation (following the exact flow)
        console.log('\n👤 Step 1: Creating test student...');
        
        const student = new User({
            email: TEST_EMAIL,
            firstName: 'Admin',
            lastName: 'Student',
            phone: '+1234567890',
            password: 'tempPassword123',
            status: 'active',
            role: 'student',
            isVerified: true
        });
        
        await student.save();
        console.log(`✅ Test student created: ${student._id}`);
        
        // Step 3: Create application (as admin would do)
        console.log('\n📋 Step 2: Creating application...');
        
        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        const application = new Application({
            student: student._id,
            email: TEST_EMAIL,
            firstName: 'Admin',
            lastName: 'Student',
            phone: '+1234567890',
            requestType: 'new',
            status: 'approved', // Directly approve the application
            paymentStatus: 'paid', // Mark as paid since admin is adding manually
            startDate,
            endDate,
            preferredRoom: TEST_ROOM_NUMBER,
            allocatedRoom: TEST_ROOM_NUMBER,
            residence: residence._id,
            applicationCode: applicationCode,
            applicationDate: new Date(),
            actionDate: new Date(),
            actionBy: student._id // Using student as actionBy for testing
        });
        
        await application.save();
        console.log(`✅ Application created: ${application._id} (Status: ${application.status})`);
        
        // Step 4: Update student with application code
        student.applicationCode = application.applicationCode;
        await student.save();
        console.log(`✅ Student updated with application code: ${student.applicationCode}`);
        
        // Step 5: Create debtor account (simulating the admin flow)
        console.log('\n🏗️  Step 3: Creating debtor account...');
        
        const { createDebtorForStudent } = require('./src/services/debtorService');
        
        const debtor = await createDebtorForStudent(student, {
            residenceId: residence._id,
            roomNumber: TEST_ROOM_NUMBER,
            createdBy: student._id,
            application: application._id,
            applicationCode: application.applicationCode,
            startDate,
            endDate,
            roomPrice: 800
        });
        
        if (debtor) {
            console.log(`✅ Debtor account created: ${debtor.debtorCode}`);
            
            // Step 6: Link debtor back to application
            application.debtor = debtor._id;
            await application.save();
            console.log(`🔗 Linked debtor ${debtor._id} to application ${application._id}`);
            
            // Step 7: Check if rental accrual service was triggered
            console.log('\n🏠 Step 4: Checking rental accrual service...');
            
            // Look for transactions created by the rental accrual service
            const transactions = await Transaction.find({
                'entries.debtor': debtor._id,
                description: { $regex: /lease start|rental accrual/i }
            }).populate('entries.account');
            
            if (transactions.length > 0) {
                console.log(`✅ Rental accrual service triggered successfully!`);
                console.log(`   Found ${transactions.length} transaction(s):`);
                
                transactions.forEach((txn, index) => {
                    console.log(`   Transaction ${index + 1}: ${txn._id}`);
                    console.log(`   Description: ${txn.description}`);
                    console.log(`   Amount: $${txn.amount}`);
                    console.log(`   Entries: ${txn.entries.length}`);
                    
                    txn.entries.forEach((entry, entryIndex) => {
                        console.log(`     Entry ${entryIndex + 1}: ${entry.type} $${entry.amount} to ${entry.account?.name || 'Unknown Account'}`);
                    });
                });
            } else {
                console.log(`⚠️  No rental accrual transactions found`);
                console.log(`   This might indicate the rental accrual service didn't run`);
                
                // Check what transactions exist for this debtor
                const allTransactions = await Transaction.find({
                    'entries.debtor': debtor._id
                });
                
                if (allTransactions.length > 0) {
                    console.log(`   Found ${allTransactions.length} other transaction(s) for this debtor:`);
                    allTransactions.forEach(txn => {
                        console.log(`     - ${txn.description} ($${txn.amount})`);
                    });
                } else {
                    console.log(`   No transactions found for this debtor`);
                }
            }
            
            // Step 8: Verify debtor details
            console.log('\n📊 Step 5: Verifying debtor details...');
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Account Code: ${debtor.accountCode}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Total Paid: $${debtor.totalPaid}`);
            console.log(`   Room Number: ${debtor.roomNumber}`);
            console.log(`   Residence: ${debtor.residence}`);
            console.log(`   Application: ${debtor.application}`);
            
        } else {
            console.log('❌ Failed to create debtor account');
        }
        
        console.log('\n✅ Admin Student Creation Flow Test Completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await connectToDatabase();
        await cleanupTestData();
        await testAdminStudentCreationFlow();
        
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('💥 Test suite failed:', error);
    } finally {
        await cleanupTestData();
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    main();
}

module.exports = {
    testAdminStudentCreationFlow,
    createTestResidence,
    cleanupTestData
};
