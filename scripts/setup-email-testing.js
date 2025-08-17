/**
 * Email Testing Setup Script
 * 
 * This script helps you set up the environment variables needed for email testing.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Email Testing Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
    console.log('❌ .env file not found. Creating one...');
    
    const envContent = `# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_APP_PASSWORD=your-app-specific-password
TEST_EMAIL=your-test-email@gmail.com

# Database Configuration
MONGODB_URI=your-mongodb-connection-string

# Other Configuration
NODE_ENV=development
PORT=5000
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
} else {
    console.log('✅ .env file found');
}

console.log('\n📋 Required Environment Variables:');
console.log('EMAIL_USER=your-gmail@gmail.com');
console.log('EMAIL_APP_PASSWORD=your-app-specific-password');
console.log('TEST_EMAIL=your-test-email@gmail.com');

console.log('\n🔧 Setup Instructions:');
console.log('1. Enable 2FA on your Gmail account');
console.log('2. Generate an app-specific password:');
console.log('   - Go to Google Account settings');
console.log('   - Security > 2-Step Verification > App passwords');
console.log('   - Generate password for "Mail"');
console.log('3. Update the .env file with your credentials');
console.log('4. Run: node scripts/test-email-notifications.js');

console.log('\n⚠️  Important Notes:');
console.log('- Use a real Gmail account with 2FA enabled');
console.log('- Use the app-specific password, not your regular password');
console.log('- Test emails will be sent to TEST_EMAIL address');
console.log('- Make sure your Gmail account allows "less secure app access" or use app-specific passwords');

console.log('\n🚀 Ready to test? Run:');
console.log('node scripts/test-email-notifications.js'); 