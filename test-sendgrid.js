require('dotenv').config();
const sgMail = require('@sendgrid/mail');

async function testSendGrid() {
    console.log('🔍 Testing SendGrid Configuration...\n');
    
    // Check environment variables
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const replyTo = process.env.SENDGRID_REPLY_TO;
    
    console.log('📋 Environment Variables:');
    console.log(`SENDGRID_API_KEY: ${apiKey ? '✅ Set (' + apiKey.substring(0, 10) + '...)' : '❌ Not set'}`);
    console.log(`SENDGRID_FROM_EMAIL: ${fromEmail || '❌ Not set'}`);
    console.log(`SENDGRID_REPLY_TO: ${replyTo || '❌ Not set'}`);
    
    if (!apiKey) {
        console.log('\n❌ SENDGRID_API_KEY is not set in environment variables');
        console.log('💡 Make sure your .env file contains:');
        console.log('   SENDGRID_API_KEY=SG.your_actual_api_key_here');
        return;
    }
    
    // Test API key format
    if (!apiKey.startsWith('SG.')) {
        console.log('\n⚠️ Warning: API key should start with "SG."');
        console.log('   Current key starts with:', apiKey.substring(0, 5));
    }
    
    // Set API key
    try {
        sgMail.setApiKey(apiKey);
        console.log('\n✅ API key set successfully');
    } catch (error) {
        console.log('\n❌ Failed to set API key:', error.message);
        return;
    }
    
    // Test sending a simple email
    console.log('\n📧 Testing email send...');
    
    const testEmail = {
        to: 'test@example.com', // This won't actually send
        from: fromEmail || 'test@example.com',
        subject: 'SendGrid Test',
        text: 'This is a test email to verify SendGrid configuration',
        html: '<p>This is a test email to verify SendGrid configuration</p>'
    };
    
    try {
        // We'll use a dry run approach to test the API key without actually sending
        console.log('🔍 Testing API key validity...');
        
        // Try to get account info (this tests if the API key is valid)
        const response = await fetch('https://api.sendgrid.com/v3/user/account', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const accountInfo = await response.json();
            console.log('✅ SendGrid API key is valid!');
            console.log(`   Account: ${accountInfo.username || 'Unknown'}`);
            console.log(`   Email: ${accountInfo.email || 'Unknown'}`);
        } else {
            console.log('❌ SendGrid API key is invalid');
            console.log(`   Status: ${response.status}`);
            console.log(`   Response: ${await response.text()}`);
        }
        
    } catch (error) {
        console.log('❌ Error testing SendGrid:', error.message);
        
        if (error.message.includes('Unauthorized')) {
            console.log('\n🔧 Possible solutions:');
            console.log('1. Check if your API key is correct');
            console.log('2. Make sure the API key has proper permissions');
            console.log('3. Verify the API key is not expired');
            console.log('4. Check if your SendGrid account is active');
        }
    }
    
    console.log('\n📝 Next steps:');
    console.log('1. If API key is valid, emails should work');
    console.log('2. If still getting "Unauthorized", check:');
    console.log('   - API key permissions (needs "Full Access")');
    console.log('   - Sender email verification in SendGrid');
    console.log('   - Account status in SendGrid dashboard');
}

testSendGrid().catch(console.error);
