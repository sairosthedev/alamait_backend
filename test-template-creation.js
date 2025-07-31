// Set environment variables for testing
process.env.MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';
process.env.JWT_SECRET = 'your-secret-key';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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

const PORT = 5002;

// Start server
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // Run template creation test
    await testTemplateCreation();
    
    // Close server after tests
    server.close(() => {
        console.log('\n🔌 Server closed');
        process.exit(0);
    });
});

async function testTemplateCreation() {
    const axios = require('axios');
    const BASE_URL = `http://localhost:${PORT}/api`;
    
    console.log('\n🧪 Testing Template Creation...\n');
    
    // Test 1: Create a template without month/year
    try {
        console.log('1️⃣ Testing template creation without month/year...');
        const templateData = {
            title: "Monthly Requests St Kilda",
            description: "Monthly Requests St Kilda",
            residence: "", // Empty residence for template
            isTemplate: true,
            templateName: "St Kilda Monthly Template",
            templateDescription: "Template for St Kilda monthly requests",
            items: [
                {
                    title: "Wifi",
                    description: "Wifi Payment",
                    priority: "high",
                    estimatedCost: 100,
                    category: "maintenance"
                },
                {
                    title: "Electricity",
                    description: "Electricity for St Kilda",
                    priority: "high",
                    estimatedCost: 200,
                    category: "utilities"
                }
            ]
        };
        
        const response = await axios.post(`${BASE_URL}/monthly-requests`, templateData);
        console.log('✅ Template created successfully!');
        console.log(`   Template ID: ${response.data._id}`);
        console.log(`   Title: ${response.data.title}`);
        console.log(`   Is Template: ${response.data.isTemplate}`);
        console.log(`   Month: ${response.data.month}`);
        console.log(`   Year: ${response.data.year}`);
        console.log(`   Residence: ${response.data.residence}`);
        
        // Clean up - delete the test template
        await axios.delete(`${BASE_URL}/monthly-requests/${response.data._id}`);
        console.log('✅ Test template cleaned up');
        
    } catch (error) {
        console.error('❌ Template creation failed:', error.response?.data || error.message);
    }
    
    // Test 2: Create a regular monthly request (should still work)
    try {
        console.log('\n2️⃣ Testing regular monthly request creation...');
        const regularRequestData = {
            title: "Test Monthly Request",
            description: "Test description",
            residence: "67c13eb8425a2e078f61d00e", // Belvedere ID
            month: 1,
            year: 2025,
            isTemplate: false,
            items: [
                {
                    title: "Test Item",
                    description: "Test item description",
                    priority: "medium",
                    estimatedCost: 50,
                    category: "utilities"
                }
            ]
        };
        
        const response = await axios.post(`${BASE_URL}/monthly-requests`, regularRequestData);
        console.log('✅ Regular request created successfully!');
        console.log(`   Request ID: ${response.data._id}`);
        console.log(`   Title: ${response.data.title}`);
        console.log(`   Is Template: ${response.data.isTemplate}`);
        console.log(`   Month: ${response.data.month}`);
        console.log(`   Year: ${response.data.year}`);
        console.log(`   Residence: ${response.data.residence}`);
        
        // Clean up - delete the test request
        await axios.delete(`${BASE_URL}/monthly-requests/${response.data._id}`);
        console.log('✅ Test request cleaned up');
        
    } catch (error) {
        console.error('❌ Regular request creation failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Template creation tests completed!');
} 