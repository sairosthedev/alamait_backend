const mongoose = require('mongoose');
const EmailNotificationService = require('./src/services/emailNotificationService');
require('dotenv').config();

// Import all required models to ensure they are registered
require('./src/models/User');
require('./src/models/Maintenance');
require('./src/models/Residence');

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

// Test maintenance email notifications
const testMaintenanceEmails = async () => {
    try {
        console.log('\n🧪 Testing Maintenance Email Notifications');
        console.log('==========================================');

        // Get test data from database
        const Maintenance = require('./src/models/Maintenance');
        const User = require('./src/models/User');

        // Get a sample maintenance request
        const maintenanceRequest = await Maintenance.findOne({})
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('assignedTo', 'firstName lastName email');

        if (!maintenanceRequest) {
            console.log('❌ No maintenance requests found in database');
            return;
        }

        console.log('📋 Test Maintenance Request:');
        console.log(`   - Issue: ${maintenanceRequest.issue}`);
        console.log(`   - Student: ${maintenanceRequest.student?.firstName} ${maintenanceRequest.student?.lastName}`);
        console.log(`   - Status: ${maintenanceRequest.status}`);
        console.log(`   - Assigned To: ${maintenanceRequest.assignedTo?.firstName} ${maintenanceRequest.assignedTo?.lastName}`);

        // Get test users
        const adminUser = await User.findOne({ role: 'admin' });
        const financeUser = await User.findOne({ role: 'finance_admin' });

        if (!adminUser || !financeUser) {
            console.log('❌ Test users not found (admin and finance)');
            return;
        }

        console.log('\n📧 Testing Email Notifications...');

        // Test 1: Maintenance Request Submitted
        console.log('\n🔵 Test 1: Maintenance Request Submitted');
        try {
            await EmailNotificationService.sendMaintenanceRequestSubmitted(maintenanceRequest, adminUser);
            console.log('✅ Maintenance request submitted notification sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance request submitted notification:', error.message);
        }

        // Test 2: Maintenance Request Confirmation
        console.log('\n🔵 Test 2: Maintenance Request Confirmation');
        try {
            await EmailNotificationService.sendMaintenanceRequestConfirmation(maintenanceRequest, adminUser);
            console.log('✅ Maintenance request confirmation sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance request confirmation:', error.message);
        }

        // Test 3: Maintenance Request Assigned
        console.log('\n🔵 Test 3: Maintenance Request Assigned');
        try {
            await EmailNotificationService.sendMaintenanceRequestAssigned(
                maintenanceRequest, 
                adminUser, 
                maintenanceRequest.assignedTo || adminUser
            );
            console.log('✅ Maintenance request assignment notifications sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance request assignment notifications:', error.message);
        }

        // Test 4: Maintenance Status Update
        console.log('\n🔵 Test 4: Maintenance Status Update');
        try {
            await EmailNotificationService.sendMaintenanceStatusUpdate(
                maintenanceRequest,
                'pending',
                adminUser
            );
            console.log('✅ Maintenance status update notification sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance status update notification:', error.message);
        }

        // Test 5: Maintenance Request Approved
        console.log('\n🔵 Test 5: Maintenance Request Approved');
        try {
            await EmailNotificationService.sendMaintenanceRequestApproved(maintenanceRequest, financeUser);
            console.log('✅ Maintenance request approval notification sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance request approval notification:', error.message);
        }

        // Test 6: Maintenance Request Rejected
        console.log('\n🔵 Test 6: Maintenance Request Rejected');
        try {
            await EmailNotificationService.sendMaintenanceRequestRejected(
                maintenanceRequest, 
                financeUser, 
                'Test rejection reason'
            );
            console.log('✅ Maintenance request rejection notification sent');
        } catch (error) {
            console.log('❌ Failed to send maintenance request rejection notification:', error.message);
        }

        console.log('\n🎉 Maintenance Email Tests Completed!');
        console.log('=====================================');
        console.log('✅ All email notifications have been tested');
        console.log('📧 Check your email inbox for test messages');
        console.log('📋 Check console logs for any errors');

    } catch (error) {
        console.error('❌ Error testing maintenance emails:', error.message);
    }
};

// Main function
const runMaintenanceEmailTest = async () => {
    console.log('🚀 Testing Maintenance Email Functionality');
    console.log('==========================================');
    
    try {
        // Connect to database
        await connectDB();
        
        // Test maintenance emails
        await testMaintenanceEmails();
        
        console.log('\n✅ Maintenance email test completed!');
        
    } catch (error) {
        console.error('❌ Maintenance email test failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
};

// Run the test
if (require.main === module) {
    runMaintenanceEmailTest()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runMaintenanceEmailTest
}; 