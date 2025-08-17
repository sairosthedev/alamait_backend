const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const STUDENT_EMAIL = 'rbanda@maitalan.com'; // Using one of the student emails from our earlier test
const STUDENT_PASSWORD = 'password123'; // You might need to adjust this

// Test data
let studentToken;

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(method, url, data = null, headers = {}) {
    const config = {
        method,
        url: `${API_BASE_URL}${url}`,
        headers: {
            'Authorization': `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    if (data) {
        config.data = data;
    }
    
    return axios(config);
}

// Test 1: Login as student
async function loginAsStudent() {
    console.log('\n🔐 Testing: Login as Student');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: STUDENT_EMAIL,
            password: STUDENT_PASSWORD
        });
        
        studentToken = response.data.token;
        console.log('✅ Student login successful');
        return true;
    } catch (error) {
        console.error('❌ Student login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 2: Create student maintenance request using Request model
async function createStudentMaintenanceRequest() {
    console.log('\n🔄 Testing: Create Student Maintenance Request');
    
    try {
        const requestData = {
            type: 'maintenance',
            student: '686fa791991066842501ce5a', // Renia Banda's ID
            issue: 'Test maintenance issue',
            description: 'Test maintenance description',
            room: 'B1',
            category: 'electrical',
            priority: 'medium',
            residence: '67c13eb8425a2e078f61d00e', // Residence ID
            amount: 50
        };
        
        console.log('📋 Request data:', requestData);
        
        const response = await makeAuthenticatedRequest('POST', '/requests', requestData);
        
        console.log('✅ Student maintenance request created successfully');
        console.log('📋 Response:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to create student maintenance request:');
        console.error('  - Status:', error.response?.status);
        console.error('  - Data:', error.response?.data);
        console.error('  - Message:', error.message);
        return null;
    }
}

// Test 3: Create student maintenance request using Maintenance model
async function createMaintenanceRequest() {
    console.log('\n🔄 Testing: Create Maintenance Request (Maintenance Model)');
    
    try {
        const requestData = {
            issue: 'Test maintenance issue via Maintenance model',
            description: 'Test maintenance description via Maintenance model',
            room: 'B1',
            category: 'electrical',
            priority: 'medium',
            residence: '67c13eb8425a2e078f61d00e', // Residence ID
            amount: 50
        };
        
        console.log('📋 Request data:', requestData);
        
        const response = await makeAuthenticatedRequest('POST', '/student/maintenance', requestData);
        
        console.log('✅ Maintenance request created successfully');
        console.log('📋 Response:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to create maintenance request:');
        console.error('  - Status:', error.response?.status);
        console.error('  - Data:', error.response?.data);
        console.error('  - Message:', error.message);
        return null;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Testing Student Maintenance Request Creation');
    console.log('==============================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsStudent();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without student login');
        return;
    }
    
    // Test 2: Create using Request model
    const requestResult = await createStudentMaintenanceRequest();
    if (!requestResult) {
        console.log('❌ Request model creation failed');
    }
    
    // Test 3: Create using Maintenance model
    const maintenanceResult = await createMaintenanceRequest();
    if (!maintenanceResult) {
        console.log('❌ Maintenance model creation failed');
    }
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('  - Student maintenance requests should now work with both models');
    console.log('  - Validation errors should be fixed for maintenance type requests');
}

// Run the tests
runTests().catch(console.error); 