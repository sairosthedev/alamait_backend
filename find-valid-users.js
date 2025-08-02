const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'Admin@123';

// Test data
let adminToken;

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(method, url, data = null, headers = {}) {
    const config = {
        method,
        url: `${API_BASE_URL}${url}`,
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    if (data) {
        config.data = data;
    }
    
    return axios(config);
}

// Test 1: Login as admin
async function loginAsAdmin() {
    console.log('\n🔐 Testing: Login as Admin');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        adminToken = response.data.token;
        console.log('✅ Admin login successful');
        return true;
    } catch (error) {
        console.error('❌ Admin login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 2: Find all users
async function findAllUsers() {
    console.log('\n👥 Finding all users in database');
    
    try {
        const response = await makeAuthenticatedRequest('GET', '/admin/users');
        console.log('📋 Response structure:', Object.keys(response.data));
        
        // Handle different possible response structures
        let users = [];
        if (response.data.users) {
            users = response.data.users;
        } else if (response.data.data) {
            users = response.data.data;
        } else if (Array.isArray(response.data)) {
            users = response.data;
        } else {
            console.log('📋 Full response:', JSON.stringify(response.data, null, 2));
            return null;
        }
        
        console.log(`📋 Found ${users.length} users:`);
        
        users.forEach((user, index) => {
            console.log(`  ${index + 1}. ID: ${user._id}`);
            console.log(`     Name: ${user.firstName} ${user.lastName}`);
            console.log(`     Email: ${user.email}`);
            console.log(`     Role: ${user.role}`);
            console.log(`     Status: ${user.status}`);
            console.log('');
        });
        
        // Find valid users for assignment (not the current admin)
        const validUsers = users.filter(user => 
            user._id !== '67c023adae5e27657502e887' && // Not the current admin
            user.status === 'active'
        );
        
        if (validUsers.length > 0) {
            console.log('✅ Valid users for assignment:');
            validUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.firstName} ${user.lastName} (${user._id})`);
            });
            
            return validUsers[0]; // Return first valid user
        } else {
            console.log('❌ No valid users found for assignment');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Failed to find users:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Test with valid user
async function testWithValidUser(validUser) {
    console.log('\n🔄 Testing: Update Request with Valid User');
    
    try {
        const testRequestId = '688def7cd7fd1a4091fc2d2f';
        
        const updateData = {
            assignedTo: validUser._id,
            adminResponse: "Testing assignedTo with valid user - " + new Date().toISOString()
        };
        
        console.log('📋 Update data:', updateData);
        console.log('📋 Using user:', validUser.firstName, validUser.lastName);
        
        const response = await makeAuthenticatedRequest('PUT', `/requests/${testRequestId}`, updateData);
        
        console.log('✅ Request updated successfully');
        console.log('📋 Response message:', response.data.message);
        console.log('📋 Changes made:', response.data.changes);
        
        if (response.data.request && response.data.request.assignedTo) {
            console.log('📋 AssignedTo in response:', response.data.request.assignedTo);
        } else {
            console.log('📋 AssignedTo missing from response');
        }
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Failed to update request:');
        console.error('  - Status:', error.response?.status);
        console.error('  - Data:', error.response?.data);
        console.error('  - Message:', error.message);
        return null;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Finding Valid Users for assignedTo Testing');
    console.log('=============================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 2: Find all users
    const validUser = await findAllUsers();
    if (!validUser) {
        console.log('❌ No valid users found');
        return;
    }
    
    // Test 3: Test with valid user
    const updatedRequest = await testWithValidUser(validUser);
    if (!updatedRequest) {
        console.log('❌ Update failed');
        return;
    }
    
    console.log('\n✅ Test completed!');
    console.log('\n📋 Summary:');
    console.log(`  - Found valid user: ${validUser.firstName} ${validUser.lastName}`);
    console.log(`  - User ID: ${validUser._id}`);
    console.log('  - Use this ID for your frontend testing');
}

// Run the tests
runTests().catch(console.error); 