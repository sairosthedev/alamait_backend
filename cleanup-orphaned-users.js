const mongoose = require('mongoose');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

async function cleanupOrphanedUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all student users
        const users = await User.find({ role: 'student' });
        console.log(`Found ${users.length} student users`);

        let deletedCount = 0;
        let keptCount = 0;

        for (const user of users) {
            // Check if user has any applications
            const application = await Application.findOne({ email: user.email });
            
            if (!application) {
                console.log(`🗑️  Deleting orphaned user: ${user.firstName} ${user.lastName} (${user.email})`);
                await User.findByIdAndDelete(user._id);
                deletedCount++;
            } else {
                console.log(`✅ Keeping user with application: ${user.firstName} ${user.lastName} (${user.email})`);
                keptCount++;
            }
        }

        console.log(`\n=== Cleanup Summary ===`);
        console.log(`Deleted orphaned users: ${deletedCount}`);
        console.log(`Kept users with applications: ${keptCount}`);
        console.log(`Total processed: ${users.length}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

cleanupOrphanedUsers(); 