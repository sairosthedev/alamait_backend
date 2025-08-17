require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Test the actual database your backend is using
async function testActualDatabase() {
    try {
        console.log('=== TESTING ACTUAL DATABASE ===');
        console.log('Environment:', process.env.NODE_ENV);
        console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
        
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Check your .env file or environment variables');
            return;
        }

        // Connect using the same URI as your backend
        console.log('\nConnecting to database...');
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');
        console.log('Database name:', conn.connection.name);
        console.log('Host:', conn.connection.host);

        // Check users in the actual database
        console.log('\nChecking users in actual database...');
        const allUsers = await User.find({}).select('_id email firstName lastName role status');
        console.log(`Found ${allUsers.length} users:`);
        
        allUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role} - Status: ${user.status}`);
        });

        // Check admin users specifically
        const adminUsers = await User.find({ role: 'admin' });
        console.log(`\nAdmin users: ${adminUsers.length}`);
        
        if (adminUsers.length > 0) {
            console.log('✅ Admin users found in actual database');
            console.log('This means your backend should work with proper authentication');
        } else {
            console.log('❌ No admin users found in actual database');
            console.log('💡 You need to create an admin user or check your role names');
        }

    } catch (error) {
        console.error('Error testing actual database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testActualDatabase(); 