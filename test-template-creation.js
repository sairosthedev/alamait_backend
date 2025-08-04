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

const axios = require('axios');

const BASE_URL = 'http://localhost:5002';

async function testTemplateCreation() {
    try {
        console.log('🧪 Testing template creation...');
        
        const templateData = {
            title: "Test Template",
            description: "A test template for monthly requests",
            residence: "67d723cf20f89c4ae69804f3", // Replace with actual residence ID
            isTemplate: true, // This is the key field!
            items: [
                {
                    title: "Test Item 1",
                    description: "First test item",
                    quantity: 1,
                    estimatedCost: 100,
                    category: "maintenance",
                    priority: "medium"
                },
                {
                    title: "Test Item 2", 
                    description: "Second test item",
                    quantity: 2,
                    estimatedCost: 50,
                    category: "utilities",
                    priority: "low"
                }
            ]
        };

        console.log('📤 Sending POST request to /api/monthly-requests...');
        console.log('📋 Request data:', JSON.stringify(templateData, null, 2));
        
        const response = await axios.post(`${BASE_URL}/api/monthly-requests`, templateData, {
            headers: {
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });
        
        console.log('✅ Template created successfully!');
        console.log('📊 Response status:', response.status);
        console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
        
        return response.data;
        
    } catch (error) {
        console.log('❌ Error creating template:');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🔌 Connection refused - server might not be running on port 5002');
            console.log('💡 Try starting the server with: npm start');
        } else if (error.code === 'ENOTFOUND') {
            console.log('🌐 Could not connect to localhost:5002');
        } else if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
        
        if (error.response?.status === 404) {
            console.log('\n🔍 The 404 error suggests the endpoint might not be registered properly.');
            console.log('📋 Make sure you are using: POST /api/monthly-requests');
            console.log('📋 And include isTemplate: true in the request body');
        }
        
        throw error;
    }
}

// Run the test
testTemplateCreation()
    .then(() => {
        console.log('\n✅ Template creation test completed');
        process.exit(0);
    })
    .catch(() => {
        console.log('\n❌ Template creation test failed');
        process.exit(1);
    }); 