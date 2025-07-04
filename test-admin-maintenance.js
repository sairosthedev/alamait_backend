const mongoose = require('mongoose');
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test admin maintenance endpoint with real user
async function testAdminMaintenance() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== TESTING ADMIN MAINTENANCE ENDPOINT ===');

        // Get the admin user
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            console.log('❌ No admin user found');
            return;
        }

        console.log('Admin user found:', adminUser.email);

        // Create a real JWT token
        const token = jwt.sign(
            { user: { id: adminUser._id, email: adminUser.email, role: adminUser.role } },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('JWT token created successfully');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const baseURL = process.env.BASE_URL || 'http://localhost:5000';
        
        console.log('Testing endpoints with base URL:', baseURL);

        // Test 1: Get all maintenance requests
        console.log('\n1. Testing GET /api/admin/maintenance');
        try {
            const response1 = await axios.get(`${baseURL}/api/admin/maintenance`, { headers });
            console.log('✅ Success:', response1.data.requests?.length || 0, 'requests found');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Get maintenance requests with financeStatus=approved
        console.log('\n2. Testing GET /api/admin/maintenance?financeStatus=approved');
        try {
            const response2 = await axios.get(`${baseURL}/api/admin/maintenance?financeStatus=approved`, { headers });
            console.log('✅ Success:', response2.data.requests?.length || 0, 'approved requests found');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            if (error.response?.data) {
                console.log('Error details:', JSON.stringify(error.response.data, null, 2));
            }
        }

        // Test 3: Test finance maintenance endpoint for comparison
        console.log('\n3. Testing GET /api/finance/maintenance?financeStatus=approved');
        try {
            const response3 = await axios.get(`${baseURL}/api/finance/maintenance?financeStatus=approved`, { headers });
            console.log('✅ Success:', response3.data.requests?.length || 0, 'approved requests found');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log('✅ All tests completed');

    } catch (error) {
        console.error('Error testing admin maintenance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testAdminMaintenance(); 