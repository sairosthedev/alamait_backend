const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'Admin@123';

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
        console.log('Token:', adminToken.substring(0, 20) + '...');
        return true;
    } catch (error) {
        console.error('❌ Admin login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 2: Check current request state
async function checkCurrentState() {
    console.log('\n🔍 Testing: Check Current Request State');
    
    try {
        const response = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = response.data.request;
        
        console.log('📋 Current request state:');
        console.log('  - Title:', request.title);
        console.log('  - Status:', request.status);
        console.log('  - Assigned To:', request.assignedTo ? 'Present' : 'Missing');
        
        if (request.assignedTo) {
            console.log('    - ID:', request.assignedTo._id);
            console.log('    - Name:', request.assignedTo.name);
            console.log('    - Surname:', request.assignedTo.surname);
            console.log('    - Role:', request.assignedTo.role);
        }
        
        return request;
    } catch (error) {
        console.error('❌ Failed to get request:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Update request with assignedTo
async function updateWithAssignedTo() {
    console.log('\n🔄 Testing: Update Request with assignedTo');
    
    try {
        const updateData = {
            assignedTo: "688c9c858e2ef0e7c3a6256f",
            adminResponse: "Testing assignedTo save fix - " + new Date().toISOString()
        };
        
        console.log('📋 Update data:', updateData);
        console.log('📋 URL:', `${API_BASE_URL}/requests/${testRequestId}`);
        
        const response = await makeAuthenticatedRequest('PUT', `/requests/${testRequestId}`, updateData);
        
        console.log('✅ Request updated successfully');
        console.log('📋 Response status:', response.status);
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

// Test 4: Verify assignedTo was saved
async function verifyAssignedToSaved() {
    console.log('\n✅ Testing: Verify assignedTo was Saved');
    
    try {
        const response = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = response.data.request;
        
        console.log('📋 Request after update:');
        console.log('  - Title:', request.title);
        console.log('  - Status:', request.status);
        console.log('  - Admin Response:', request.adminResponse);
        
        // Check assignedTo structure
        if (request.assignedTo) {
            console.log('  - Assigned To: ✅ PRESENT');
            console.log('    - ID:', request.assignedTo._id);
            console.log('    - Name:', request.assignedTo.name);
            console.log('    - Surname:', request.assignedTo.surname);
            console.log('    - Role:', request.assignedTo.role);
            
            // Verify the structure is correct
            if (request.assignedTo._id && request.assignedTo.name && request.assignedTo.surname) {
                console.log('✅ assignedTo structure is correct and saved to database');
                return true;
            } else {
                console.log('❌ assignedTo structure is incomplete');
                return false;
            }
        } else {
            console.log('  - Assigned To: ❌ MISSING - Not saved to database');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to verify assignedTo:', error.response?.data || error.message);
        return false;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Debugging assignedTo Save to Database');
    console.log('========================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 2: Check current state
    const currentRequest = await checkCurrentState();
    if (!currentRequest) {
        console.log('❌ Cannot proceed without existing request');
        return;
    }
    
    // Test 3: Update with assignedTo
    const updatedRequest = await updateWithAssignedTo();
    if (!updatedRequest) {
        console.log('❌ Update failed');
        return;
    }
    
    // Test 4: Verify assignedTo was saved
    const savedSuccessfully = await verifyAssignedToSaved();
    if (!savedSuccessfully) {
        console.log('❌ assignedTo was not saved to database');
        return;
    }
    
    console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error); 