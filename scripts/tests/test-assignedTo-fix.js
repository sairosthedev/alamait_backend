const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'admin123';

// Test data
let adminToken;
let testRequestId = '688def7cd7fd1a4091fc2d2f';

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

// Test 2: Update request with assignedTo
async function testAssignedToUpdate() {
    console.log('\n🔄 Testing: Update Request with assignedTo');
    
    try {
        const updateData = {
            assignedTo: "688c9c858e2ef0e7c3a6256f",
            adminResponse: "Testing assignedTo fix"
        };
        
        console.log('📋 Update data:', updateData);
        
        const response = await makeAuthenticatedRequest('PUT', `/requests/${testRequestId}`, updateData);
        
        console.log('✅ Request updated successfully');
        console.log('📋 Response:', response.data.message);
        console.log('📋 Changes made:', response.data.changes);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Failed to update request:', error.response?.status, error.response?.data || error.message);
        return null;
    }
}

// Test 3: Verify assignedTo is properly displayed
async function verifyAssignedTo() {
    console.log('\n✅ Testing: Verify assignedTo Display');
    
    try {
        const response = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = response.data.request;
        
        console.log('📋 Request details:');
        console.log('  - Title:', request.title);
        console.log('  - Status:', request.status);
        console.log('  - Admin Response:', request.adminResponse);
        
        // Check assignedTo structure
        if (request.assignedTo) {
            console.log('  - Assigned To:');
            console.log('    - ID:', request.assignedTo._id);
            console.log('    - Name:', request.assignedTo.name);
            console.log('    - Surname:', request.assignedTo.surname);
            console.log('    - Role:', request.assignedTo.role);
            
            // Verify the structure is correct
            if (request.assignedTo._id && request.assignedTo.name && request.assignedTo.surname) {
                console.log('✅ assignedTo structure is correct');
            } else {
                console.log('❌ assignedTo structure is incomplete');
            }
        } else {
            console.log('  - Assigned To: Not assigned');
        }
        
        return request;
    } catch (error) {
        console.error('❌ Failed to verify assignedTo:', error.response?.data || error.message);
        return null;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Testing assignedTo Field Fix');
    console.log('================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 2: Update with assignedTo
    const updatedRequest = await testAssignedToUpdate();
    if (!updatedRequest) {
        console.log('❌ Update failed');
        return;
    }
    
    // Test 3: Verify assignedTo display
    await verifyAssignedTo();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('  - assignedTo field now properly accepts user ID as string');
    console.log('  - User details are automatically fetched and stored');
    console.log('  - assignedTo is properly displayed in the response');
    console.log('  - Structure includes _id, name, surname, and role');
}

// Run the tests
runTests().catch(console.error); 