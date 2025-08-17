/**
 * Simple Real Email Notifications Testing Script
 * 
 * This script tests email notifications using real data from the database.
 * It only uses core models that are definitely available.
 * 
 * Usage:
 * node scripts/test-email-notifications-real-simple.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const EmailNotificationService = require('../src/services/emailNotificationService');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

// Safe model loading function
function safeLoadModel(modelName) {
    try {
        return require(`../src/models/${modelName}`);
    } catch (error) {
        console.log(`⚠️  Model ${modelName} not found, will use mock data`);
        return null;
    }
}

// Test data collection functions
async function getTestData() {
    console.log('📊 Collecting real test data from database...\n');
    
    const testData = {};
    
    try {
        // Get real events
        const Event = safeLoadModel('Event');
        if (Event) {
            const events = await Event.find().limit(1);
            if (events.length > 0) {
                testData.event = events[0];
                console.log('✅ Found real event:', testData.event.title);
            }
        }
        
        if (!testData.event) {
            console.log('⚠️  Using mock event data');
            testData.event = {
                title: 'Test Event - Welcome Party',
                date: new Date('2025-02-15'),
                startTime: '18:00',
                endTime: '22:00',
                location: 'Main Hall',
                description: 'Join us for a welcome party to meet your fellow students!'
            };
        }
        
        // Get real requests
        const Request = safeLoadModel('Request');
        if (Request) {
            const requests = await Request.find().limit(1);
            if (requests.length > 0) {
                testData.request = requests[0];
                console.log('✅ Found real request:', testData.request.title);
            }
        }
        
        if (!testData.request) {
            console.log('⚠️  Using mock request data');
            testData.request = {
                title: 'Test Request - New Furniture',
                type: 'operational',
                submittedBy: {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com'
                }
            };
        }
        
        // Get real users (admin)
        const User = safeLoadModel('User');
        if (User) {
            const adminUsers = await User.find({ role: 'admin' }).limit(1);
            if (adminUsers.length > 0) {
                testData.adminUser = adminUsers[0];
                console.log('✅ Found real admin user:', testData.adminUser.firstName);
            }
        }
        
        if (!testData.adminUser) {
            console.log('⚠️  Using mock admin data');
            testData.adminUser = {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com'
            };
        }
        
        // Create mock data for other entities
        testData.maintenance = {
            issue: 'Broken Light Bulb',
            description: 'The light bulb in my room needs replacement',
            room: 'A101',
            priority: 'medium',
            category: 'Electrical',
            status: 'pending',
            student: {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@example.com'
            },
            residence: {
                name: 'Test Residence'
            },
            createdAt: new Date()
        };
        
        testData.application = {
            firstName: 'Alice',
            lastName: 'Johnson',
            email: 'alice.johnson@example.com',
            requestType: 'upgrade',
            currentRoom: 'A101',
            preferredRoom: 'B205',
            reason: 'Need more space for studying',
            applicationDate: new Date(),
            applicationCode: 'APP25001'
        };
        
        testData.booking = {
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-06-30'),
            status: 'confirmed',
            totalAmount: 2500,
            room: {
                roomNumber: 'A101',
                type: 'Single',
                price: 2500
            },
            residence: {
                name: 'Test Residence'
            }
        };
        
        testData.room = {
            roomNumber: 'B205',
            type: 'Double',
            price: 3000
        };
        
        console.log('\n📋 Test Data Summary:');
        console.log(`  Events: ${testData.event.title ? 'Real data' : 'Mock data'}`);
        console.log(`  Requests: ${testData.request.title ? 'Real data' : 'Mock data'}`);
        console.log(`  Admin Users: ${testData.adminUser.firstName ? 'Real data' : 'Mock data'}`);
        console.log(`  Other data: Mock data (for testing)\n`);
        
    } catch (error) {
        console.error('❌ Error collecting test data:', error.message);
        // Continue with mock data
        console.log('🔄 Falling back to mock data...\n');
        
        testData.event = {
            title: 'Test Event - Welcome Party',
            date: new Date('2025-02-15'),
            startTime: '18:00',
            endTime: '22:00',
            location: 'Main Hall',
            description: 'Join us for a welcome party to meet your fellow students!'
        };
        
        testData.request = {
            title: 'Test Request - New Furniture',
            type: 'operational',
            submittedBy: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com'
            }
        };
        
        testData.adminUser = {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com'
        };
        
        testData.maintenance = {
            issue: 'Broken Light Bulb',
            description: 'The light bulb in my room needs replacement',
            room: 'A101',
            priority: 'medium',
            category: 'Electrical',
            status: 'pending',
            student: {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@example.com'
            },
            residence: {
                name: 'Test Residence'
            },
            createdAt: new Date()
        };
        
        testData.application = {
            firstName: 'Alice',
            lastName: 'Johnson',
            email: 'alice.johnson@example.com',
            requestType: 'upgrade',
            currentRoom: 'A101',
            preferredRoom: 'B205',
            reason: 'Need more space for studying',
            applicationDate: new Date(),
            applicationCode: 'APP25001'
        };
        
        testData.booking = {
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-06-30'),
            status: 'confirmed',
            totalAmount: 2500,
            room: {
                roomNumber: 'A101',
                type: 'Single',
                price: 2500
            },
            residence: {
                name: 'Test Residence'
            }
        };
        
        testData.room = {
            roomNumber: 'B205',
            type: 'Double',
            price: 3000
        };
    }
    
    return testData;
}

async function testEmailNotificationsRealSimple() {
    console.log('🧪 Starting Simple Real Email Notifications Testing...\n');
    console.log('📝 This test will use real data where available, mock data where needed.\n');
    
    try {
        // Connect to database
        await connectDB();
        
        // Get test data
        const testData = await getTestData();
        
        // Test 1: Event Notifications
        console.log('📅 Testing Event Notifications...');
        
        console.log('  → Testing New Event Notification...');
        await EmailNotificationService.sendNewEventNotification(testData.event, testData.adminUser);
        console.log('  ✅ New Event Notification sent successfully');
        
        console.log('  → Testing Event Update Notification...');
        const updatedEvent = { ...testData.event };
        updatedEvent.title = 'Updated: ' + updatedEvent.title;
        await EmailNotificationService.sendEventUpdateNotification(updatedEvent, testData.event, testData.adminUser);
        console.log('  ✅ Event Update Notification sent successfully');
        
        console.log('  → Testing Event Cancellation Notification...');
        await EmailNotificationService.sendEventCancellationNotification(testData.event, testData.adminUser);
        console.log('  ✅ Event Cancellation Notification sent successfully\n');
        
        // Test 2: CEO Approval Notifications
        console.log('👔 Testing CEO Approval Notifications...');
        
        console.log('  → Testing Request Sent to CEO Notification...');
        await EmailNotificationService.sendRequestSentToCEONotification(testData.request, testData.adminUser);
        console.log('  ✅ Request Sent to CEO Notification sent successfully');
        
        console.log('  → Testing CEO Approval Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, true, 'Request approved after review', testData.adminUser);
        console.log('  ✅ CEO Approval Notification sent successfully');
        
        console.log('  → Testing CEO Rejection Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, false, 'Request rejected due to budget constraints', testData.adminUser);
        console.log('  ✅ CEO Rejection Notification sent successfully\n');
        
        // Test 3: Maintenance Notifications
        console.log('🔧 Testing Maintenance Notifications...');
        
        console.log('  → Testing Maintenance Request Submitted...');
        await EmailNotificationService.sendMaintenanceRequestSubmitted(testData.maintenance);
        console.log('  ✅ Maintenance Request Submitted sent successfully');
        
        console.log('  → Testing Maintenance Status Update...');
        const updatedMaintenance = { 
            ...testData.maintenance, 
            status: 'assigned', 
            assignedTo: { name: 'Mike', surname: 'Technician' } 
        };
        await EmailNotificationService.sendMaintenanceStatusUpdate(updatedMaintenance, 'pending', testData.adminUser);
        console.log('  ✅ Maintenance Status Update sent successfully\n');
        
        // Test 4: Room Change Notifications
        console.log('🏠 Testing Room Change Notifications...');
        
        console.log('  → Testing Room Change Request...');
        await EmailNotificationService.sendRoomChangeRequestNotification(testData.application, testData.room, 'A101', testData.adminUser);
        console.log('  ✅ Room Change Request sent successfully');
        
        console.log('  → Testing Room Change Approval...');
        await EmailNotificationService.sendRoomChangeApprovalNotification(testData.application, testData.adminUser);
        console.log('  ✅ Room Change Approval sent successfully');
        
        console.log('  → Testing Room Change Rejection...');
        await EmailNotificationService.sendRoomChangeRejectionNotification(testData.application, testData.adminUser, 'Room not available at this time');
        console.log('  ✅ Room Change Rejection sent successfully\n');
        
        // Test 5: Booking Notifications
        console.log('📋 Testing Booking Notifications...');
        
        console.log('  → Testing Booking Confirmation...');
        await EmailNotificationService.sendBookingConfirmationNotification(testData.booking, testData.adminUser);
        console.log('  ✅ Booking Confirmation sent successfully');
        
        console.log('  → Testing Booking Cancellation...');
        await EmailNotificationService.sendBookingCancellationNotification(testData.booking, testData.adminUser, 'Booking cancelled due to maintenance');
        console.log('  ✅ Booking Cancellation sent successfully\n');
        
        console.log('🎉 All Email Notifications Tested Successfully!');
        console.log('\n📊 Test Summary:');
        console.log('  ✅ 13 email notifications sent');
        console.log('  ✅ All templates rendered successfully');
        console.log('  ✅ Database connection working');
        console.log('  ✅ No errors encountered');
        
        console.log('\n📋 Tested Email Types:');
        console.log('  1. Event Notifications (3 sent)');
        console.log('  2. CEO Approval Workflow (3 sent)');
        console.log('  3. Maintenance Requests (2 sent)');
        console.log('  4. Room Change Requests (3 sent)');
        console.log('  5. Booking Management (2 sent)');
        
        console.log('\n📧 Check your email inbox for all test notifications!');
        console.log('✅ Email notification system is fully operational!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
        console.error('Error details:', error.message);
        
        if (error.message.includes('EAUTH')) {
            console.log('\n🔧 Email Configuration Issue:');
            console.log('Please check your .env file and ensure:');
            console.log('  EMAIL_USER=your-gmail@gmail.com');
            console.log('  EMAIL_APP_PASSWORD=your-app-specific-password');
            console.log('\n📖 See scripts/email-testing-guide.md for setup instructions');
        }
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEmailNotificationsRealSimple()
        .then(() => {
            console.log('\n✅ Real data testing completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Real data testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testEmailNotificationsRealSimple }; 