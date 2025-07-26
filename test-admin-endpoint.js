require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function testAdminEndpoint() {
    try {
        // Connect to MongoDB using environment variable
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        const financeUserId = "67f4ef0fcb87ffa3fb7e2d73";
        
        console.log('\n=== TESTING ADMIN USER CONTROLLER ENDPOINTS ===');
        
        // Test 1: getAllUsers (simulating GET /api/admin/users)
        console.log('\n1. Testing getAllUsers (GET /api/admin/users):');
        const allUsers = await User.find().select('-password');
        
        console.log(`Found ${allUsers.length} users`);
        
        // Find the finance user in the results
        const financeUser = allUsers.find(u => u._id.toString() === financeUserId);
        if (financeUser) {
            console.log('✅ Finance user found in getAllUsers:');
            console.log('  Email:', financeUser.email);
            console.log('  Name:', financeUser.firstName, financeUser.lastName);
            console.log('  Role:', financeUser.role);
            console.log('  Role field present:', 'role' in financeUser);
            console.log('  All fields:', Object.keys(financeUser));
        } else {
            console.log('❌ Finance user NOT found in getAllUsers');
        }

        // Test 2: getUserById (simulating GET /api/admin/users/:id)
        console.log('\n2. Testing getUserById (GET /api/admin/users/:id):');
        const specificUser = await User.findById(financeUserId).select('-password');
        
        if (specificUser) {
            console.log('✅ Finance user found by getUserById:');
            console.log('  Email:', specificUser.email);
            console.log('  Name:', specificUser.firstName, specificUser.lastName);
            console.log('  Role:', specificUser.role);
            console.log('  Role field present:', 'role' in specificUser);
            console.log('  All fields:', Object.keys(specificUser));
        } else {
            console.log('❌ Finance user NOT found by getUserById');
        }

        // Test 3: Check if any users are missing the role field
        console.log('\n3. Checking for users without role field in getAllUsers:');
        const usersWithoutRole = allUsers.filter(user => !('role' in user));
        if (usersWithoutRole.length > 0) {
            console.log(`❌ Found ${usersWithoutRole.length} users without role field:`);
            usersWithoutRole.forEach(user => {
                console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
                console.log(`    Fields: ${Object.keys(user)}`);
            });
        } else {
            console.log('✅ All users have role field in getAllUsers');
        }

        // Test 4: Show all users and their roles
        console.log('\n4. All users and their roles:');
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

testAdminEndpoint(); 