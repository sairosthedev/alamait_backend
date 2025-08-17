/**
 * Email Notifications Testing Script
 * 
 * This script tests all implemented email notifications to ensure they're working correctly.
 * 
 * Usage:
 * 1. Set up your environment variables (EMAIL_USER, EMAIL_APP_PASSWORD)
 * 2. Run: node scripts/test-email-notifications.js
 * 3. Check your email inbox for test notifications
 */

const mongoose = require('mongoose');
const EmailNotificationService = require('../src/services/emailNotificationService');
require('dotenv').config();

// Test data for notifications
const testData = {
    // Event notifications
    event: {
        title: 'Test Event - Welcome Party',
        date: new Date('2025-02-15'),
        startTime: '18:00',
        endTime: '22:00',
        location: 'Main Hall',
        description: 'Join us for a welcome party to meet your fellow students!'
    },
    
    // CEO approval notifications
    request: {
        title: 'Test Request - New Furniture',
        type: 'operational',
        submittedBy: {
            firstName: 'John',
            lastName: 'Doe',
            email: process.env.TEST_EMAIL || 'test@example.com'
        }
    },
    
    // Maintenance notifications
    maintenance: {
        issue: 'Broken Light Bulb',
        description: 'The light bulb in my room needs replacement',
        room: 'A101',
        priority: 'medium',
        category: 'Electrical',
        status: 'pending',
        student: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: process.env.TEST_EMAIL || 'test@example.com'
        },
        residence: {
            name: 'Test Residence'
        },
        createdAt: new Date()
    },
    
    // Room change notifications
    application: {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: process.env.TEST_EMAIL || 'test@example.com',
        requestType: 'upgrade',
        currentRoom: 'A101',
        preferredRoom: 'B205',
        reason: 'Need more space for studying',
        applicationDate: new Date(),
        applicationCode: 'APP25001'
    },
    
    // Booking notifications
    booking: {
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
    }
};

// Test user data
const testUser = {
    firstName: 'Admin',
    lastName: 'User',
    email: process.env.TEST_EMAIL || 'test@example.com'
};

const testRoom = {
    roomNumber: 'B205',
    type: 'Double',
    price: 3000
};

async function testEmailNotifications() {
    console.log('🧪 Starting Email Notifications Testing...\n');
    
    try {
        // Test 1: Event Notifications
        console.log('📅 Testing Event Notifications...');
        
        console.log('  → Testing New Event Notification...');
        await EmailNotificationService.sendNewEventNotification(testData.event, testUser);
        console.log('  ✅ New Event Notification sent successfully');
        
        console.log('  → Testing Event Update Notification...');
        const updatedEvent = { ...testData.event, title: 'Updated Test Event' };
        await EmailNotificationService.sendEventUpdateNotification(updatedEvent, testData.event, testUser);
        console.log('  ✅ Event Update Notification sent successfully');
        
        console.log('  → Testing Event Cancellation Notification...');
        await EmailNotificationService.sendEventCancellationNotification(testData.event, testUser);
        console.log('  ✅ Event Cancellation Notification sent successfully\n');
        
        // Test 2: CEO Approval Notifications
        console.log('👔 Testing CEO Approval Notifications...');
        
        console.log('  → Testing Request Sent to CEO Notification...');
        await EmailNotificationService.sendRequestSentToCEONotification(testData.request, testUser);
        console.log('  ✅ Request Sent to CEO Notification sent successfully');
        
        console.log('  → Testing CEO Approval Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, true, 'Request approved after review', testUser);
        console.log('  ✅ CEO Approval Notification sent successfully');
        
        console.log('  → Testing CEO Rejection Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, false, 'Request rejected due to budget constraints', testUser);
        console.log('  ✅ CEO Rejection Notification sent successfully\n');
        
        // Test 3: Maintenance Notifications
        console.log('🔧 Testing Maintenance Notifications...');
        
        console.log('  → Testing Maintenance Request Submitted...');
        await EmailNotificationService.sendMaintenanceRequestSubmitted(testData.maintenance);
        console.log('  ✅ Maintenance Request Submitted Notification sent successfully');
        
        console.log('  → Testing Maintenance Status Update...');
        const updatedMaintenance = { ...testData.maintenance, status: 'assigned', assignedTo: { name: 'Mike', surname: 'Technician' } };
        await EmailNotificationService.sendMaintenanceStatusUpdate(updatedMaintenance, 'pending', testUser);
        console.log('  ✅ Maintenance Status Update Notification sent successfully\n');
        
        // Test 4: Room Change Notifications
        console.log('🏠 Testing Room Change Notifications...');
        
        console.log('  → Testing Room Change Request...');
        await EmailNotificationService.sendRoomChangeRequestNotification(testData.application, testRoom, 'A101', testUser);
        console.log('  ✅ Room Change Request Notification sent successfully');
        
        console.log('  → Testing Room Change Approval...');
        await EmailNotificationService.sendRoomChangeApprovalNotification(testData.application, testUser);
        console.log('  ✅ Room Change Approval Notification sent successfully');
        
        console.log('  → Testing Room Change Rejection...');
        await EmailNotificationService.sendRoomChangeRejectionNotification(testData.application, testUser, 'Room not available at this time');
        console.log('  ✅ Room Change Rejection Notification sent successfully\n');
        
        // Test 5: Booking Notifications
        console.log('📋 Testing Booking Notifications...');
        
        console.log('  → Testing Booking Confirmation...');
        await EmailNotificationService.sendBookingConfirmationNotification(testData.booking, testUser);
        console.log('  ✅ Booking Confirmation Notification sent successfully');
        
        console.log('  → Testing Booking Cancellation...');
        await EmailNotificationService.sendBookingCancellationNotification(testData.booking, testUser, 'Booking cancelled due to maintenance');
        console.log('  ✅ Booking Cancellation Notification sent successfully\n');
        
        console.log('🎉 All Email Notifications Tested Successfully!');
        console.log('\n📧 Check your email inbox for all test notifications.');
        console.log('📋 Expected emails:');
        console.log('  - New Event: Test Event - Welcome Party');
        console.log('  - Event Update: Updated Test Event');
        console.log('  - Event Cancelled: Test Event - Welcome Party');
        console.log('  - Request Sent to CEO: Test Request - New Furniture');
        console.log('  - CEO Approved: Test Request - New Furniture');
        console.log('  - CEO Rejected: Test Request - New Furniture');
        console.log('  - Maintenance Submitted: Broken Light Bulb');
        console.log('  - Maintenance Status Update: Broken Light Bulb');
        console.log('  - Room Change Request: A101 → B205');
        console.log('  - Room Change Approved: A101 → B205');
        console.log('  - Room Change Rejected: A101 → B205');
        console.log('  - Booking Confirmed: A101');
        console.log('  - Booking Cancelled: A101');
        
    } catch (error) {
        console.error('❌ Error during email testing:', error);
        console.error('Error details:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔧 Email Configuration Issue:');
            console.error('Please check your EMAIL_USER and EMAIL_APP_PASSWORD environment variables.');
            console.error('Make sure you have enabled 2FA and generated an app-specific password for Gmail.');
        }
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEmailNotifications()
        .then(() => {
            console.log('\n✅ Testing completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testEmailNotifications }; 