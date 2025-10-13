require('dotenv').config();
const { sendEmail } = require('./src/utils/email');

async function testEmailFix() {
  console.log('🧪 Testing Email System Fix...\n');
  
  try {
    // Test basic email sending
    console.log('📧 Testing email sending...');
    
    await sendEmail({
      to: 'test@example.com', // Use a test email
      subject: 'Test Email - Alamait System',
      text: `
        This is a test email from the Alamait Student Accommodation system.
        
        If you receive this email, the email system is working correctly!
        
        Test Details:
        - Time: ${new Date().toISOString()}
        - System: Alamait Backend
        - Status: Email system is functional
        
        Best regards,
        Alamait System
      `
    });
    
    console.log('✅ Email test completed successfully!');
    console.log('📋 Check your email outbox or logs for delivery status.');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n🔧 SOLUTION: Email authentication failed');
      console.log('1. Check your .env file has EMAIL_USER and EMAIL_APP_PASSWORD');
      console.log('2. Verify Gmail app password is correct (16 characters)');
      console.log('3. Ensure 2-factor authentication is enabled on Gmail');
    } else if (error.message.includes('connection')) {
      console.log('\n🔧 SOLUTION: Email connection failed');
      console.log('1. Check your internet connection');
      console.log('2. Verify Gmail SMTP settings');
      console.log('3. Check firewall settings');
    } else {
      console.log('\n🔧 SOLUTION: General email error');
      console.log('1. Check server logs for detailed error');
      console.log('2. Verify email service configuration');
    }
  }
}

testEmailFix();
