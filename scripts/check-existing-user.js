const mongoose = require('mongoose');
const User = require('../src/models/User');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function checkExistingUser() {
    try {
        const user = await User.findOne({ 
            email: 'macdonald.sairos@students.uz.ac.zw'
        });

        if (user) {
            console.log('👤 Found user:');
            console.log(`   ID: ${user._id}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Application Code: ${user.applicationCode || 'NOT SET'}`);
            console.log(`   Created: ${user.createdAt}`);
        } else {
            console.log('❌ No user found with email macdonald.sairos@students.uz.ac.zw');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await checkExistingUser();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { checkExistingUser };
