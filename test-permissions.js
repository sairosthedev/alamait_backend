const mongoose = require('mongoose');
const User = require('./src/models/User');
const Maintenance = require('./src/models/Maintenance');

// Test admin permissions for finance and maintenance endpoints
async function testPermissions() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== TESTING ADMIN PERMISSIONS ===');

        // Test 1: Check if admin users exist
        console.log('\n1. Checking admin users...');
        const adminUsers = await User.find({ role: 'admin' }).select('_id email firstName lastName role');
        console.log(`Found ${adminUsers.length} admin users:`);
        adminUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
        });

        // Test 2: Check if finance users exist
        console.log('\n2. Checking finance users...');
        const financeUsers = await User.find({ role: { $in: ['finance_admin', 'finance_user'] } }).select('_id email firstName lastName role');
        console.log(`Found ${financeUsers.length} finance users:`);
        financeUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
        });

        // Test 3: Check maintenance requests with financeStatus=approved
        console.log('\n3. Checking maintenance requests with financeStatus=approved...');
        const approvedMaintenance = await Maintenance.find({ financeStatus: 'approved' }).select('_id issue description financeStatus amount');
        console.log(`Found ${approvedMaintenance.length} maintenance requests with financeStatus=approved:`);
        approvedMaintenance.forEach(maintenance => {
            console.log(`  - ${maintenance.issue}: ${maintenance.description} (Amount: $${maintenance.amount || 0})`);
        });

        // Test 4: Check all maintenance requests
        console.log('\n4. Checking all maintenance requests...');
        const allMaintenance = await Maintenance.find({}).select('_id issue description financeStatus amount');
        console.log(`Found ${allMaintenance.length} total maintenance requests:`);
        
        const statusCounts = {};
        allMaintenance.forEach(maintenance => {
            const status = maintenance.financeStatus || 'pending';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count} requests`);
        });

        console.log('\n=== SUMMARY ===');
        console.log('✅ Admin users exist:', adminUsers.length > 0);
        console.log('✅ Finance users exist:', financeUsers.length > 0);
        console.log('✅ Maintenance requests exist:', allMaintenance.length > 0);
        console.log('✅ Approved maintenance requests exist:', approvedMaintenance.length > 0);
        
        if (adminUsers.length === 0) {
            console.log('⚠️  No admin users found - this might be why you get 403 errors');
        }
        
        if (approvedMaintenance.length === 0) {
            console.log('⚠️  No approved maintenance requests found - this might be why the query returns empty');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testPermissions(); 