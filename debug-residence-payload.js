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

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`\n🔍 ${req.method} ${req.path}`);
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔗 Query Params:', JSON.stringify(req.query, null, 2));
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    next();
});

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

const PORT = 5003;

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Debug server running on port ${PORT}`);
    console.log(`📡 Monthly requests endpoint: http://localhost:${PORT}/api/monthly-requests`);
    console.log('\n💡 Now try creating a template from your frontend and check the console output above');
    console.log('💡 The debug middleware will show you exactly what data is being sent');
});

// Keep server running
process.on('SIGINT', () => {
    console.log('\n🔌 Shutting down debug server...');
    server.close(() => {
        process.exit(0);
    });
}); 