const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./src/models/User');
require('./src/models/Maintenance');
require('./src/models/Residence');

console.log('🔍 Checking Current Maintenance Request Statuses');
console.log('================================================');

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

const checkMaintenanceStatuses = async () => {
    try {
        const Maintenance = require('./src/models/Maintenance');
        
        // Get all maintenance requests
        const allMaintenance = await Maintenance.find({})
            .populate('residence', 'name')
            .populate('requestedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });
        
        console.log(`📋 Found ${allMaintenance.length} maintenance requests\n`);
        
        if (allMaintenance.length === 0) {
            console.log('No maintenance requests found in the database.');
            return;
        }
        
        // Display each request with its status
        allMaintenance.forEach((request, index) => {
            console.log(`${index + 1}. ${request.issue}`);
            console.log(`   ID: ${request._id}`);
            console.log(`   Status: ${request.status}`);
            console.log(`   Finance Status: ${request.financeStatus}`);
            console.log(`   Amount: $${request.amount || 0}`);
            console.log(`   Created: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}`);
            console.log(`   Requested By: ${request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : 'Unknown'}`);
            console.log(`   Residence: ${request.residence ? request.residence.name : 'Unknown'}`);
            console.log('');
        });
        
        // Summary statistics
        const statusCounts = {};
        const financeStatusCounts = {};
        
        allMaintenance.forEach(req => {
            statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
            financeStatusCounts[req.financeStatus] = (financeStatusCounts[req.financeStatus] || 0) + 1;
        });
        
        console.log('📊 Status Summary:');
        console.log('==================');
        console.log('Overall Status Distribution:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} requests`);
        });
        
        console.log('\nFinance Status Distribution:');
        Object.entries(financeStatusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} requests`);
        });
        
        // Check for specific status combinations
        console.log('\n🔍 Specific Status Combinations:');
        console.log('================================');
        
        const pendingCEORequests = allMaintenance.filter(req => req.status === 'pending-ceo-approval');
        const approvedFinanceRequests = allMaintenance.filter(req => req.financeStatus === 'approved');
        const pendingRequests = allMaintenance.filter(req => req.status === 'pending');
        const inProgressRequests = allMaintenance.filter(req => req.status === 'in-progress');
        
        console.log(`Requests with status 'pending-ceo-approval': ${pendingCEORequests.length}`);
        console.log(`Requests with financeStatus 'approved': ${approvedFinanceRequests.length}`);
        console.log(`Requests with status 'pending': ${pendingRequests.length}`);
        console.log(`Requests with status 'in-progress': ${inProgressRequests.length}`);
        
        // Show requests that should show approve button
        const shouldShowApproveButton = allMaintenance.filter(req => {
            const financeStatus = req.financeStatus?.toLowerCase();
            const status = req.status?.toLowerCase();
            return financeStatus !== 'approved' && 
                   status !== 'rejected' &&
                   status !== 'completed' &&
                   status !== 'approved' &&
                   status !== 'pending-ceo-approval';
        });
        
        console.log(`\nRequests that should show approve button: ${shouldShowApproveButton.length}`);
        if (shouldShowApproveButton.length > 0) {
            shouldShowApproveButton.forEach(req => {
                console.log(`   - ${req.issue} (Status: ${req.status}, Finance: ${req.financeStatus})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking maintenance statuses:', error);
    }
};

// Run the check
connectDB().then(() => {
    checkMaintenanceStatuses().then(() => {
        console.log('\n✅ Maintenance status check completed!');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Check failed:', error);
        process.exit(1);
    });
}); 