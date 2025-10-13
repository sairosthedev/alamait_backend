require('dotenv').config();
const EmailNotificationService = require('./src/services/emailNotificationService');

async function testRequestEmails() {
  console.log('🧪 Testing Request Email System...\n');
  
  try {
    // Test maintenance request email
    console.log('📧 Testing maintenance request email...');
    
    const mockMaintenance = {
      issue: 'Test Maintenance Issue',
      description: 'This is a test maintenance request',
      category: 'Plumbing',
      priority: 'Medium',
      residence: { name: 'Test Residence' }
    };
    
    const mockSubmittedBy = {
      firstName: 'Test',
      lastName: 'Student',
      email: 'test@example.com'
    };
    
    // This should send emails in background (non-blocking)
    await EmailNotificationService.sendMaintenanceRequestSubmitted(mockMaintenance, mockSubmittedBy);
    console.log('✅ Maintenance request email test completed (sent in background)');
    
    // Test CEO approval email
    console.log('\n📧 Testing CEO approval email...');
    
    const mockRequest = {
      type: 'maintenance',
      title: 'Test Request',
      submittedBy: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      }
    };
    
    const mockApprovedBy = {
      firstName: 'CEO',
      lastName: 'User'
    };
    
    // This should send email in background (non-blocking)
    await EmailNotificationService.sendCEOApprovalNotification(mockRequest, true, 'Test approval reason', mockApprovedBy);
    console.log('✅ CEO approval email test completed (sent in background)');
    
    console.log('\n🎉 All request email tests completed!');
    console.log('📧 Emails are being sent in the background to avoid blocking requests');
    console.log('📬 Check your email inbox (or spam folder) for test emails');
    
  } catch (error) {
    console.error('❌ Request email test failed:', error.message);
  }
}

testRequestEmails();
