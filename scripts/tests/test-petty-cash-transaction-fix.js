const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials (you'll need to update these with actual admin credentials)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@alamait.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

let authToken = null;

// Login as admin
async function loginAsAdmin() {
    try {
        console.log('🔐 Logging in as admin...');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('✅ Admin login successful');
            console.log('User role:', response.data.user?.role);
            return true;
        } else {
            console.log('❌ Admin login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Admin login error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash allocation
async function testPettyCashAllocation() {
    try {
        console.log('\n💰 Testing Petty Cash Allocation...');
        
        // First, get a list of eligible users
        const usersResponse = await axios.get(`${BASE_URL}/api/finance/eligible-users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!usersResponse.data.users || usersResponse.data.users.length === 0) {
            console.log('❌ No eligible users found for petty cash allocation');
            return false;
        }
        
        const testUser = usersResponse.data.users[0];
        console.log(`✅ Found eligible user: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`);
        
        // Test petty cash allocation
        const allocationResponse = await axios.post(`${BASE_URL}/api/finance/allocate-petty-cash`, {
            userId: testUser._id,
            amount: 100,
            description: 'Test petty cash allocation'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Petty cash allocation successful');
        console.log('Allocation response:', allocationResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash allocation error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash balance check
async function testPettyCashBalance() {
    try {
        console.log('\n💵 Testing Petty Cash Balance Check...');
        
        // Get eligible users
        const usersResponse = await axios.get(`${BASE_URL}/api/finance/eligible-users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!usersResponse.data.users || usersResponse.data.users.length === 0) {
            console.log('❌ No eligible users found');
            return false;
        }
        
        const testUser = usersResponse.data.users[0];
        
        // Check petty cash balance
        const balanceResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash-balance/${testUser._id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('✅ Petty cash balance check successful');
        console.log('Balance response:', balanceResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash balance error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash transactions filtering
async function testPettyCashTransactions() {
    try {
        console.log('\n📊 Testing Petty Cash Transactions Filtering...');
        
        // Test getting petty cash transactions
        const transactionsResponse = await axios.get(`${BASE_URL}/api/finance/transactions/all?type=petty_cash`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('✅ Petty cash transactions filtering successful');
        console.log('Transactions found:', transactionsResponse.data.transactions?.length || 0);
        return true;
    } catch (error) {
        console.error('❌ Petty cash transactions error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash expense recording
async function testPettyCashExpense() {
    try {
        console.log('\n💸 Testing Petty Cash Expense Recording...');
        
        // Get eligible users
        const usersResponse = await axios.get(`${BASE_URL}/api/finance/eligible-users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!usersResponse.data.users || usersResponse.data.users.length === 0) {
            console.log('❌ No eligible users found');
            return false;
        }
        
        const testUser = usersResponse.data.users[0];
        
        // Test petty cash expense recording
        const expenseResponse = await axios.post(`${BASE_URL}/api/finance/record-petty-cash-expense`, {
            userId: testUser._id,
            amount: 25,
            description: 'Test petty cash expense',
            category: 'office_supplies'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Petty cash expense recording successful');
        console.log('Expense response:', expenseResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Petty cash expense error:', error.response?.data || error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Testing Petty Cash Transaction Fix');
    console.log('=====================================');
    
    // Login first
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without login');
        return;
    }
    
    // Test all petty cash functionality
    const allocationSuccess = await testPettyCashAllocation();
    const balanceSuccess = await testPettyCashBalance();
    const transactionsSuccess = await testPettyCashTransactions();
    const expenseSuccess = await testPettyCashExpense();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Petty Cash Allocation: ${allocationSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Balance Check: ${balanceSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Transactions Filtering: ${transactionsSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Expense Recording: ${expenseSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (allocationSuccess && balanceSuccess && transactionsSuccess && expenseSuccess) {
        console.log('\n🎉 All petty cash transactions are working correctly!');
        console.log('✅ Petty cash transaction enum validation has been fixed successfully.');
    } else {
        console.log('\n⚠️ Some petty cash transactions still have issues');
    }
}

// Run the tests
runTests().catch(console.error);
