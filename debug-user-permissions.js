const mongoose = require('mongoose');
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');

// Debug user permissions and authentication
async function debugUserPermissions() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== DEBUGGING USER PERMISSIONS ===');

        // Test 1: Check ALL users in the database
        console.log('\n1. Checking ALL users in database...');
        const allUsers = await User.find({}).select('_id email firstName lastName role status createdAt');
        console.log(`Found ${allUsers.length} total users:`);
        allUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role} - Status: ${user.status}`);
        });

        // Test 2: Check users by different roles
        console.log('\n2. Checking users by role...');
        const adminUsers = await User.find({ role: 'admin' });
        const financeUsers = await User.find({ role: { $in: ['finance', 'finance_admin', 'finance_user'] } });
        const otherUsers = await User.find({ role: { $nin: ['admin', 'finance', 'finance_admin', 'finance_user'] } });
        
        console.log(`Admin users: ${adminUsers.length}`);
        console.log(`Finance users: ${financeUsers.length}`);
        console.log(`Other users: ${otherUsers.length}`);

        // Test 3: Check if there are any users with similar roles
        console.log('\n3. Checking all unique roles...');
        const uniqueRoles = await User.distinct('role');
        console.log('Unique roles in database:', uniqueRoles);

        // Test 4: Test JWT token creation (if you have a user)
        if (allUsers.length > 0) {
            console.log('\n4. Testing JWT token creation...');
            const testUser = allUsers[0];
            console.log('Using test user:', testUser.email);
            
            try {
                const token = jwt.sign(
                    { user: { id: testUser._id, email: testUser.email, role: testUser.role } },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );
                console.log('✅ JWT token created successfully');
                console.log('Token payload:', jwt.decode(token));
            } catch (jwtError) {
                console.log('❌ JWT token creation failed:', jwtError.message);
            }
        }

        // Test 5: Check if there are any users that might be admin but with different role names
        console.log('\n5. Checking for potential admin users with different role names...');
        const potentialAdminUsers = await User.find({
            $or: [
                { role: { $regex: /admin/i } },
                { role: { $regex: /finance/i } },
                { email: { $regex: /admin/i } },
                { firstName: { $regex: /admin/i } }
            ]
        }).select('_id email firstName lastName role status');
        
        console.log(`Found ${potentialAdminUsers.length} potential admin/finance users:`);
        potentialAdminUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role} - Status: ${user.status}`);
        });

        console.log('\n=== DEBUG SUMMARY ===');
        console.log('Total users:', allUsers.length);
        console.log('Admin users:', adminUsers.length);
        console.log('Finance users:', financeUsers.length);
        console.log('Unique roles:', uniqueRoles);
        
        if (allUsers.length === 0) {
            console.log('⚠️  No users found - database is empty');
        } else if (adminUsers.length === 0) {
            console.log('⚠️  No users with role="admin" found');
            console.log('💡 Check if your admin user has a different role name');
        } else {
            console.log('✅ Admin users found - check your login credentials');
        }

    } catch (error) {
        console.error('Error debugging permissions:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the debug
debugUserPermissions(); 