require('dotenv').config();

function checkEmailConfiguration() {
  console.log('🔍 Checking Email Configuration...\n');
  
  const requiredVars = [
    'EMAIL_USER',
    'EMAIL_APP_PASSWORD',
    'MONGODB_URI'
  ];
  
  const optionalVars = [
    'NODE_ENV',
    'EMAIL_SEND_MODE',
    'EMAIL_MAX_CONNECTIONS',
    'EMAIL_MAX_MESSAGES'
  ];
  
  console.log('📋 Required Environment Variables:');
  let allRequiredPresent = true;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName === 'EMAIL_APP_PASSWORD' ? '***' + value.slice(-4) : value}`);
    } else {
      console.log(`❌ ${varName}: Not set`);
      allRequiredPresent = false;
    }
  });
  
  console.log('\n📋 Optional Environment Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚪ ${varName}: Not set (using default)`);
    }
  });
  
  console.log('\n📊 Configuration Status:');
  if (allRequiredPresent) {
    console.log('✅ All required email configuration is present');
    console.log('📧 Email system should be working');
  } else {
    console.log('❌ Missing required email configuration');
    console.log('📧 Email system will not work until configured');
    
    console.log('\n🔧 To fix this:');
    console.log('1. Create a .env file in the root directory');
    console.log('2. Add the following variables:');
    console.log('   EMAIL_USER=your_gmail@gmail.com');
    console.log('   EMAIL_APP_PASSWORD=your_16_character_app_password');
    console.log('   MONGODB_URI=your_mongodb_connection_string');
    console.log('3. Restart the server');
  }
  
  console.log('\n📝 Current NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('📝 Email Send Mode:', process.env.EMAIL_SEND_MODE || 'immediate');
}

checkEmailConfiguration();


