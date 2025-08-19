const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./src/models/User');
require('./src/models/Maintenance');
require('./src/models/Residence');

console.log('🔍 Debugging Frontend Filtering Logic');
console.log('====================================');

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

const debugFrontendFiltering = async () => {
    try {
        const Maintenance = require('./src/models/Maintenance');
        
        // Get all maintenance requests
        const allMaintenance = await Maintenance.find({})
            .populate('residence', 'name')
            .populate('requestedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });
        
        console.log(`📋 Found ${allMaintenance.length} maintenance requests\n`);
        
        // Test the frontend filtering logic
        console.log('🧪 Testing Frontend Filtering Logic:');
        console.log('====================================');
        
        // Student tab filtering
        console.log('\n📚 STUDENT MAINTENANCE TAB:');
        console.log('============================');
        const studentTabRequests = allMaintenance.filter(request => {
            const typeMatch = request.type === 'maintenance' || 
                             request.type === 'student_maintenance' ||
                             (request.type === 'operation' && request.requestType === 'maintenance') ||
                             (!request.type && !request.requestType) || // Default maintenance requests
                             (request.type === undefined && request.requestType === undefined);
            
            console.log(`Request: ${request.issue || 'undefined'}`);
            console.log(`  type: ${request.type}, requestType: ${request.requestType}`);
            console.log(`  typeMatch: ${typeMatch}`);
            console.log('');
            
            return typeMatch;
        });
        
        console.log(`✅ Student tab should show: ${studentTabRequests.length} requests`);
        
        // Operational tab filtering
        console.log('\n🏢 OPERATIONAL/FINANCIAL TAB:');
        console.log('==============================');
        const operationalTabRequests = allMaintenance.filter(request => {
            const typeMatch = (request.type === 'operational' || request.type === 'operation') && 
                             request.requestType !== 'maintenance' ||
                             request.type === 'financial' || 
                             (request.requestType === 'operation' && request.type !== 'maintenance');
            
            console.log(`Request: ${request.issue || 'undefined'}`);
            console.log(`  type: ${request.type}, requestType: ${request.requestType}`);
            console.log(`  typeMatch: ${typeMatch}`);
            console.log('');
            
            return typeMatch;
        });
        
        console.log(`✅ Operational tab should show: ${operationalTabRequests.length} requests`);
        
        // Check which requests should show approve button in student tab
        console.log('\n🔘 APPROVE BUTTON LOGIC (Student Tab):');
        console.log('======================================');
        
        const shouldShowApproveInStudentTab = studentTabRequests.filter(request => {
            const financeStatus = request.financeStatus?.toLowerCase();
            const status = request.status?.toLowerCase();
            
            const shouldShowApprove = financeStatus !== 'approved' && 
                                     status !== 'rejected' &&
                                     status !== 'completed' &&
                                     status !== 'approved' &&
                                     status !== 'pending-ceo-approval';
            
            console.log(`Request: ${request.issue || 'undefined'}`);
            console.log(`  Status: ${status}, Finance Status: ${financeStatus}`);
            console.log(`  Should show approve button: ${shouldShowApprove}`);
            console.log('');
            
            return shouldShowApprove;
        });
        
        console.log(`✅ Requests that should show approve button in student tab: ${shouldShowApproveInStudentTab.length}`);
        
        if (shouldShowApproveInStudentTab.length > 0) {
            console.log('Requests that should show approve button:');
            shouldShowApproveInStudentTab.forEach(req => {
                console.log(`  - ${req.issue || 'undefined'} (Status: ${req.status}, Finance: ${req.financeStatus})`);
            });
        } else {
            console.log('No requests should show approve button (all are already approved or in final states)');
        }
        
        // Check for requests that might need to be reset for testing
        console.log('\n🔄 REQUESTS THAT COULD BE RESET FOR TESTING:');
        console.log('============================================');
        
        const resettableRequests = allMaintenance.filter(request => {
            // Find requests that are approved but could be reset to pending for testing
            return request.financeStatus === 'approved' && 
                   (request.status === 'pending' || request.status === 'in-progress');
        });
        
        console.log(`Requests that could be reset for testing: ${resettableRequests.length}`);
        if (resettableRequests.length > 0) {
            resettableRequests.forEach(req => {
                console.log(`  - ${req.issue || 'undefined'} (ID: ${req._id})`);
                console.log(`    Current: Status=${req.status}, Finance=${req.financeStatus}`);
                console.log(`    Could reset to: Status=pending, Finance=pending`);
            });
        }
        
        // Summary
        console.log('\n📊 SUMMARY:');
        console.log('============');
        console.log(`Total requests: ${allMaintenance.length}`);
        console.log(`Student tab requests: ${studentTabRequests.length}`);
        console.log(`Operational tab requests: ${operationalTabRequests.length}`);
        console.log(`Requests that should show approve button: ${shouldShowApproveInStudentTab.length}`);
        console.log(`Requests that could be reset for testing: ${resettableRequests.length}`);
        
        if (shouldShowApproveInStudentTab.length === 0) {
            console.log('\n💡 RECOMMENDATION:');
            console.log('All requests are already approved. To test the new approval workflow:');
            console.log('1. Reset a request to pending status');
            console.log('2. Try approving it through the frontend');
            console.log('3. Verify it changes to pending-ceo-approval');
        }
        
    } catch (error) {
        console.error('❌ Error debugging frontend filtering:', error);
    }
};

// Run the debug
connectDB().then(() => {
    debugFrontendFiltering().then(() => {
        console.log('\n✅ Frontend filtering debug completed!');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    });
}); 