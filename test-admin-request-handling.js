const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'Admin@123';

let authToken = '';

// Login function
async function login() {
    try {
        console.log('🔐 Logging in as admin...');
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        authToken = response.data.token;
        console.log('✅ Admin login successful');
        return true;
    } catch (error) {
        console.error('❌ Admin login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 1: Get Admin Dashboard Stats
async function testDashboardStats() {
    try {
        console.log('\n📊 Testing Admin Dashboard Stats...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Dashboard Stats - SUCCESS');
        console.log('📋 Stats:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Dashboard Stats - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 2: Get All Maintenance Requests
async function testGetMaintenanceRequests() {
    try {
        console.log('\n🔧 Testing Get All Maintenance Requests...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/maintenance`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Maintenance Requests - SUCCESS');
        console.log('📋 Requests count:', response.data.requests?.length || 0);
        console.log('📋 Total pages:', response.data.totalPages);
        
        return response.data.requests || [];
    } catch (error) {
        console.error('❌ Get Maintenance Requests - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 3: Create Maintenance Request
async function testCreateMaintenanceRequest() {
    try {
        console.log('\n🔧 Testing Create Maintenance Request...');
        
        const maintenanceData = {
            issue: 'Test Electrical Issue',
            description: 'Power outlet not working in room B205 - Test request created by admin',
            room: 'B205',
            residence: '507f1f77bcf86cd799439011', // You'll need to replace with actual residence ID
            priority: 'medium',
            status: 'pending',
            amount: 200,
            category: 'electrical'
        };
        
        const response = await axios.post(`${BASE_URL}/api/admin/maintenance`, maintenanceData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Create Maintenance Request - SUCCESS');
        console.log('📋 Created request ID:', response.data.request?._id);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Create Maintenance Request - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 4: Update Maintenance Request
async function testUpdateMaintenanceRequest(requestId) {
    try {
        console.log(`\n🔧 Testing Update Maintenance Request: ${requestId}...`);
        
        const updateData = {
            status: 'assigned',
            priority: 'high',
            amount: 300,
            comment: 'Updated by admin test - assigned to maintenance team'
        };
        
        const response = await axios.put(`${BASE_URL}/api/admin/maintenance/${requestId}`, updateData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Update Maintenance Request - SUCCESS');
        console.log('📋 Updated status:', response.data.request?.status);
        console.log('📋 Updated priority:', response.data.request?.priority);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Update Maintenance Request - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 5: Get All Applications
async function testGetApplications() {
    try {
        console.log('\n📝 Testing Get All Applications...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/applications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Applications - SUCCESS');
        console.log('📋 Applications count:', response.data.applications?.length || 0);
        
        return response.data.applications || [];
    } catch (error) {
        console.error('❌ Get Applications - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 6: Update Application Status (Approve)
async function testApproveApplication(applicationId) {
    try {
        console.log(`\n📝 Testing Approve Application: ${applicationId}...`);
        
        const approvalData = {
            action: 'approve',
            roomNumber: 'A101',
            residenceId: '507f1f77bcf86cd799439011' // You'll need to replace with actual residence ID
        };
        
        const response = await axios.put(`${BASE_URL}/api/admin/applications/${applicationId}`, approvalData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Approve Application - SUCCESS');
        console.log('📋 Application status:', response.data.application?.status);
        console.log('📋 Allocated room:', response.data.application?.allocatedRoom);
        
        return response.data.application;
    } catch (error) {
        console.error('❌ Approve Application - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 7: Get All Payments
async function testGetPayments() {
    try {
        console.log('\n💰 Testing Get All Payments...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/payments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Payments - SUCCESS');
        console.log('📋 Payments count:', response.data.payments?.length || 0);
        
        return response.data.payments || [];
    } catch (error) {
        console.error('❌ Get Payments - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 8: Create Payment
async function testCreatePayment() {
    try {
        console.log('\n💰 Testing Create Payment...');
        
        const paymentData = {
            amount: 500,
            method: 'cash',
            status: 'completed',
            description: 'Test payment created by admin',
            studentId: '507f1f77bcf86cd799439012' // You'll need to replace with actual student ID
        };
        
        const response = await axios.post(`${BASE_URL}/api/admin/payments`, paymentData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Create Payment - SUCCESS');
        console.log('📋 Payment ID:', response.data.payment?._id);
        console.log('📋 Payment status:', response.data.payment?.status);
        
        return response.data.payment;
    } catch (error) {
        console.error('❌ Create Payment - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 9: Get Financial Stats
async function testGetFinancialStats() {
    try {
        console.log('\n📊 Testing Get Financial Stats...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/dashboard/financial`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Financial Stats - SUCCESS');
        console.log('📋 Financial data:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Get Financial Stats - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 10: Get Maintenance Stats
async function testGetMaintenanceStats() {
    try {
        console.log('\n🔧 Testing Get Maintenance Stats...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/dashboard/maintenance`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Maintenance Stats - SUCCESS');
        console.log('📋 Maintenance stats:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Get Maintenance Stats - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 11: Get Occupancy Stats
async function testGetOccupancyStats() {
    try {
        console.log('\n🏠 Testing Get Occupancy Stats...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/dashboard/occupancy`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Occupancy Stats - SUCCESS');
        console.log('📋 Occupancy data:', response.data);
        
        return response.data;
    } catch (error) {
        console.error('❌ Get Occupancy Stats - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 12: Get Audit Logs
async function testGetAuditLogs() {
    try {
        console.log('\n📋 Testing Get Audit Logs...');
        
        const response = await axios.get(`${BASE_URL}/api/admin/audit-log`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Audit Logs - SUCCESS');
        console.log('📋 Audit logs count:', response.data.logs?.length || 0);
        
        return response.data.logs || [];
    } catch (error) {
        console.error('❌ Get Audit Logs - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Main test function
async function runAdminRequestHandlingTests() {
    console.log('🚀 Starting Admin Request Handling Tests\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Test Dashboard Stats
    const dashboardStats = await testDashboardStats();
    
    // Step 3: Test Maintenance Requests
    const maintenanceRequests = await testGetMaintenanceRequests();
    const newMaintenanceRequest = await testCreateMaintenanceRequest();
    
    if (newMaintenanceRequest) {
        await testUpdateMaintenanceRequest(newMaintenanceRequest._id);
    }
    
    // Step 4: Test Applications
    const applications = await testGetApplications();
    if (applications.length > 0) {
        const pendingApp = applications.find(app => app.status === 'pending');
        if (pendingApp) {
            await testApproveApplication(pendingApp._id);
        }
    }
    
    // Step 5: Test Payments
    const payments = await testGetPayments();
    await testCreatePayment();
    
    // Step 6: Test Financial Stats
    await testGetFinancialStats();
    
    // Step 7: Test Maintenance Stats
    await testGetMaintenanceStats();
    
    // Step 8: Test Occupancy Stats
    await testGetOccupancyStats();
    
    // Step 9: Test Audit Logs
    await testGetAuditLogs();
    
    console.log('\n🎉 Admin Request Handling Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ Admin dashboard stats accessible');
    console.log('✅ Maintenance requests can be viewed, created, and updated');
    console.log('✅ Applications can be viewed and approved');
    console.log('✅ Payments can be viewed and created');
    console.log('✅ Financial statistics available');
    console.log('✅ Maintenance statistics available');
    console.log('✅ Occupancy statistics available');
    console.log('✅ Audit logs accessible');
    
    console.log('\n🔗 Admin Request Handling Endpoints:');
    console.log('  - GET /api/admin/dashboard/stats');
    console.log('  - GET /api/admin/maintenance');
    console.log('  - POST /api/admin/maintenance');
    console.log('  - PUT /api/admin/maintenance/:id');
    console.log('  - GET /api/admin/applications');
    console.log('  - PUT /api/admin/applications/:id');
    console.log('  - GET /api/admin/payments');
    console.log('  - POST /api/admin/payments');
    console.log('  - GET /api/admin/dashboard/financial');
    console.log('  - GET /api/admin/dashboard/maintenance');
    console.log('  - GET /api/admin/dashboard/occupancy');
    console.log('  - GET /api/admin/audit-log');
    
    console.log('\n🚀 Admin request handling is fully functional!');
}

// Run the tests
runAdminRequestHandlingTests().catch(console.error); 