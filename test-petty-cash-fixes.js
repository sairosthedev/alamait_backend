const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Replace with actual test user ID

// Test data
const testCases = [
    {
        name: 'Test 1: Get petty cash balance with valid user ID',
        method: 'GET',
        url: `/api/finance/petty-cash-balance/${TEST_USER_ID}`,
        expectedStatus: 200
    },
    {
        name: 'Test 2: Get petty cash balance with invalid user ID',
        method: 'GET',
        url: '/api/finance/petty-cash-balance/invalid-user-id',
        expectedStatus: 404
    },
    {
        name: 'Test 3: Get petty cash balance without user ID',
        method: 'GET',
        url: '/api/finance/petty-cash-balance/',
        expectedStatus: 400
    },
    {
        name: 'Test 4: Get petty cash transactions with valid user ID',
        method: 'GET',
        url: `/api/finance/petty-cash-transactions/${TEST_USER_ID}`,
        expectedStatus: 200
    },
    {
        name: 'Test 5: Get petty cash transactions with date filters',
        method: 'GET',
        url: `/api/finance/petty-cash-transactions/${TEST_USER_ID}?startDate=2024-01-01&endDate=2024-12-31`,
        expectedStatus: 200
    },
    {
        name: 'Test 6: Get petty cash transactions with invalid user ID',
        method: 'GET',
        url: '/api/finance/petty-cash-transactions/invalid-user-id',
        expectedStatus: 404
    },
    {
        name: 'Test 7: Get all petty cash balances',
        method: 'GET',
        url: '/api/finance/all-petty-cash-balances',
        expectedStatus: 200
    },
    {
        name: 'Test 8: Get eligible users for petty cash',
        method: 'GET',
        url: '/api/finance/eligible-users-for-petty-cash',
        expectedStatus: 200
    }
];

// Helper function to run tests
async function runTest(testCase) {
    try {
        console.log(`\n🧪 Running: ${testCase.name}`);
        console.log(`📍 URL: ${testCase.method} ${BASE_URL}${testCase.url}`);
        
        const response = await axios({
            method: testCase.method,
            url: `${BASE_URL}${testCase.url}`,
            timeout: 10000
        });
        
        console.log(`✅ Status: ${response.status} (Expected: ${testCase.expectedStatus})`);
        
        if (response.data) {
            console.log('📊 Response Structure:');
            console.log(`   - Success: ${response.data.success}`);
            if (response.data.message) {
                console.log(`   - Message: ${response.data.message}`);
            }
            if (response.data.data) {
                console.log(`   - Has Data: Yes`);
                if (response.data.data.user) {
                    console.log(`   - User: ${response.data.data.user.firstName} ${response.data.data.user.lastName}`);
                }
                if (response.data.data.summary) {
                    console.log(`   - Summary: ${JSON.stringify(response.data.data.summary)}`);
                }
            }
        }
        
        return response.status === testCase.expectedStatus;
        
    } catch (error) {
        console.log(`❌ Status: ${error.response?.status || 'Network Error'} (Expected: ${testCase.expectedStatus})`);
        
        if (error.response?.data) {
            console.log('📊 Error Response:');
            console.log(`   - Error: ${error.response.data.error}`);
            if (error.response.data.message) {
                console.log(`   - Message: ${error.response.data.message}`);
            }
        }
        
        return error.response?.status === testCase.expectedStatus;
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Petty Cash Endpoint Tests');
    console.log('=====================================');
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
        const passed = await runTest(testCase);
        if (passed) {
            passedTests++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All tests passed! The petty cash endpoints are working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the error messages above.');
    }
}

// Run the tests
runAllTests().catch(error => {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
});
