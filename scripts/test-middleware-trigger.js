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

async function testMiddlewareTrigger() {
    try {
        console.log('\n🧪 TESTING MIDDLEWARE TRIGGER');
        console.log('=' .repeat(50));

        // Find the user
        const user = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' });
        if (!user) {
            console.log('❌ No user found');
            return;
        }

        console.log(`👤 Found user: ${user.firstName} ${user.lastName}`);
        console.log(`   Current application code: ${user.applicationCode || 'NOT SET'}`);

        // Test 1: Update application code
        console.log('\n🔄 TEST 1: Updating application code...');
        user.applicationCode = 'APP1755652798191U5LQ7';
        
        console.log(`💾 Saving user...`);
        await user.save();
        console.log(`✅ User saved`);

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 2: Update application code to different value
        console.log('\n🔄 TEST 2: Updating to different application code...');
        user.applicationCode = 'APP1755652798191U5LQ7_UPDATED';
        
        console.log(`💾 Saving user again...`);
        await user.save();
        console.log(`✅ User saved again`);

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n📊 If middleware is working, you should see auto-linking messages above');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testMiddlewareTrigger();
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

module.exports = { testMiddlewareTrigger };
