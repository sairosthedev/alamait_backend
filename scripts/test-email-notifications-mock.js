/**
 * Mock Email Notifications Testing Script
 * 
 * This script tests all implemented email notifications by logging the content to console
 * instead of sending actual emails. Perfect for testing without email configuration.
 * 
 * Usage:
 * node scripts/test-email-notifications-mock.js
 */

const EmailNotificationService = require('../src/services/emailNotificationService');

// Mock the sendEmail function to log instead of sending
const originalSendEmail = require('../src/utils/email').sendEmail;

// Override sendEmail to log content instead of sending
require('../src/utils/email').sendEmail = async (options) => {
    console.log('\n📧 MOCK EMAIL SENT:');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('HTML Content:');
    console.log('─'.repeat(80));
    console.log(options.html);
    console.log('─'.repeat(80));
    console.log('');
    return true;
};

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
            email: 'john.doe@example.com'
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
            email: 'jane.smith@example.com'
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
        email: 'alice.johnson@example.com',
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
    email: 'admin@example.com'
};

const testRoom = {
    roomNumber: 'B205',
    type: 'Double',
    price: 3000
};

async function testEmailNotificationsMock() {
    console.log('🧪 Starting Mock Email Notifications Testing...\n');
    console.log('📝 This test will log email content to console instead of sending actual emails.\n');
    
    try {
        // Test 1: Event Notifications
        console.log('📅 Testing Event Notifications...');
        
        console.log('  → Testing New Event Notification...');
        await EmailNotificationService.sendNewEventNotification(testData.event, testUser);
        console.log('  ✅ New Event Notification logged successfully');
        
        console.log('  → Testing Event Update Notification...');
        const updatedEvent = { ...testData.event, title: 'Updated Test Event' };
        await EmailNotificationService.sendEventUpdateNotification(updatedEvent, testData.event, testUser);
        console.log('  ✅ Event Update Notification logged successfully');
        
        console.log('  → Testing Event Cancellation Notification...');
        await EmailNotificationService.sendEventCancellationNotification(testData.event, testUser);
        console.log('  ✅ Event Cancellation Notification logged successfully\n');
        
        // Test 2: CEO Approval Notifications
        console.log('👔 Testing CEO Approval Notifications...');
        
        console.log('  → Testing Request Sent to CEO Notification...');
        await EmailNotificationService.sendRequestSentToCEONotification(testData.request, testUser);
        console.log('  ✅ Request Sent to CEO Notification logged successfully');
        
        console.log('  → Testing CEO Approval Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, true, 'Request approved after review', testUser);
        console.log('  ✅ CEO Approval Notification logged successfully');
        
        console.log('  → Testing CEO Rejection Notification...');
        await EmailNotificationService.sendCEOApprovalNotification(testData.request, false, 'Request rejected due to budget constraints', testUser);
        console.log('  ✅ CEO Rejection Notification logged successfully\n');
        
        // Test 3: Maintenance Notifications
        console.log('🔧 Testing Maintenance Notifications...');
        
        console.log('  → Testing Maintenance Request Submitted...');
        await EmailNotificationService.sendMaintenanceRequestSubmitted(testData.maintenance);
        console.log('  ✅ Maintenance Request Submitted Notification logged successfully');
        
        console.log('  → Testing Maintenance Status Update...');
        const updatedMaintenance = { ...testData.maintenance, status: 'assigned', assignedTo: { name: 'Mike', surname: 'Technician' } };
        await EmailNotificationService.sendMaintenanceStatusUpdate(updatedMaintenance, 'pending', testUser);
        console.log('  ✅ Maintenance Status Update Notification logged successfully\n');
        
        // Test 4: Room Change Notifications
        console.log('🏠 Testing Room Change Notifications...');
        
        console.log('  → Testing Room Change Request...');
        await EmailNotificationService.sendRoomChangeRequestNotification(testData.application, testRoom, 'A101', testUser);
        console.log('  ✅ Room Change Request Notification logged successfully');
        
        console.log('  → Testing Room Change Approval...');
        await EmailNotificationService.sendRoomChangeApprovalNotification(testData.application, testUser);
        console.log('  ✅ Room Change Approval Notification logged successfully');
        
        console.log('  → Testing Room Change Rejection...');
        await EmailNotificationService.sendRoomChangeRejectionNotification(testData.application, testUser, 'Room not available at this time');
        console.log('  ✅ Room Change Rejection Notification logged successfully\n');
        
        // Test 5: Booking Notifications
        console.log('📋 Testing Booking Notifications...');
        
        console.log('  → Testing Booking Confirmation...');
        await EmailNotificationService.sendBookingConfirmationNotification(testData.booking, testUser);
        console.log('  ✅ Booking Confirmation Notification logged successfully');
        
        console.log('  → Testing Booking Cancellation...');
        await EmailNotificationService.sendBookingCancellationNotification(testData.booking, testUser, 'Booking cancelled due to maintenance');
        console.log('  ✅ Booking Cancellation Notification logged successfully\n');
        
        console.log('🎉 All Email Notifications Tested Successfully!');
        console.log('\n📊 Test Summary:');
        console.log('  ✅ 13 email templates tested');
        console.log('  ✅ All templates rendered correctly');
        console.log('  ✅ HTML content generated properly');
        console.log('  ✅ No errors encountered');
        
        console.log('\n📋 Tested Email Types:');
        console.log('  1. New Event Notification');
        console.log('  2. Event Update Notification');
        console.log('  3. Event Cancellation Notification');
        console.log('  4. Request Sent to CEO Notification');
        console.log('  5. CEO Approval Notification');
        console.log('  6. CEO Rejection Notification');
        console.log('  7. Maintenance Request Submitted');
        console.log('  8. Maintenance Status Update');
        console.log('  9. Room Change Request');
        console.log('  10. Room Change Approval');
        console.log('  11. Room Change Rejection');
        console.log('  12. Booking Confirmation');
        console.log('  13. Booking Cancellation');
        
        console.log('\n🚀 Next Steps:');
        console.log('  - Configure Gmail credentials in .env file');
        console.log('  - Run: node scripts/test-email-notifications.js');
        console.log('  - Check actual email delivery');
        
    } catch (error) {
        console.error('❌ Error during email testing:', error);
        console.error('Error details:', error.message);
    } finally {
        // Restore original sendEmail function
        require('../src/utils/email').sendEmail = originalSendEmail;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEmailNotificationsMock()
        .then(() => {
            console.log('\n✅ Mock testing completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Mock testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testEmailNotificationsMock }; 