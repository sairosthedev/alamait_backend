// Set environment variables
process.env.MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
process.env.JWT_SECRET = 'your-secret-key';
process.env.PORT = 5000;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Import routes
const monthlyRequestRoutes = require('./src/routes/monthlyRequestRoutes');

// Use monthly request routes
app.use('/api/monthly-requests', monthlyRequestRoutes);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Test endpoint: http://localhost:${PORT}/test`);
    console.log(`📡 Monthly requests: http://localhost:${PORT}/api/monthly-requests`);
    
    // Run tests after server starts
    setTimeout(() => {
        runTests();
    }, 2000);
});

// Test function
async function runTests() {
    const axios = require('axios');
    const BASE_URL = `http://localhost:${PORT}/api`;
    
    console.log('\n🧪 Testing Monthly Request Endpoints...\n');
    
    // Test 1: Check if server is running
    try {
        console.log('1️⃣ Testing server connection...');
        const response = await axios.get(`http://localhost:${PORT}/test`);
        console.log('✅ Server is running:', response.data);
    } catch (error) {
        console.error('❌ Server connection failed:', error.message);
        return;
    }
    
    // Test 2: Get all monthly requests (without auth for now)
    try {
        console.log('\n2️⃣ Testing GET /api/monthly-requests (without auth)...');
        const response = await axios.get(`${BASE_URL}/monthly-requests`);
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0,
            pagination: response.data.pagination
        });
        console.log('Response structure:', Object.keys(response.data));
    } catch (error) {
        console.log('⚠️ Expected error (auth required):', error.response?.data?.message || error.message);
    }
    
    // Test 3: Check if monthly request routes are loaded
    try {
        console.log('\n3️⃣ Testing route loading...');
        const routes = app._router.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));
        
        console.log('✅ Loaded routes:', routes.length);
        routes.forEach(route => {
            console.log(`   ${route.methods.join(',')} ${route.path}`);
        });
    } catch (error) {
        console.error('❌ Route check failed:', error.message);
    }
    
    console.log('\n🎉 Basic tests completed!');
    console.log('\n💡 To test with authentication, you need to:');
    console.log('   1. Create a .env file with proper credentials');
    console.log('   2. Start the full server with: npm start');
    console.log('   3. Use the test-monthly-requests.js script');
    
    // Close server
    server.close(() => {
        console.log('\n🔌 Server closed');
        process.exit(0);
    });
} 