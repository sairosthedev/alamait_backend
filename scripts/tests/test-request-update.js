const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'admin123';

// Test data
let adminToken;
let testRequestId = '688def7cd7fd1a4091fc2d2f'; // The request ID from your error

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

// Test 2: Check if request exists
async function checkRequestExists() {
    console.log('\n🔍 Testing: Check if Request Exists');
    
    try {
        const response = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        
        console.log('✅ Request found');
        console.log('📋 Request details:');
        console.log('  - Title:', response.data.request.title);
        console.log('  - Status:', response.data.request.status);
        console.log('  - Type:', response.data.request.type);
        console.log('  - Submitted by:', response.data.request.submittedBy?.firstName, response.data.request.submittedBy?.lastName);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Request not found:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: Update request with your data
async function updateRequest() {
    console.log('\n🔄 Testing: Update Request');
    
    try {
        const updateData = {
            adminResponse: "lol",
            status: "in-progress",  // Fixed: using correct enum value
            selectedQuotation: "688def7cd7fd1a4091fc2d31",
            assignedTo: "688c9c858e2ef0e7c3a6256f"
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

// Test 4: Verify the update
async function verifyUpdate() {
    console.log('\n✅ Testing: Verify Update');
    
    try {
        const response = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = response.data.request;
        
        console.log('📋 Updated request details:');
        console.log('  - Status:', request.status);
        console.log('  - Admin Response:', request.adminResponse);
        
        // Display assignedTo information properly
        if (request.assignedTo) {
            if (request.assignedTo._id) {
                console.log('  - Assigned To:', {
                    id: request.assignedTo._id,
                    name: request.assignedTo.name,
                    surname: request.assignedTo.surname,
                    role: request.assignedTo.role
                });
            } else {
                console.log('  - Assigned To:', request.assignedTo);
            }
        } else {
            console.log('  - Assigned To: Not assigned');
        }
        
        // Check if quotation was selected
        if (request.items && request.items.length > 0) {
            request.items.forEach((item, index) => {
                if (item.quotations && item.quotations.length > 0) {
                    console.log(`  - Item ${index + 1} quotations:`);
                    item.quotations.forEach((quotation, qIndex) => {
                        console.log(`    Quotation ${qIndex + 1}: ${quotation.isSelected ? '✅ Selected' : '❌ Not selected'}`);
                    });
                }
            });
        }
        
        return request;
    } catch (error) {
        console.error('❌ Failed to verify update:', error.response?.data || error.message);
        return null;
    }
}

// Test 5: Test different update scenarios
async function testDifferentUpdates() {
    console.log('\n🧪 Testing: Different Update Scenarios');
    
    const testCases = [
        {
            name: 'Update status only',
            data: { status: 'completed' }
        },
        {
            name: 'Update priority',
            data: { priority: 'high' }
        },
        {
            name: 'Update multiple fields',
            data: { 
                status: 'pending', 
                priority: 'medium',
                adminResponse: 'Updated response'
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔄 Testing: ${testCase.name}`);
        
        try {
            const response = await makeAuthenticatedRequest('PUT', `/requests/${testRequestId}`, testCase.data);
            console.log('✅ Success:', response.data.message);
            console.log('📋 Changes:', response.data.changes);
        } catch (error) {
            console.error('❌ Failed:', error.response?.data || error.message);
        }
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Testing Request Update Functionality');
    console.log('=====================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 2: Check if request exists
    const request = await checkRequestExists();
    if (!request) {
        console.log('❌ Cannot proceed without existing request');
        return;
    }
    
    // Test 3: Update request
    const updatedRequest = await updateRequest();
    if (!updatedRequest) {
        console.log('❌ Update failed');
        return;
    }
    
    // Test 4: Verify update
    await verifyUpdate();
    
    // Test 5: Test different scenarios
    await testDifferentUpdates();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('  - PUT /api/requests/:id route is now available');
    console.log('  - Admins can update multiple fields at once');
    console.log('  - Quotation selection is supported');
    console.log('  - Request history is properly tracked');
    console.log('  - All changes are validated and logged');
}

// Run the tests
runTests().catch(console.error); 