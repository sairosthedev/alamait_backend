const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://alamait-backend.onrender.com/api';
const STUDENT_EMAIL = 'rbanda@maitalan.com';
const STUDENT_PASSWORD = 'password123';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'Admin@123';

// Test data
let studentToken;
let adminToken;

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(method, url, data = null, headers = {}, token) {
    const config = {
        method,
        url: `${API_BASE_URL}${url}`,
        headers: {
            'Authorization': `Bearer ${token}`,
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

// Test 2: Login as admin
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

// Test 3: Get requests as student (should see mapped statuses)
async function getRequestsAsStudent() {
    console.log('\n👨‍🎓 Testing: Get Requests as Student');
    
    try {
        const response = await makeAuthenticatedRequest('GET', '/requests', null, {}, studentToken);
        
        console.log('✅ Student requests retrieved successfully');
        console.log(`📋 Found ${response.data.requests.length} requests`);
        
        // Check status mapping
        response.data.requests.forEach((request, index) => {
            console.log(`\n📋 Request ${index + 1}:`);
            console.log(`  - ID: ${request._id}`);
            console.log(`  - Title/Issue: ${request.title || request.issue}`);
            console.log(`  - Status: ${request.status}`);
            console.log(`  - Status Description: ${request.statusDescription || 'N/A'}`);
            
            // Verify status is student-friendly
            const validStudentStatuses = ['pending', 'in-progress', 'completed', 'rejected', 'waitlisted'];
            if (!validStudentStatuses.includes(request.status)) {
                console.log(`  ⚠️  WARNING: Status "${request.status}" is not student-friendly`);
            } else {
                console.log(`  ✅ Status "${request.status}" is student-friendly`);
            }
        });
        
        return response.data.requests;
    } catch (error) {
        console.error('❌ Failed to get student requests:', error.response?.data || error.message);
        return null;
    }
}

// Test 4: Get requests as admin (should see original statuses)
async function getRequestsAsAdmin() {
    console.log('\n👨‍💼 Testing: Get Requests as Admin');
    
    try {
        const response = await makeAuthenticatedRequest('GET', '/requests', null, {}, adminToken);
        
        console.log('✅ Admin requests retrieved successfully');
        console.log(`📋 Found ${response.data.requests.length} requests`);
        
        // Check original statuses
        response.data.requests.forEach((request, index) => {
            console.log(`\n📋 Request ${index + 1}:`);
            console.log(`  - ID: ${request._id}`);
            console.log(`  - Title/Issue: ${request.title || request.issue}`);
            console.log(`  - Status: ${request.status}`);
            
            // Check if status contains approval workflow
            const approvalStatuses = ['pending_finance_approval', 'pending_ceo_approval', 'pending_admin_approval'];
            if (approvalStatuses.some(status => request.status.includes(status))) {
                console.log(`  ✅ Status "${request.status}" shows approval workflow (admin view)`);
            }
        });
        
        return response.data.requests;
    } catch (error) {
        console.error('❌ Failed to get admin requests:', error.response?.data || error.message);
        return null;
    }
}

// Test 5: Test status mapping logic
async function testStatusMapping() {
    console.log('\n🧪 Testing: Status Mapping Logic');
    
    const testCases = [
        { original: 'pending', expected: 'pending' },
        { original: 'pending_finance_approval', expected: 'pending' },
        { original: 'pending_ceo_approval', expected: 'pending' },
        { original: 'pending_admin_approval', expected: 'pending' },
        { original: 'pending-finance-approval', expected: 'pending' },
        { original: 'pending-ceo-approval', expected: 'pending' },
        { original: 'pending-admin-approval', expected: 'pending' },
        { original: 'in-progress', expected: 'in-progress' },
        { original: 'assigned', expected: 'in-progress' },
        { original: 'completed', expected: 'completed' },
        { original: 'rejected', expected: 'rejected' },
        { original: 'waitlisted', expected: 'waitlisted' }
    ];
    
    console.log('📋 Testing status mapping:');
    testCases.forEach(testCase => {
        const mapped = mapStatusForStudent(testCase.original);
        const passed = mapped === testCase.expected;
        console.log(`  ${passed ? '✅' : '❌'} "${testCase.original}" → "${mapped}" (expected: "${testCase.expected}")`);
    });
}

// Helper function to map status (same as in controller)
function mapStatusForStudent(originalStatus) {
    switch (originalStatus) {
        case 'pending':
        case 'pending_finance_approval':
        case 'pending_ceo_approval':
        case 'pending_admin_approval':
        case 'pending-finance-approval':
        case 'pending-ceo-approval':
        case 'pending-admin-approval':
            return 'pending';
        case 'in-progress':
        case 'assigned':
            return 'in-progress';
        case 'completed':
            return 'completed';
        case 'rejected':
            return 'rejected';
        case 'waitlisted':
            return 'waitlisted';
        default:
            return originalStatus;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Testing Student Status Mapping');
    console.log('================================');
    
    // Test 1: Login as student
    const studentLoginSuccess = await loginAsStudent();
    if (!studentLoginSuccess) {
        console.log('❌ Cannot proceed without student login');
        return;
    }
    
    // Test 2: Login as admin
    const adminLoginSuccess = await loginAsAdmin();
    if (!adminLoginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 3: Test status mapping logic
    testStatusMapping();
    
    // Test 4: Get requests as student
    const studentRequests = await getRequestsAsStudent();
    
    // Test 5: Get requests as admin
    const adminRequests = await getRequestsAsAdmin();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('  - Students should see simplified statuses (pending, in-progress, completed)');
    console.log('  - Admins should see full approval workflow statuses');
    console.log('  - Status mapping should work correctly for all approval states');
}

// Run the tests
runTests().catch(console.error); 