const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';

// Test login
const testLogin = async (email, password) => {
    try {
        console.log(`\n🔵 Testing login for: ${email}`);
        
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: email,
            password: password
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Login successful!');
        console.log('   - Token received:', response.data.token ? 'Yes' : 'No');
        console.log('   - User role:', response.data.user?.role);
        console.log('   - User ID:', response.data.user?._id);
        
        return response.data;
    } catch (error) {
        console.log('❌ Login failed');
        console.log('   - Status:', error.response?.status);
        console.log('   - Error:', error.response?.data?.error || error.message);
        return null;
    }
};

// Test different credentials
const runLoginTests = async () => {
    console.log('🚀 Testing Login Endpoints');
    console.log('==========================');
    
    // Test with the newly created users
    const testCredentials = [
        { email: 'test.student@alamait.com', password: 'test123', role: 'student' },
        { email: 'test.admin@alamait.com', password: 'test123', role: 'admin' },
        { email: 'test.finance@alamait.com', password: 'test123', role: 'finance' },
        { email: 'test.ceo@alamait.com', password: 'test123', role: 'ceo' }
    ];
    
    for (const cred of testCredentials) {
        await testLogin(cred.email, cred.password);
    }
    
    // Test with existing users from database
    const existingCredentials = [
        { email: 'admin@alamait.com', password: 'password123', role: 'admin' },
        { email: 'finance@alamait.com', password: 'password123', role: 'finance' },
        { email: 'ceo@alamait.com', password: 'password123', role: 'ceo' }
    ];
    
    console.log('\n🔵 Testing existing users...');
    for (const cred of existingCredentials) {
        await testLogin(cred.email, cred.password);
    }
    
    console.log('\n✅ Login tests completed!');
};

// Run the tests
if (require.main === module) {
    runLoginTests()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Login tests failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    testLogin,
    runLoginTests
}; 