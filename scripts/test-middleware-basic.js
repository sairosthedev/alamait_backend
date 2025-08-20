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

async function testMiddlewareBasic() {
    try {
        console.log('\n🧪 TESTING BASIC MIDDLEWARE FUNCTIONALITY');
        console.log('=' .repeat(60));

        // Test 1: Create a completely new user
        console.log('\n1️⃣ TEST 1: Creating completely new user');
        console.log('-' .repeat(40));
        
        const newUser = new User({
            firstName: 'Test',
            lastName: 'Student',
            email: 'macdonald.sairos@students.uz.ac.zw', // Use real email
            phone: '+1234567890',
            role: 'student',
            applicationCode: 'APP1755652798191U5LQ7', // Use real application code
            password: 'testpass123',
            isVerified: true
        });

        console.log('💾 Saving new user...');
        await newUser.save();
        console.log('✅ New user saved');

        // Wait for middleware
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if debtor was created
        const Debtor = require('../src/models/Debtor');
        const debtor = await Debtor.findOne({ user: newUser._id });
        if (debtor) {
            console.log('✅ Debtor created for new user');
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Application Code: ${debtor.applicationCode || 'NOT SET'}`);
        } else {
            console.log('❌ No debtor created for new user');
        }

        // Test 2: Update existing user
        console.log('\n2️⃣ TEST 2: Updating existing user');
        console.log('-' .repeat(40));
        
        newUser.applicationCode = 'APP1755652798191U5LQ7_UPDATED';
        console.log('💾 Saving updated user...');
        await newUser.save();
        console.log('✅ User updated');

        // Wait for middleware
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if debtor was updated
        const updatedDebtor = await Debtor.findOne({ user: newUser._id });
        if (updatedDebtor && updatedDebtor.applicationCode === 'TEST456') {
            console.log('✅ Debtor updated with new application code');
        } else {
            console.log('❌ Debtor not updated');
        }

        // Cleanup
        console.log('\n🧹 CLEANUP');
        console.log('-' .repeat(40));
        await User.findByIdAndDelete(newUser._id);
        if (debtor) await Debtor.findByIdAndDelete(debtor._id);
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testMiddlewareBasic();
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

module.exports = { testMiddlewareBasic };
