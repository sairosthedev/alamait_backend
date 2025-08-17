const bcrypt = require('bcryptjs');

// Test the exact password generation logic from manualAddStudent
function testPasswordGeneration() {
  console.log('Testing password generation logic...\n');
  
  // Test the exact logic from manualAddStudent
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  console.log('Generated temporary password:', tempPassword);
  console.log('Password length:', tempPassword.length);
  console.log('Password contains only alphanumeric:', /^[a-zA-Z0-9]+$/.test(tempPassword));
  
  // Test multiple generations to see patterns
  console.log('\nTesting multiple generations:');
  for (let i = 0; i < 5; i++) {
    const testPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
    console.log(`Password ${i + 1}: ${testPassword} (length: ${testPassword.length})`);
  }
  
  // Test bcrypt hashing and comparison
  console.log('\nTesting bcrypt hashing and comparison:');
  const testPassword = 'test123';
  console.log('Original password:', testPassword);
  
  bcrypt.genSalt(10).then(salt => {
    return bcrypt.hash(testPassword, salt);
  }).then(hashedPassword => {
    console.log('Hashed password:', hashedPassword);
    console.log('Hash length:', hashedPassword.length);
    
    // Test comparison
    return bcrypt.compare(testPassword, hashedPassword);
  }).then(isMatch => {
    console.log('Password comparison result:', isMatch);
    
    // Test with wrong password
    return bcrypt.compare('wrongpassword', hashedPassword);
  }).then(isMatch => {
    console.log('Wrong password comparison result:', isMatch);
  }).catch(error => {
    console.error('Error in bcrypt test:', error);
  });
}

// Test the specific issue with the current generation method
function testCurrentGenerationMethod() {
  console.log('\n=== Testing Current Generation Method ===');
  
  // This is the exact logic from the manualAddStudent function
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  
  console.log('Generated password:', tempPassword);
  console.log('Password type:', typeof tempPassword);
  console.log('Password length:', tempPassword.length);
  
  // Check if it contains any problematic characters
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(tempPassword);
  console.log('Contains special characters:', hasSpecialChars);
  
  // Check if it's empty or undefined
  console.log('Is empty:', !tempPassword);
  console.log('Is undefined:', tempPassword === undefined);
  
  // Test the exact hashing process
  bcrypt.genSalt(10).then(salt => {
    console.log('Generated salt:', salt);
    return bcrypt.hash(tempPassword, salt);
  }).then(hashedPassword => {
    console.log('Hashed password:', hashedPassword);
    
    // Test comparison with the original
    return bcrypt.compare(tempPassword, hashedPassword);
  }).then(isMatch => {
    console.log('Comparison result:', isMatch);
    
    if (!isMatch) {
      console.log('❌ PASSWORD COMPARISON FAILED!');
      console.log('This indicates the issue with the current generation method.');
    } else {
      console.log('✅ Password comparison successful');
    }
  }).catch(error => {
    console.error('Error in current method test:', error);
  });
}

// Test an improved password generation method
function testImprovedGenerationMethod() {
  console.log('\n=== Testing Improved Generation Method ===');
  
  // Improved method that ensures better password quality
  function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  const improvedPassword = generateTempPassword();
  console.log('Improved password:', improvedPassword);
  console.log('Password length:', improvedPassword.length);
  console.log('Contains only alphanumeric:', /^[a-zA-Z0-9]+$/.test(improvedPassword));
  
  // Test hashing and comparison
  bcrypt.genSalt(10).then(salt => {
    return bcrypt.hash(improvedPassword, salt);
  }).then(hashedPassword => {
    console.log('Hashed improved password:', hashedPassword);
    return bcrypt.compare(improvedPassword, hashedPassword);
  }).then(isMatch => {
    console.log('Improved method comparison result:', isMatch);
  }).catch(error => {
    console.error('Error in improved method test:', error);
  });
}

// Run all tests
async function runAllTests() {
  console.log('🔍 PASSWORD GENERATION DEBUG TEST\n');
  console.log('=' .repeat(50));
  
  testPasswordGeneration();
  
  // Wait a bit for async operations
  setTimeout(() => {
    testCurrentGenerationMethod();
  }, 1000);
  
  setTimeout(() => {
    testImprovedGenerationMethod();
  }, 2000);
}

runAllTests(); 