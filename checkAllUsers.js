const mongoose = require('mongoose');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkAllUsers() {
    try {
        console.log('Checking all users in database...');
        
        // Get all users
        const allUsers = await User.find({});
        console.log(`Total users found: ${allUsers.length}`);
        
        // Group by role
        const usersByRole = {};
        allUsers.forEach(user => {
            const role = user.role || 'no-role';
            if (!usersByRole[role]) {
                usersByRole[role] = [];
            }
            usersByRole[role].push(user);
        });
        
        // Display users by role
        Object.keys(usersByRole).forEach(role => {
            console.log(`\n=== ${role.toUpperCase()} (${usersByRole[role].length} users) ===`);
            usersByRole[role].forEach(user => {
                console.log(`- ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`  ID: ${user._id}`);
                console.log(`  Residence: ${user.residence || 'none'}`);
                console.log(`  Room: ${user.currentRoom || 'none'}`);
                console.log(`  Created: ${user.createdAt}`);
                console.log('');
            });
        });
        
        // Check for the specific user we're looking for
        const specificUser = await User.findOne({ 
            email: 'kudzaicindyrellapemhiwa@gmail.com' 
        });
        
        if (specificUser) {
            console.log('\n=== SPECIFIC USER FOUND ===');
            console.log('User:', {
                id: specificUser._id,
                name: `${specificUser.firstName} ${specificUser.lastName}`,
                email: specificUser.email,
                role: specificUser.role,
                residence: specificUser.residence,
                currentRoom: specificUser.currentRoom,
                createdAt: specificUser.createdAt
            });
        } else {
            console.log('\n=== SPECIFIC USER NOT FOUND ===');
            console.log('User with email kudzaicindyrellapemhiwa@gmail.com not found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkAllUsers(); 