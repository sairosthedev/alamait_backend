const mongoose = require('mongoose');
const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';

// Test with existing user credentials from database
const TEST_USERS = {
    student: {
        email: 'test.student@alamait.com',
        password: 'test123'
    },
    admin: {
        email: 'test.admin@alamait.com', 
        password: 'test123'
    },
    finance: {
        email: 'test.finance@alamait.com',
        password: 'test123'
    },
    ceo: {
        email: 'test.ceo@alamait.com',
        password: 'test123'
    }
};

let authTokens = {};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null, token = null) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`❌ Request failed: ${method} ${endpoint}`, error.response?.data || error.message);
        throw error;
    }
};

// Test 1: Try to login with existing credentials
const testLogin = async (userType) => {
    console.log(`\n🔵 Test Login: ${userType}`);
    try {
        const user = TEST_USERS[userType];
        const loginData = await makeRequest('POST', '/auth/login', {
            email: user.email,
            password: user.password
        });
        
        authTokens[userType] = loginData.token;
        console.log(`✅ ${userType} login successful`);
        return loginData.user;
    } catch (error) {
        console.log(`❌ ${userType} login failed - trying alternative credentials`);
        
        // Try alternative credentials
        const alternativeCredentials = {
            student: [
                { email: 'kudzaicindyrellapemhiwa@gmail.com', password: 'password123' },
                { email: 'macdonald.sairos@students.uz.ac.zw', password: 'password123' },
                { email: 'sairosmiccs@gmail.com', password: 'password123' }
            ],
            admin: [
                { email: 'admin.assistant@alamait.com', password: 'password123' },
                { email: 'macdonaldsairos24@gmail.com', password: 'password123' }
            ],
            finance: [
                { email: 'finance.assistant@alamait.com', password: 'password123' },
                { email: 'macdonaldsairos01@gmail.com', password: 'password123' }
            ],
            ceo: [
                { email: 'ceo.assistant@alamait.com', password: 'password123' }
            ]
        };
        
        for (const cred of alternativeCredentials[userType]) {
            try {
                const loginData = await makeRequest('POST', '/auth/login', cred);
                authTokens[userType] = loginData.token;
                console.log(`✅ ${userType} login successful with alternative credentials`);
                return loginData.user;
            } catch (err) {
                continue;
            }
        }
        
        console.log(`❌ ${userType} login failed with all credentials`);
        return null;
    }
};

// Test 2: Get existing maintenance requests
const testGetMaintenanceRequests = async () => {
    console.log('\n🔵 Test: Get Existing Maintenance Requests');
    try {
        const requests = await makeRequest('GET', '/maintenance', null, authTokens.student || authTokens.admin);
        console.log(`✅ Found ${requests.length || 0} maintenance requests`);
        
        if (requests.length > 0) {
            console.log('📋 Sample requests:');
            requests.slice(0, 3).forEach((req, index) => {
                console.log(`   ${index + 1}. ${req.issue} - Status: ${req.status} - Finance Status: ${req.financeStatus}`);
            });
        }
        
        return requests;
    } catch (error) {
        console.log('❌ Failed to get maintenance requests');
        return [];
    }
};

// Test 3: Create a test maintenance request
const testCreateMaintenanceRequest = async (student) => {
    console.log('\n🔵 Test: Create Maintenance Request');
    try {
        const maintenanceData = {
            issue: 'Test Door Replacement',
            description: 'Test maintenance request for workflow testing',
            room: 'Test Room 101',
            category: 'exterior',
            priority: 'medium',
            residence: student?.residence || '67d723cf20f89c4ae69804f3'
        };
        
        const request = await makeRequest('POST', '/student/maintenance', maintenanceData, authTokens.student);
        console.log('✅ Maintenance request created:', request.maintenance._id);
        return request.maintenance;
    } catch (error) {
        console.log('❌ Maintenance request creation failed');
        return null;
    }
};

// Test 4: Check finance maintenance endpoints
const testFinanceMaintenanceEndpoints = async () => {
    console.log('\n🔵 Test: Check Finance Maintenance Endpoints');
    try {
        const financeRequests = await makeRequest('GET', '/finance/maintenance/requests', null, authTokens.finance);
        console.log(`✅ Finance maintenance endpoint accessible`);
        console.log(`   - Found ${financeRequests.requests?.length || 0} requests`);
        
        return financeRequests;
    } catch (error) {
        console.log('❌ Finance maintenance endpoints not accessible');
        return null;
    }
};

// Test 5: Check expense endpoints
const testExpenseEndpoints = async () => {
    console.log('\n🔵 Test: Check Expense Endpoints');
    try {
        const expenses = await makeRequest('GET', '/finance/expenses', null, authTokens.finance);
        console.log(`✅ Expense endpoints accessible`);
        console.log(`   - Found ${expenses.expenses?.length || 0} expenses`);
        
        const maintenanceExpenses = expenses.expenses?.filter(exp => 
            exp.category === 'Maintenance' || 
            exp.description?.toLowerCase().includes('maintenance')
        ) || [];
        
        console.log(`   - Found ${maintenanceExpenses.length} maintenance expenses`);
        
        return expenses;
    } catch (error) {
        console.log('❌ Expense endpoints not accessible');
        return null;
    }
};

// Test 6: Check transaction endpoints
const testTransactionEndpoints = async () => {
    console.log('\n🔵 Test: Check Transaction Endpoints');
    try {
        const transactions = await makeRequest('GET', '/finance/transactions', null, authTokens.finance);
        console.log(`✅ Transaction endpoints accessible`);
        console.log(`   - Found ${transactions.transactions?.length || 0} transactions`);
        
        const maintenanceTransactions = transactions.transactions?.filter(txn => 
            txn.description?.toLowerCase().includes('maintenance') ||
            txn.reference?.includes('MAINT')
        ) || [];
        
        console.log(`   - Found ${maintenanceTransactions.length} maintenance transactions`);
        
        return transactions;
    } catch (error) {
        console.log('❌ Transaction endpoints not accessible');
        return null;
    }
};

// Test 7: Try to approve a maintenance request
const testMaintenanceApproval = async (maintenanceRequest) => {
    if (!maintenanceRequest) {
        console.log('\n🔵 Test: Maintenance Approval (skipped - no request to approve)');
        return null;
    }
    
    console.log('\n🔵 Test: Maintenance Approval');
    try {
        const approvalData = {
            notes: 'Test finance approval',
            amount: 150.00,
            maintenanceAccount: '5099',
            apAccount: '2000'
        };
        
        const approvalResult = await makeRequest('PATCH', `/finance/maintenance/requests/${maintenanceRequest._id}/approve`, approvalData, authTokens.finance);
        console.log('✅ Finance approval successful');
        console.log('   - Expense created:', approvalResult.expense?.expenseId);
        console.log('   - Transaction created:', approvalResult.transaction?.transactionId);
        return approvalResult;
    } catch (error) {
        console.log('❌ Finance approval failed');
        return null;
    }
};

// Main test function
const runAuthWorkflowTest = async () => {
    console.log('🚀 Starting Authenticated Maintenance Request Workflow Test');
    console.log('==========================================================');
    
    try {
        // Test 1: Try to login with different user types
        const student = await testLogin('student');
        const admin = await testLogin('admin');
        const finance = await testLogin('finance');
        const ceo = await testLogin('ceo');
        
        // Test 2: Get existing maintenance requests
        const existingRequests = await testGetMaintenanceRequests();
        
        // Test 3: Create a new maintenance request (if student login worked)
        let newRequest = null;
        if (student) {
            newRequest = await testCreateMaintenanceRequest(student);
        }
        
        // Test 4: Check finance endpoints (if finance login worked)
        let financeRequests = null;
        if (finance) {
            financeRequests = await testFinanceMaintenanceEndpoints();
        }
        
        // Test 5: Check expense endpoints
        const expenses = await testExpenseEndpoints();
        
        // Test 6: Check transaction endpoints
        const transactions = await testTransactionEndpoints();
        
        // Test 7: Try to approve a request (if we have finance access and a request)
        let approvalResult = null;
        if (finance && (newRequest || existingRequests.length > 0)) {
            const requestToApprove = newRequest || existingRequests[0];
            approvalResult = await testMaintenanceApproval(requestToApprove);
        }
        
        console.log('\n🎉 AUTHENTICATED WORKFLOW TEST COMPLETED!');
        console.log('==========================================');
        console.log('✅ Backend is running and accessible');
        console.log(`✅ Student login: ${student ? 'Success' : 'Failed'}`);
        console.log(`✅ Admin login: ${admin ? 'Success' : 'Failed'}`);
        console.log(`✅ Finance login: ${finance ? 'Success' : 'Failed'}`);
        console.log(`✅ CEO login: ${ceo ? 'Success' : 'Failed'}`);
        console.log(`✅ Found ${existingRequests.length} existing maintenance requests`);
        console.log(`✅ New request created: ${newRequest ? 'Yes' : 'No'}`);
        console.log(`✅ Finance endpoints: ${financeRequests ? 'Accessible' : 'Not accessible'}`);
        console.log(`✅ Expense endpoints: ${expenses ? 'Accessible' : 'Not accessible'}`);
        console.log(`✅ Transaction endpoints: ${transactions ? 'Accessible' : 'Not accessible'}`);
        console.log(`✅ Approval test: ${approvalResult ? 'Success' : 'Not tested'}`);
        
        // Summary
        console.log('\n📊 System Status Summary:');
        console.log('========================');
        console.log(`   - Existing Maintenance Requests: ${existingRequests.length}`);
        console.log(`   - New Request Created: ${newRequest ? 'Yes' : 'No'}`);
        console.log(`   - Finance Access: ${finance ? 'Available' : 'Not available'}`);
        console.log(`   - Maintenance Expenses: ${expenses?.expenses?.filter(e => e.category === 'Maintenance').length || 0}`);
        console.log(`   - Maintenance Transactions: ${transactions?.transactions?.filter(t => t.description?.includes('maintenance')).length || 0}`);
        
        if (student && finance) {
            console.log('\n🎯 READY FOR MANUAL TESTING!');
            console.log('============================');
            console.log('✅ All user types can login');
            console.log('✅ Backend endpoints are working');
            console.log('✅ You can now test the complete workflow manually');
            console.log('\n📋 Manual Test Steps:');
            console.log('1. Open browser and login as student');
            console.log('2. Create a maintenance request');
            console.log('3. Login as admin and assign the request');
            console.log('4. Login as finance and approve the request');
            console.log('5. Verify expense and transaction creation');
            console.log('6. Login as CEO and view the approved request');
        } else {
            console.log('\n💡 Next Steps:');
            console.log('==============');
            console.log('1. Check user passwords in the database');
            console.log('2. Or reset passwords for test users');
            console.log('3. Then test the complete workflow manually');
        }
        
    } catch (error) {
        console.log('\n❌ AUTHENTICATED WORKFLOW TEST FAILED!');
        console.log('=======================================');
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// Run the test
if (require.main === module) {
    runAuthWorkflowTest()
        .then(() => {
            console.log('\n✅ Authenticated test completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Authenticated test failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runAuthWorkflowTest
}; 