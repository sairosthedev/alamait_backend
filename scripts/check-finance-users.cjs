const mongoose = require('mongoose');
const User = require('../src/models/User');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkFinanceUsers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Finding finance users...');
        
        // Find all users with finance-related roles
        const financeUsers = await User.find({
            role: { $in: ['finance', 'finance_admin', 'finance_user'] }
        }).select('email firstName lastName role');

        console.log(`📋 Found ${financeUsers.length} finance users:`);
        
        financeUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
        });

        if (financeUsers.length === 0) {
            console.log('\n🔍 Checking all users...');
            const allUsers = await User.find({}).select('email firstName lastName role');
            
            console.log(`📋 Found ${allUsers.length} total users:`);
            allUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
checkFinanceUsers(); 