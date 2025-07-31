const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';

async function checkAdminUsers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the User model
        const User = require('./src/models/User');

        // Find admin users
        const adminUsers = await User.find({ role: 'admin' }).select('email name role').lean();
        
        console.log(`📊 Found ${adminUsers.length} admin users:`);
        adminUsers.forEach((user, index) => {
            console.log(`${index + 1}. Email: ${user.email}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Role: ${user.role}`);
            console.log('---');
        });

        // Also check for other roles
        console.log('\n👥 All users by role:');
        const roleCounts = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        roleCounts.forEach(role => {
            console.log(`${role._id || 'No role'}: ${role.count}`);
        });

        // Show a few sample users
        console.log('\n📋 Sample users:');
        const sampleUsers = await User.find().limit(5).select('email name role').lean();
        sampleUsers.forEach((user, index) => {
            console.log(`${index + 1}. Email: ${user.email}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Role: ${user.role}`);
            console.log('---');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

checkAdminUsers(); 