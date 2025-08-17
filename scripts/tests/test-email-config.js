require('dotenv').config();
const { sendEmail } = require('./src/utils/email');

async function testEmailConfiguration() {
    console.log('🧪 Testing Email Configuration...\n');
    
    // Check environment variables
    console.log('📋 Environment Variables Check:');
    console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Not Set'}`);
    console.log(`EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not Set'}`);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.log('\n❌ Email configuration incomplete!');
        console.log('Please set EMAIL_USER and EMAIL_APP_PASSWORD in your .env file');
        return;
    }
    
    try {
        console.log('\n📧 Sending test email...');
        
        await sendEmail({
            to: process.env.EMAIL_USER, // Send to yourself for testing
            subject: 'Alamait Email Test',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                        <h2 style="color: #333;">Email Configuration Test</h2>
                        <p>✅ Your email configuration is working correctly!</p>
                        <p>This email was sent from the Alamait system to verify that:</p>
                        <ul>
                            <li>Gmail SMTP is configured correctly</li>
                            <li>App password is working</li>
                            <li>Email notifications will be sent properly</li>
                        </ul>
                        <hr style="margin: 20px 0;">
                        <p style="font-size: 12px; color: #666;">
                            Test sent at: ${new Date().toLocaleString()}
                        </p>
                    </div>
                </div>
            `
        });
        
        console.log('✅ Email sent successfully!');
        console.log(`📬 Check your inbox: ${process.env.EMAIL_USER}`);
        console.log('\n🎉 Email configuration is working correctly!');
        console.log('Monthly request notifications should now work properly.');
        
    } catch (error) {
        console.error('\n❌ Email test failed:', error.message);
        console.log('\n🔧 Common fixes:');
        console.log('1. Ensure you have 2FA enabled on your Gmail account');
        console.log('2. Generate an App Password (not your regular password)');
        console.log('3. Use the App Password in EMAIL_APP_PASSWORD');
        console.log('4. Check that EMAIL_USER is your full Gmail address');
    }
}

// Run the test
testEmailConfiguration().catch(console.error); 