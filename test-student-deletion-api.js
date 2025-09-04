const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Debtor = require('./src/models/Debtor');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';
const API_BASE = 'http://localhost:5000/api';

async function testStudentDeletionAPI() {
    try {
        console.log('🧪 Testing Student Deletion API');
        console.log('=' .repeat(50));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Create test student
        const testStudent = await createTestStudent();
        console.log(`✅ Created test student: ${testStudent.email}`);

        // Create test admin for authentication
        const adminUser = await createTestAdmin();
        console.log(`✅ Created test admin: ${adminUser.email}`);

        // Login admin to get token
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: adminUser.email,
            password: 'password123'
        });

        const authToken = loginResponse.data.token;
        console.log('✅ Admin logged in successfully');

        // Test the deletion API
        console.log(`\n🗑️ Testing deletion of student: ${testStudent._id}`);
        
        const deleteResponse = await axios.delete(
            `${API_BASE}/admin/students/${testStudent._id}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('✅ Deletion API call successful!');
        console.log('Response:', JSON.stringify(deleteResponse.data, null, 2));

        // Verify student is deleted
        const studentExists = await User.findById(testStudent._id);
        console.log(`Student still exists: ${studentExists ? '❌ FAILED' : '✅ DELETED'}`);

        // Clean up admin
        await User.findByIdAndDelete(adminUser._id);
        console.log('✅ Cleaned up test admin');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

async function createTestStudent() {
    const student = new User({
        email: `test.student.${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'Student',
        phone: '1234567890',
        role: 'student',
        applicationCode: `TEST-${Date.now()}`,
        isVerified: true
    });

    const savedStudent = await student.save();

    // Create related application
    const application = new Application({
        student: savedStudent._id,
        firstName: 'Test',
        lastName: 'Student',
        email: savedStudent.email,
        phone: '1234567890',
        program: 'Computer Science',
        applicationCode: savedStudent.applicationCode,
        status: 'approved'
    });
    await application.save();

    // Create related debtor
    const debtor = new Debtor({
        debtorCode: `DBT-${Date.now()}`,
        user: savedStudent._id,
        accountCode: `ACC-${Date.now()}`,
        status: 'active',
        currentBalance: 100,
        totalOwed: 500,
        totalPaid: 400
    });
    await debtor.save();

    return savedStudent;
}

async function createTestAdmin() {
    const bcrypt = require('bcryptjs');
    
    const admin = new User({
        email: `test.admin.${Date.now()}@example.com`,
        password: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'Admin',
        phone: '0987654321',
        role: 'admin',
        isVerified: true
    });

    return await admin.save();
}

// Run the test
if (require.main === module) {
    testStudentDeletionAPI();
}

module.exports = { testStudentDeletionAPI }; 