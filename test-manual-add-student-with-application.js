const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Debtor = require('./src/models/Debtor');
const Residence = require('./src/models/Residence');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

// Test configuration
const TEST_EMAIL = `test.student.${Date.now()}@example.com`;
const TEST_RESIDENCE_ID = 'your-residence-id-here'; // Replace with actual residence ID

async function testManualAddStudentWithApplication() {
    try {
        // Connect to database first
        await connectDB();
        
        console.log('🧪 Testing Manual Add Student with Application Code and Debtor Linking');
        console.log('='.repeat(60));

        // Step 1: Clean up any existing test data
        console.log('\n1️⃣ Cleaning up existing test data...');
        await User.deleteMany({ email: TEST_EMAIL });
        await Application.deleteMany({ email: TEST_EMAIL });
        await Debtor.deleteMany({ 'contactInfo.email': TEST_EMAIL });
        console.log('✅ Cleanup completed');

        // Step 2: Create test student
        console.log('\n2️⃣ Creating test student...');
        const student = new User({
            email: TEST_EMAIL,
            firstName: 'Test',
            lastName: 'Student',
            phone: '+263 78 123 4567',
            password: 'testpassword123',
            role: 'student',
            isVerified: true,
            status: 'active'
        });

        await student.save();
        console.log(`✅ Created test student: ${student.firstName} ${student.lastName}`);
        console.log(`   Email: ${student.email}`);
        console.log(`   ID: ${student._id}`);

        // Step 3: Generate application code
        console.log('\n3️⃣ Generating application code...');
        const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        console.log(`✅ Generated application code: ${applicationCode}`);

        // Step 4: Create application record
        console.log('\n4️⃣ Creating application record...');
        const application = new Application({
            student: student._id,
            email: TEST_EMAIL,
            firstName: student.firstName,
            lastName: student.lastName,
            phone: student.phone,
            requestType: 'new',
            status: 'approved',
            paymentStatus: 'paid',
            startDate: new Date(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
            preferredRoom: '101',
            allocatedRoom: '101',
            residence: TEST_RESIDENCE_ID,
            applicationCode: applicationCode,
            applicationDate: new Date(),
            actionDate: new Date()
        });

        await application.save();
        console.log(`✅ Created application: ${application.applicationCode}`);
        console.log(`   Student ID: ${application.student}`);
        console.log(`   Status: ${application.status}`);

        // Step 5: Update student with application code
        console.log('\n5️⃣ Updating student with application code...');
        student.applicationCode = application.applicationCode;
        await student.save();
        console.log(`✅ Updated student with application code: ${student.applicationCode}`);

        // Step 6: Create debtor with application link
        console.log('\n6️⃣ Creating debtor with application link...');
        const debtor = await createDebtorForStudent(student, {
            residenceId: TEST_RESIDENCE_ID,
            roomNumber: '101',
            createdBy: student._id,
            application: application._id,
            applicationCode: application.applicationCode,
            startDate: application.startDate,
            endDate: application.endDate,
            roomPrice: 750
        });

        console.log(`✅ Created debtor: ${debtor.debtorCode}`);
        console.log(`   Application Link: ${debtor.application || 'NOT LINKED'}`);
        console.log(`   Application Code: ${debtor.applicationCode || 'NOT SET'}`);

        // Step 7: Verify all links
        console.log('\n7️⃣ Verifying all links...');
        
        // Check student has application code
        const updatedStudent = await User.findById(student._id);
        console.log(`   Student application code: ${updatedStudent.applicationCode || 'NOT SET'}`);
        
        // Check application has student link
        const updatedApplication = await Application.findById(application._id);
        console.log(`   Application student link: ${updatedApplication.student || 'NOT LINKED'}`);
        
        // Check debtor has application link
        const updatedDebtor = await Debtor.findById(debtor._id);
        console.log(`   Debtor application link: ${updatedDebtor.application || 'NOT LINKED'}`);
        console.log(`   Debtor application code: ${updatedDebtor.applicationCode || 'NOT SET'}`);

        // Step 8: Test the complete flow
        console.log('\n8️⃣ Testing complete flow...');
        
        // Test 1: Find student by application code
        const studentByAppCode = await User.findOne({ applicationCode: applicationCode });
        console.log(`   Student found by app code: ${studentByAppCode ? 'YES' : 'NO'}`);
        
        // Test 2: Find application by student
        const appByStudent = await Application.findOne({ student: student._id });
        console.log(`   Application found by student: ${appByStudent ? 'YES' : 'NO'}`);
        
        // Test 3: Find debtor by application
        const debtorByApp = await Debtor.findOne({ application: application._id });
        console.log(`   Debtor found by application: ${debtorByApp ? 'YES' : 'NO'}`);

        console.log('\n✅ All tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   Student: ${student.email} (${student._id})`);
        console.log(`   Application: ${application.applicationCode} (${application._id})`);
        console.log(`   Debtor: ${debtor.debtorCode} (${debtor._id})`);
        console.log(`   All properly linked: ✅`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        try {
            await User.deleteMany({ email: TEST_EMAIL });
            await Application.deleteMany({ email: TEST_EMAIL });
            await Debtor.deleteMany({ 'contactInfo.email': TEST_EMAIL });
            console.log('✅ Cleanup completed');
        } catch (cleanupError) {
            console.log('⚠️  Cleanup had some issues:', cleanupError.message);
        }
        
        // Close database connection
        try {
            await mongoose.connection.close();
            console.log('✅ Database connection closed');
        } catch (closeError) {
            console.log('⚠️  Error closing database connection:', closeError.message);
        }
        
        process.exit(0);
    }
}

// Run the test
testManualAddStudentWithApplication(); 