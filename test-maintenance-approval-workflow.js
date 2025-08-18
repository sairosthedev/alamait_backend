const mongoose = require('mongoose');
const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_DATA = {
    student: {
        email: 'macdonald.sairos@students.uz.ac.zw',
        password: '12345678'
    },
    admin: {
        email: 'macdonaldsairos24@gmail.com',
        password: '12345678'
    },
    finance: {
        email: 'macdonaldsairos01@gmail.com',
        password: '12345678'
    },
    ceo: {
        email: 'ceo@alamait.com',
        password: 'management'
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

// Test 1: Student Login
const testStudentLogin = async () => {
    console.log('\n🔵 Test 1: Student Login');
    try {
        const loginData = await makeRequest('POST', '/auth/login', {
            email: TEST_DATA.student.email,
            password: TEST_DATA.student.password
        });
        
        authTokens.student = loginData.token;
        console.log('✅ Student login successful');
        return loginData.user;
    } catch (error) {
        console.log('❌ Student login failed');
        throw error;
    }
};

// Test 2: Create Maintenance Request (Student)
const testCreateMaintenanceRequest = async (student) => {
    console.log('\n🔵 Test 2: Create Maintenance Request (Student)');
    try {
        const maintenanceData = {
            issue: 'Test Door Replacement',
            description: 'Test maintenance request for workflow testing',
            room: 'Test Room 101',
            category: 'exterior',
            priority: 'medium',
            residence: student.residence || '67d723cf20f89c4ae69804f3' // Default residence
        };
        
        const request = await makeRequest('POST', '/student/maintenance', maintenanceData, authTokens.student);
        console.log('✅ Maintenance request created:', request.maintenance._id);
        return request.maintenance;
    } catch (error) {
        console.log('❌ Maintenance request creation failed');
        throw error;
    }
};

// Test 3: Admin Login
const testAdminLogin = async () => {
    console.log('\n🔵 Test 3: Admin Login');
    try {
        const loginData = await makeRequest('POST', '/auth/login', {
            email: TEST_DATA.admin.email,
            password: TEST_DATA.admin.password
        });
        
        authTokens.admin = loginData.token;
        console.log('✅ Admin login successful');
        return loginData.user;
    } catch (error) {
        console.log('❌ Admin login failed');
        throw error;
    }
};

// Test 4: Admin Assigns Maintenance Request
const testAdminAssignMaintenance = async (maintenanceRequest) => {
    console.log('\n🔵 Test 4: Admin Assigns Maintenance Request');
    try {
        const assignmentData = {
            adminResponse: 'Test admin assignment',
            status: 'in-progress',
            assignedTo: '689247eb0067f3f7098c4b78' // Test vendor ID
        };
        
        const updatedRequest = await makeRequest('PATCH', `/requests/${maintenanceRequest._id}/status`, assignmentData, authTokens.admin);
        console.log('✅ Maintenance request assigned by admin');
        return updatedRequest;
    } catch (error) {
        console.log('❌ Admin assignment failed');
        throw error;
    }
};

// Test 5: Finance Login
const testFinanceLogin = async () => {
    console.log('\n🔵 Test 5: Finance Login');
    try {
        const loginData = await makeRequest('POST', '/auth/login', {
            email: TEST_DATA.finance.email,
            password: TEST_DATA.finance.password
        });
        
        authTokens.finance = loginData.token;
        console.log('✅ Finance login successful');
        return loginData.user;
    } catch (error) {
        console.log('❌ Finance login failed');
        throw error;
    }
};

// Test 6: Finance Approves Maintenance Request
const testFinanceApproval = async (maintenanceRequest) => {
    console.log('\n🔵 Test 6: Finance Approves Maintenance Request');
    try {
        const approvalData = {
            notes: 'Test finance approval',
            amount: 150.00,
            maintenanceAccount: '5099', // Maintenance Expense
            apAccount: '2000' // Accounts Payable
        };
        
        const approvalResult = await makeRequest('PATCH', `/finance/maintenance/requests/${maintenanceRequest._id}/approve`, approvalData, authTokens.finance);
        console.log('✅ Finance approval successful');
        console.log('   - Expense created:', approvalResult.expense?.expenseId);
        console.log('   - Transaction created:', approvalResult.transaction?.transactionId);
        return approvalResult;
    } catch (error) {
        console.log('❌ Finance approval failed');
        throw error;
    }
};

// Test 7: Verify Expense Creation
const testVerifyExpenseCreation = async (maintenanceRequest) => {
    console.log('\n🔵 Test 7: Verify Expense Creation');
    try {
        // Get expenses list
        const expenses = await makeRequest('GET', '/finance/expenses', null, authTokens.finance);
        
        // Find the expense created for this maintenance request
        const createdExpense = expenses.expenses?.find(exp => 
            exp.maintenanceRequestId === maintenanceRequest._id || 
            exp.requestId === maintenanceRequest._id
        );
        
        if (createdExpense) {
            console.log('✅ Expense found in finance system:', createdExpense.expenseId);
            console.log('   - Amount:', createdExpense.amount);
            console.log('   - Category:', createdExpense.category);
            console.log('   - Status:', createdExpense.paymentStatus);
            return createdExpense;
        } else {
            console.log('❌ Expense not found in finance system');
            throw new Error('Expense not created');
        }
    } catch (error) {
        console.log('❌ Expense verification failed');
        throw error;
    }
};

// Test 8: Verify Transaction Creation
const testVerifyTransactionCreation = async (maintenanceRequest) => {
    console.log('\n🔵 Test 8: Verify Transaction Creation');
    try {
        // Get transactions list
        const transactions = await makeRequest('GET', '/finance/transactions', null, authTokens.finance);
        
        // Find the transaction created for this maintenance request
        const createdTransaction = transactions.transactions?.find(txn => 
            txn.reference === `MAINT-${maintenanceRequest._id}` ||
            txn.description?.includes(maintenanceRequest.issue)
        );
        
        if (createdTransaction) {
            console.log('✅ Transaction found in finance system:', createdTransaction.transactionId);
            console.log('   - Description:', createdTransaction.description);
            console.log('   - Amount:', createdTransaction.amount);
            console.log('   - Type:', createdTransaction.type);
            return createdTransaction;
        } else {
            console.log('❌ Transaction not found in finance system');
            throw new Error('Transaction not created');
        }
    } catch (error) {
        console.log('❌ Transaction verification failed');
        throw error;
    }
};

// Test 9: CEO Login
const testCEOLogin = async () => {
    console.log('\n🔵 Test 9: CEO Login');
    try {
        const loginData = await makeRequest('POST', '/auth/login', {
            email: TEST_DATA.ceo.email,
            password: TEST_DATA.ceo.password
        });
        
        authTokens.ceo = loginData.token;
        console.log('✅ CEO login successful');
        return loginData.user;
    } catch (error) {
        console.log('❌ CEO login failed');
        throw error;
    }
};

// Test 10: CEO Views Approved Maintenance Request
const testCEOViewMaintenance = async (maintenanceRequest) => {
    console.log('\n🔵 Test 10: CEO Views Approved Maintenance Request');
    try {
        // Get maintenance requests for CEO
        const maintenanceRequests = await makeRequest('GET', '/finance/maintenance/requests', null, authTokens.ceo);
        
        // Find the approved maintenance request
        const approvedRequest = maintenanceRequests.requests?.find(req => 
            req.id === maintenanceRequest._id && 
            req.financeStatus === 'approved'
        );
        
        if (approvedRequest) {
            console.log('✅ CEO can see approved maintenance request');
            console.log('   - Issue:', approvedRequest.issue);
            console.log('   - Finance Status:', approvedRequest.financeStatus);
            console.log('   - Amount:', approvedRequest.amount);
            return approvedRequest;
        } else {
            console.log('❌ CEO cannot see approved maintenance request');
            throw new Error('Approved request not visible to CEO');
        }
    } catch (error) {
        console.log('❌ CEO view test failed');
        throw error;
    }
};

// Main test function
const runCompleteWorkflowTest = async () => {
    console.log('🚀 Starting Complete Maintenance Request Workflow Test');
    console.log('==================================================');
    
    try {
        // Step 1: Student creates maintenance request
        const student = await testStudentLogin();
        const maintenanceRequest = await testCreateMaintenanceRequest(student);
        
        // Step 2: Admin assigns the request
        const admin = await testAdminLogin();
        await testAdminAssignMaintenance(maintenanceRequest);
        
        // Step 3: Finance approves the request
        const finance = await testFinanceLogin();
        const approvalResult = await testFinanceApproval(maintenanceRequest);
        
        // Step 4: Verify expense creation
        const createdExpense = await testVerifyExpenseCreation(maintenanceRequest);
        
        // Step 5: Verify transaction creation
        const createdTransaction = await testVerifyTransactionCreation(maintenanceRequest);
        
        // Step 6: CEO can view the approved request
        const ceo = await testCEOLogin();
        await testCEOViewMaintenance(maintenanceRequest);
        
        console.log('\n🎉 COMPLETE WORKFLOW TEST PASSED!');
        console.log('================================');
        console.log('✅ Student created maintenance request');
        console.log('✅ Admin assigned the request');
        console.log('✅ Finance approved with double-entry accounting');
        console.log('✅ Expense record created');
        console.log('✅ Transaction record created');
        console.log('✅ CEO can view approved request');
        console.log('\n📊 Summary:');
        console.log(`   - Maintenance Request ID: ${maintenanceRequest._id}`);
        console.log(`   - Expense ID: ${createdExpense?.expenseId}`);
        console.log(`   - Transaction ID: ${createdTransaction?.transactionId}`);
        console.log(`   - Amount: $${approvalResult.expense?.amount || 'N/A'}`);
        
    } catch (error) {
        console.log('\n❌ WORKFLOW TEST FAILED!');
        console.log('========================');
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// Run the test
if (require.main === module) {
    runCompleteWorkflowTest()
        .then(() => {
            console.log('\n✅ All tests completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runCompleteWorkflowTest,
    testStudentLogin,
    testCreateMaintenanceRequest,
    testAdminLogin,
    testAdminAssignMaintenance,
    testFinanceLogin,
    testFinanceApproval,
    testVerifyExpenseCreation,
    testVerifyTransactionCreation,
    testCEOLogin,
    testCEOViewMaintenance
}; 