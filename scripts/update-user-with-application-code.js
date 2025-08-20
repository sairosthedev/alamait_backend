const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');

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

async function updateUserWithApplicationCode() {
    try {
        console.log('\n🔧 UPDATING USER WITH APPLICATION CODE');
        console.log('=' .repeat(60));

        // Find the application
        const application = await Application.findOne({ status: 'approved' });
        if (!application) {
            console.log('❌ No approved application found');
            return;
        }

        console.log(`📋 Found application: ${application.applicationCode}`);

        // Find the user
        const user = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' });
        if (!user) {
            console.log('❌ No user found');
            return;
        }

        console.log(`👤 Found user: ${user.firstName} ${user.lastName}`);
        console.log(`   Current application code: ${user.applicationCode || 'NOT SET'}`);

        // Delete existing debtor first to test fresh creation
        console.log('\n🗑️  Deleting existing debtor to test fresh creation...');
        const deletedDebtor = await Debtor.findOneAndDelete({ user: user._id });
        if (deletedDebtor) {
            console.log(`✅ Deleted debtor: ${deletedDebtor.debtorCode}`);
        } else {
            console.log(`ℹ️  No existing debtor found`);
        }

        // Update user with application code using findByIdAndUpdate
        console.log(`\n🔄 Updating user with application code: ${application.applicationCode}`);
        
        // Use findByIdAndUpdate to ensure the middleware triggers
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { applicationCode: application.applicationCode },
            { new: true, runValidators: true }
        );
        console.log(`✅ User updated via findByIdAndUpdate`);
        
        // Now save to trigger middleware
        console.log(`💾 Saving user to trigger middleware...`);
        await updatedUser.save();
        console.log(`✅ User saved`);

        // Wait for middleware to complete
        console.log(`\n⏳ Waiting 3 seconds for middleware to complete...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check results
        console.log('\n📊 CHECKING RESULTS');
        console.log('-' .repeat(40));

        // Check application linking
        const updatedApplication = await Application.findById(application._id);
        console.log(`📋 Application student field: ${updatedApplication.student || 'NOT SET'}`);
        console.log(`📋 Application debtor field: ${updatedApplication.debtor || 'NOT SET'}`);

        // Check debtor creation
        const newDebtor = await Debtor.findOne({ user: user._id });
        if (newDebtor) {
            console.log(`✅ New debtor created:`);
            console.log(`   Debtor Code: ${newDebtor.debtorCode}`);
            console.log(`   Room Price: $${newDebtor.roomPrice}`);
            console.log(`   Total Owed: $${newDebtor.totalOwed}`);
            console.log(`   Application Link: ${newDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${newDebtor.applicationCode || 'NOT SET'}`);
            console.log(`   Billing Period: ${newDebtor.billingPeriodLegacy || 'NOT SET'}`);
            
            // Check if room price is correct
            if (newDebtor.roomPrice === 220) {
                console.log(`   ✅ Room price correctly extracted: $220`);
            } else {
                console.log(`   ❌ Room price incorrect: expected $220, got $${newDebtor.roomPrice}`);
            }
        } else {
            console.log(`❌ No debtor created`);
        }

        // Final verdict
        console.log('\n🎯 FINAL VERDICT');
        console.log('-' .repeat(40));
        
        const success = newDebtor && 
                       newDebtor.application && 
                       newDebtor.applicationCode && 
                       newDebtor.roomPrice === 220 && 
                       newDebtor.totalOwed > 0;
        
        if (success) {
            console.log(`🎉 SUCCESS: Debtor creation system is working perfectly!`);
        } else {
            console.log(`❌ FAILURE: Debtor creation system still has issues`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await updateUserWithApplicationCode();
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

module.exports = { updateUserWithApplicationCode };
