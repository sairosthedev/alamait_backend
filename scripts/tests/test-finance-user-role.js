const mongoose = require('mongoose');
const User = require('./src/models/User');

async function testFinanceUserRole() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Test the specific finance user
        const financeUserId = "67f4ef0fcb87ffa3fb7e2d73";
        console.log(`\n=== TESTING FINANCE USER: ${financeUserId} ===`);
        
        // Find the user by ID
        const user = await User.findById(financeUserId);
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('✅ User found:');
        console.log('  ID:', user._id);
        console.log('  Email:', user.email);
        console.log('  Name:', user.firstName, user.lastName);
        console.log('  Role:', user.role);
        console.log('  Status:', user.status);
        console.log('  Created:', user.createdAt);

        // Test the same query that the finance endpoint uses
        console.log('\n=== TESTING FINANCE ENDPOINT QUERY ===');
        const users = await User.find({})
            .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Found ${users.length} total users`);
        
        // Find the finance user in the results
        const financeUserInResults = users.find(u => u._id.toString() === financeUserId);
        if (financeUserInResults) {
            console.log('\n✅ Finance user found in endpoint results:');
            console.log('  Role field present:', 'role' in financeUserInResults);
            console.log('  Role value:', financeUserInResults.role);
            console.log('  All fields:', Object.keys(financeUserInResults));
        } else {
            console.log('\n❌ Finance user NOT found in endpoint results');
        }

        // Test with specific role filter
        console.log('\n=== TESTING ROLE FILTER ===');
        const financeUsers = await User.find({ role: { $in: ['finance_admin', 'finance_user'] } })
            .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Found ${financeUsers.length} finance users:`);
        financeUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
        });

        // Check if the specific user is in finance users
        const isInFinanceUsers = financeUsers.find(u => u._id.toString() === financeUserId);
        if (isInFinanceUsers) {
            console.log('\n✅ Finance user found in role-filtered results');
        } else {
            console.log('\n❌ Finance user NOT found in role-filtered results');
            console.log('This suggests the user might not have a finance role');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

testFinanceUserRole(); 