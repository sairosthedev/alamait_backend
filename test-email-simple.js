require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailSimple() {
  console.log('🧪 Testing Email System (Simple Test)...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Not set'}`);
  console.log(`EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not set'}`);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log('\n❌ Email configuration is missing!');
    console.log('Please set EMAIL_USER and EMAIL_APP_PASSWORD in your .env file');
    return;
  }
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
    
    console.log('\n📧 Testing email connection...');
    
    // Test connection
    await transporter.verify();
    console.log('✅ Email connection successful!');
    
    // Send test email
    console.log('\n📧 Sending test email...');
    const result = await transporter.sendMail({
      from: `Alamait Student Accommodation <${process.env.EMAIL_USER}>`,
      to: 'test@example.com', // Change this to your email for testing
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
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your email inbox (or spam folder)');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n🔧 SOLUTION: Gmail authentication failed');
      console.log('1. Check your Gmail app password is correct (16 characters)');
      console.log('2. Ensure 2-factor authentication is enabled on Gmail');
      console.log('3. Verify EMAIL_APP_PASSWORD in .env file');
    } else if (error.message.includes('connection')) {
      console.log('\n🔧 SOLUTION: Email connection failed');
      console.log('1. Check your internet connection');
      console.log('2. Verify Gmail SMTP settings');
      console.log('3. Check firewall settings');
    } else {
      console.log('\n🔧 SOLUTION: General email error');
      console.log('Error details:', error.message);
    }
  }
}

testEmailSimple();
