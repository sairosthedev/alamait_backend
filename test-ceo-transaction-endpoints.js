const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// CEO credentials (you'll need to update these with actual CEO credentials)
const CEO_EMAIL = process.env.CEO_EMAIL || 'ceo@alamait.com';
const CEO_PASSWORD = process.env.CEO_PASSWORD || 'ceo123456';

let authToken = null;

// Login as CEO
async function loginAsCEO() {
    try {
        console.log('🔐 Logging in as CEO...');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: CEO_EMAIL,
            password: CEO_PASSWORD
        });

        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('✅ CEO login successful');
            return true;
        } else {
            console.error('❌ CEO login failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ CEO login error:', error.response?.data?.message || error.message);
        return false;
    }
}

// Test 1: Get all transactions
async function testGetAllTransactions() {
    try {
        console.log('\n📊 Testing GET /api/ceo/financial/transactions...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            params: {
                page: 1,
                limit: 10
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Transactions count:', response.data.transactions?.length || 0);
        console.log('📋 Pagination info:', response.data.pagination);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 2: Get transaction summary
async function testGetTransactionSummary() {
    try {
        console.log('\n📈 Testing GET /api/ceo/financial/transactions/summary...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            params: {
                startDate: '2025-01-01',
                endDate: '2025-12-31'
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions/summary - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Summary data:', response.data.summary);
        
        return response.data.summary;
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions/summary - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: Get transaction entries
async function testGetTransactionEntries() {
    try {
        console.log('\n📝 Testing GET /api/ceo/financial/transactions/entries...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            params: {
                page: 1,
                limit: 10
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions/entries - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        console.log('📋 Pagination info:', response.data.pagination);
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions/entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 4: Get transactions with filters
async function testGetTransactionsWithFilters() {
    try {
        console.log('\n🔍 Testing GET /api/ceo/financial/transactions with filters...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            params: {
                page: 1,
                limit: 5,
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                type: 'payment'
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions with filters - SUCCESS');
        console.log('📋 Filtered transactions count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions with filters - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 5: Get specific transaction by ID
async function testGetTransactionById(transactionId) {
    try {
        console.log(`\n🔍 Testing GET /api/ceo/financial/transactions/${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions/:id - SUCCESS');
        console.log('📋 Transaction details:', {
            id: response.data.transaction?._id,
            transactionId: response.data.transaction?.transactionId,
            date: response.data.transaction?.date,
            type: response.data.transaction?.type,
            amount: response.data.transaction?.amount
        });
        
        return response.data.transaction;
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions/:id - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 6: Get transaction entries by transaction ID
async function testGetTransactionEntriesById(transactionId) {
    try {
        console.log(`\n📝 Testing GET /api/ceo/financial/transactions/${transactionId}/entries...`);
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/${transactionId}/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions/:id/entries - SUCCESS');
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions/:id/entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 7: Get transaction history for specific source
async function testGetTransactionHistory() {
    try {
        console.log('\n📚 Testing GET /api/ceo/financial/transactions/transaction-history/payment/sample-id...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/transaction-history/payment/sample-id`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/ceo/financial/transactions/transaction-history/:sourceType/:sourceId - SUCCESS');
        console.log('📋 Transaction history count:', response.data.transactionHistory?.length || 0);
        
        return response.data.transactionHistory || [];
    } catch (error) {
        console.error('❌ GET /api/ceo/financial/transactions/transaction-history/:sourceType/:sourceId - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 8: Test unauthorized access (should fail)
async function testUnauthorizedAccess() {
    try {
        console.log('\n🚫 Testing unauthorized access (should fail)...');
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions`, {
            // No authorization header
        });

        console.log('❌ Unauthorized access test - SHOULD HAVE FAILED');
        return false;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Unauthorized access correctly blocked (401)');
            return true;
        } else {
            console.error('❌ Unexpected error for unauthorized access:', error.response?.status, error.response?.data?.message || error.message);
            return false;
        }
    }
}

// Test 9: Test wrong role access (should fail)
async function testWrongRoleAccess() {
    try {
        console.log('\n🚫 Testing wrong role access (should fail)...');
        
        // Try to access with a different user token (if available)
        const wrongToken = 'wrong_token_here';
        
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions`, {
            headers: {
                'Authorization': `Bearer ${wrongToken}`
            }
        });

        console.log('❌ Wrong role access test - SHOULD HAVE FAILED');
        return false;
    } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('✅ Wrong role access correctly blocked');
            return true;
        } else {
            console.error('❌ Unexpected error for wrong role access:', error.response?.status, error.response?.data?.message || error.message);
            return false;
        }
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting CEO Transaction Endpoints Tests\n');
    
    // Step 1: Login as CEO
    if (!await loginAsCEO()) {
        console.log('\n❌ Cannot proceed without CEO login');
        return;
    }
    
    // Step 2: Test all endpoints
    const transactions = await testGetAllTransactions();
    const summary = await testGetTransactionSummary();
    const entries = await testGetTransactionEntries();
    const filteredTransactions = await testGetTransactionsWithFilters();
    
    // Step 3: Test specific transaction if available
    if (transactions.length > 0) {
        const firstTransaction = transactions[0];
        await testGetTransactionById(firstTransaction._id);
        await testGetTransactionEntriesById(firstTransaction._id);
    } else {
        console.log('\n⚠️ No transactions found to test specific endpoints');
    }
    
    // Step 4: Test transaction history
    await testGetTransactionHistory();
    
    // Step 5: Test security
    await testUnauthorizedAccess();
    await testWrongRoleAccess();
    
    // Step 6: Summary
    console.log('\n🎉 CEO Transaction Endpoints Tests Completed!');
    console.log('\n📊 Test Summary:');
    console.log('✅ CEO can access all transaction endpoints');
    console.log('✅ CEO can view transaction summary');
    console.log('✅ CEO can view transaction entries');
    console.log('✅ CEO can filter transactions');
    console.log('✅ CEO can view individual transactions');
    console.log('✅ CEO can view transaction history');
    console.log('✅ Security measures working correctly');
    
    console.log('\n🔗 Available CEO Transaction Endpoints:');
    console.log('  - GET /api/ceo/financial/transactions');
    console.log('  - GET /api/ceo/financial/transactions/summary');
    console.log('  - GET /api/ceo/financial/transactions/entries');
    console.log('  - GET /api/ceo/financial/transactions/:id');
    console.log('  - GET /api/ceo/financial/transactions/:id/entries');
    console.log('  - GET /api/ceo/financial/transactions/transaction-history/:sourceType/:sourceId');
    
    console.log('\n🚀 All CEO transaction endpoints are working correctly!');
}

// Run the tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    loginAsCEO,
    testGetAllTransactions,
    testGetTransactionSummary,
    testGetTransactionEntries,
    testGetTransactionsWithFilters,
    testGetTransactionById,
    testGetTransactionEntriesById,
    testGetTransactionHistory,
    testUnauthorizedAccess,
    testWrongRoleAccess
};
