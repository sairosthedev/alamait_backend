// Set environment variables for testing
process.env.MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
process.env.JWT_SECRET = 'your-secret-key';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock authentication middleware for testing
const mockAuth = (req, res, next) => {
    // Create a mock admin user
    req.user = {
        _id: '67c023adae5e27657502e887', // Admin user ID
        email: 'admin@alamait.com',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User'
    };
    next();
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Import routes and apply mock auth
const monthlyRequestRoutes = require('./src/routes/monthlyRequestRoutes');
app.use('/api/monthly-requests', mockAuth, monthlyRequestRoutes);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

const PORT = 5001;

// Start server
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Test endpoint: http://localhost:${PORT}/test`);
    console.log(`📡 Monthly requests: http://localhost:${PORT}/api/monthly-requests`);
    
    // Run comprehensive tests
    await runComprehensiveTests();
    
    // Close server after tests
    server.close(() => {
        console.log('\n🔌 Server closed');
        process.exit(0);
    });
});

async function runComprehensiveTests() {
    const axios = require('axios');
    const BASE_URL = `http://localhost:${PORT}/api`;
    
    console.log('\n🧪 Running Comprehensive Monthly Request Tests...\n');
    
    // Test 1: Check server connection
    try {
        console.log('1️⃣ Testing server connection...');
        const response = await axios.get(`http://localhost:${PORT}/test`);
        console.log('✅ Server is running:', response.data);
    } catch (error) {
        console.error('❌ Server connection failed:', error.message);
        return;
    }
    
    // Test 2: Check database connection and data
    try {
        console.log('\n2️⃣ Checking database and monthly requests...');
        const MonthlyRequest = require('./src/models/MonthlyRequest');
        
        const totalCount = await MonthlyRequest.countDocuments();
        console.log(`📊 Total monthly requests in database: ${totalCount}`);
        
        if (totalCount > 0) {
            const sampleRequest = await MonthlyRequest.findOne().lean();
            console.log('📋 Sample request found:');
            console.log(`   ID: ${sampleRequest._id}`);
            console.log(`   Title: ${sampleRequest.title}`);
            console.log(`   Residence: ${sampleRequest.residence}`);
            console.log(`   Month/Year: ${sampleRequest.month}/${sampleRequest.year}`);
            console.log(`   Status: ${sampleRequest.status}`);
        } else {
            console.log('❌ No monthly requests found in database');
        }
        
        // Check residences
        const Residence = require('./src/models/Residence');
        const residences = await Residence.find().select('_id name').lean();
        console.log('\n🏠 Available residences:');
        residences.forEach(res => {
            console.log(`   ${res._id}: ${res.name}`);
        });
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    }
    
    // Test 3: Test GET /api/monthly-requests
    try {
        console.log('\n3️⃣ Testing GET /api/monthly-requests...');
        const response = await axios.get(`${BASE_URL}/monthly-requests`);
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0,
            pagination: response.data.pagination
        });
        console.log('Response structure:', Object.keys(response.data));
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
    
    // Test 4: Test GET /api/monthly-requests/residence/:residenceId/:month/:year
    try {
        console.log('\n4️⃣ Testing GET /api/monthly-requests/residence/:residenceId/:month/:year...');
        const response = await axios.get(`${BASE_URL}/monthly-requests/residence/67c13eb8425a2e078f61d00e/1/2025`);
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0
        });
        console.log('Response structure:', Object.keys(response.data));
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
    
    // Test 5: Test finance dashboard
    try {
        console.log('\n5️⃣ Testing GET /api/monthly-requests/finance/dashboard...');
        const response = await axios.get(`${BASE_URL}/monthly-requests/finance/dashboard`);
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0,
            summary: response.data.summary
        });
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
    
    // Test 6: Test CEO dashboard
    try {
        console.log('\n6️⃣ Testing GET /api/monthly-requests/ceo/dashboard...');
        const response = await axios.get(`${BASE_URL}/monthly-requests/ceo/dashboard`);
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0,
            summary: response.data.summary
        });
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
    
    // Test 7: Test templates
    try {
        console.log('\n7️⃣ Testing GET /api/monthly-requests/templates/:residence...');
        const response = await axios.get(`${BASE_URL}/monthly-requests/templates/67c13eb8425a2e078f61d00e`);
        console.log('✅ Success:', {
            count: response.data.templates?.length || 0
        });
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('\n💡 Summary:');
    console.log('   - If all endpoints return empty results, the issue is no data in database');
    console.log('   - If some endpoints work but others don\'t, check role-based filtering');
    console.log('   - If database has data but API returns empty, check residence ID matching');
} 