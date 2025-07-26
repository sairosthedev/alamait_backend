require('dotenv').config();
require('./src/config/database')();

const User = require('./src/models/User');

async function testRoleField() {
    try {
        console.log('Testing Role Field in Finance Users Endpoint...\n');

        // Test 1: Get all users with explicit field selection
        console.log('1. Testing get all users with explicit field selection...');
        const users = await User.find({})
            .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
            .sort({ createdAt: -1 })
            .lean();
        
        console.log(`   - Total users: ${users.length}`);
        console.log('\n   User details with roles:');
        users.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.firstName} ${user.lastName}`);
            console.log(`      Email: ${user.email}`);
            console.log(`      Role: ${user.role || 'NOT INCLUDED'}`);
            console.log(`      Status: ${user.status || 'NOT INCLUDED'}`);
            console.log(`      Created: ${user.createdAt}`);
            console.log('');
        });

        // Test 2: Check if role field exists in all users
        console.log('2. Checking role field presence...');
        const usersWithoutRole = users.filter(user => !user.role);
        const usersWithRole = users.filter(user => user.role);
        
        console.log(`   - Users with role field: ${usersWithRole.length}`);
        console.log(`   - Users without role field: ${usersWithoutRole.length}`);
        
        if (usersWithoutRole.length > 0) {
            console.log('   - Users missing role field:');
            usersWithoutRole.forEach(user => {
                console.log(`     * ${user.firstName} ${user.lastName} (${user.email})`);
            });
        }

        // Test 3: Test specific user by ID
        if (users.length > 0) {
            console.log('\n3. Testing specific user by ID...');
            const firstUser = users[0];
            const specificUser = await User.findById(firstUser._id)
                .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
                .lean();
            
            console.log(`   - User: ${specificUser.firstName} ${specificUser.lastName}`);
            console.log(`   - Role: ${specificUser.role || 'NOT INCLUDED'}`);
            console.log(`   - Email: ${specificUser.email}`);
        }

        console.log('\n✅ Role Field Test Completed Successfully!');
        console.log('\n📋 Expected Response Format:');
        console.log('   {');
        console.log('     "users": [');
        console.log('       {');
        console.log('         "_id": "user_id",');
        console.log('         "firstName": "John",');
        console.log('         "lastName": "Doe",');
        console.log('         "email": "john@example.com",');
        console.log('         "role": "admin",');
        console.log('         "status": "active",');
        console.log('         "createdAt": "2024-01-01T00:00:00.000Z",');
        console.log('         "isVerified": true');
        console.log('       }');
        console.log('     ],');
        console.log('     "currentPage": 1,');
        console.log('     "totalPages": 1,');
        console.log('     "total": 7,');
        console.log('     "limit": 10');
        console.log('   }');

    } catch (error) {
        console.error('❌ Error testing role field:', error);
    } finally {
        process.exit();
    }
}

testRoleField(); 