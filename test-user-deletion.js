const mongoose = require('mongoose');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

async function testUserDeletion() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the user "Macdonald Sairos" by email
        const userEmail = 'macdonaldsairos01@gmail.com';
        const user = await User.findOne({ email: userEmail });
        
        if (user) {
            console.log('✅ Found user:', {
                id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role
            });
        } else {
            console.log('❌ User not found');
            return;
        }

        // Find the application for this user
        const application = await Application.findOne({ email: userEmail });
        
        if (application) {
            console.log('✅ Found application:', {
                id: application._id,
                email: application.email,
                student: application.student,
                status: application.status
            });
        } else {
            console.log('❌ Application not found');
            return;
        }

        // Test the deletion logic
        console.log('\n=== Testing deletion logic ===');
        
        if (application.student && application.student._id) {
            console.log('Would delete user by student reference:', application.student._id);
        } else if (application.email) {
            console.log('Would delete user by email:', application.email);
            
            // Actually test the deletion
            const deletedUser = await User.findOneAndDelete({ email: application.email });
            if (deletedUser) {
                console.log('✅ Successfully deleted user by email:', application.email);
            } else {
                console.log('❌ Failed to delete user by email');
            }
        } else {
            console.log('❌ No way to identify user for deletion');
        }

        // Verify user is deleted
        const userAfterDeletion = await User.findOne({ email: userEmail });
        if (!userAfterDeletion) {
            console.log('✅ User successfully deleted from database');
        } else {
            console.log('❌ User still exists in database');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testUserDeletion(); 