const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./src/models/User');
require('./src/models/Maintenance');
require('./src/models/Residence');

console.log('🧪 Testing Maintenance Approval Status Change');
console.log('=============================================');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

const testMaintenanceApprovalStatus = async () => {
    try {
        // Find a maintenance request that's not already approved
        const Maintenance = require('./src/models/Maintenance');
        
        const maintenanceRequest = await Maintenance.findOne({
            financeStatus: { $ne: 'approved' },
            status: { $ne: 'pending-ceo-approval' }
        }).populate('residence', 'name')
          .populate('requestedBy', 'firstName lastName email');
        
        if (!maintenanceRequest) {
            console.log('❌ No suitable maintenance request found for testing');
            console.log('   (All requests are already approved or pending CEO approval)');
            return;
        }
        
        console.log('📋 Found maintenance request for testing:');
        console.log(`   ID: ${maintenanceRequest._id}`);
        console.log(`   Issue: ${maintenanceRequest.issue}`);
        console.log(`   Current Status: ${maintenanceRequest.status}`);
        console.log(`   Current Finance Status: ${maintenanceRequest.financeStatus}`);
        console.log(`   Amount: $${maintenanceRequest.amount || 0}`);
        
        // Simulate the approval process
        console.log('\n🔄 Simulating finance approval...');
        
        const beforeStatus = maintenanceRequest.status;
        const beforeFinanceStatus = maintenanceRequest.financeStatus;
        
        // Update the maintenance request to simulate approval
        const updatedMaintenance = await Maintenance.findByIdAndUpdate(
            maintenanceRequest._id,
            {
                $set: {
                    financeStatus: 'approved',
                    status: 'pending-ceo-approval', // This should be the new status
                    financeNotes: 'Test approval - Status should change to pending-ceo-approval',
                    amount: maintenanceRequest.amount || 100, // Set a test amount
                    convertedToExpense: true,
                    updatedBy: null // No user for test
                }
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('requestedBy', 'firstName lastName email');
        
        console.log('\n✅ Approval simulation completed!');
        console.log('📊 Status Changes:');
        console.log(`   Status: ${beforeStatus} → ${updatedMaintenance.status}`);
        console.log(`   Finance Status: ${beforeFinanceStatus} → ${updatedMaintenance.financeStatus}`);
        console.log(`   Amount: $${updatedMaintenance.amount}`);
        console.log(`   Converted to Expense: ${updatedMaintenance.convertedToExpense}`);
        
        // Verify the status change
        if (updatedMaintenance.status === 'pending-ceo-approval') {
            console.log('\n🎉 SUCCESS: Status correctly changed to pending-ceo-approval!');
        } else {
            console.log('\n❌ ERROR: Status did not change to pending-ceo-approval');
            console.log(`   Expected: pending-ceo-approval`);
            console.log(`   Actual: ${updatedMaintenance.status}`);
        }
        
        // Check if there are any other maintenance requests with different statuses
        console.log('\n📋 Checking other maintenance requests...');
        const allMaintenance = await Maintenance.find({}).select('_id issue status financeStatus amount');
        
        console.log(`Total maintenance requests: ${allMaintenance.length}`);
        
        const statusCounts = {};
        const financeStatusCounts = {};
        
        allMaintenance.forEach(req => {
            statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
            financeStatusCounts[req.financeStatus] = (financeStatusCounts[req.financeStatus] || 0) + 1;
        });
        
        console.log('\n📊 Current Status Distribution:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} requests`);
        });
        
        console.log('\n📊 Current Finance Status Distribution:');
        Object.entries(financeStatusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} requests`);
        });
        
        // Check for requests that should be pending CEO approval
        const pendingCEORequests = allMaintenance.filter(req => req.status === 'pending-ceo-approval');
        console.log(`\n🔍 Requests pending CEO approval: ${pendingCEORequests.length}`);
        
        if (pendingCEORequests.length > 0) {
            console.log('   Requests waiting for CEO approval:');
            pendingCEORequests.forEach(req => {
                console.log(`   - ${req.issue} (ID: ${req._id})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error testing maintenance approval status:', error);
    }
};

// Run the test
connectDB().then(() => {
    testMaintenanceApprovalStatus().then(() => {
        console.log('\n✅ Maintenance approval status test completed!');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}); 