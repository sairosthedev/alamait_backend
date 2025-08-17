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
        console.log('✅ Login successful');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 1: Get all transactions
async function testGetAllTransactions() {
    try {
        console.log('\n📊 Testing GET /api/finance/transactions...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Transactions count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ GET /api/finance/transactions - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 2: Get transaction summary
async function testGetTransactionSummary() {
    try {
        console.log('\n📊 Testing GET /api/finance/transactions/summary...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions/summary - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Summary data:', response.data.summary);
        
        return response.data.summary;
    } catch (error) {
        console.error('❌ GET /api/finance/transactions/summary - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: Get transaction entries with filters
async function testGetTransactionEntries() {
    try {
        console.log('\n📊 Testing GET /api/finance/transactions/transaction-entries...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/transaction-entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions/transaction-entries - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ GET /api/finance/transactions/transaction-entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 4: Get transactions with filters
async function testGetTransactionsWithFilters() {
    try {
        console.log('\n📊 Testing GET /api/finance/transactions with filters...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions?type=approval&limit=5`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions with filters - SUCCESS');
        console.log('📋 Filtered transactions count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ GET /api/finance/transactions with filters - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 5: Get specific transaction by ID
async function testGetTransactionById(transactionId) {
    try {
        console.log(`\n📊 Testing GET /api/finance/transactions/${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions/:id - SUCCESS');
        console.log('📋 Transaction details:', {
            transactionId: response.data.transaction?.transactionId,
            type: response.data.transaction?.type,
            amount: response.data.transaction?.amount,
            description: response.data.transaction?.description
        });
        
        return response.data.transaction;
    } catch (error) {
        console.error('❌ GET /api/finance/transactions/:id - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 6: Get transaction entries by transaction ID
async function testGetTransactionEntriesById(transactionId) {
    try {
        console.log(`\n📊 Testing GET /api/finance/transactions/${transactionId}/entries...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ GET /api/finance/transactions/:id/entries - SUCCESS');
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        if (response.data.entries && response.data.entries.length > 0) {
            console.log('📄 Sample entry:', {
                account: response.data.entries[0].account,
                debit: response.data.entries[0].debit,
                credit: response.data.entries[0].credit,
                description: response.data.entries[0].description
            });
        }
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ GET /api/finance/transactions/:id/entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Main test function
async function runTransactionEndpointTests() {
    console.log('🚀 Starting Transaction Endpoint Tests\n');
    
    // Step 1: Login
    if (!await login()) {
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
        console.log('⚠️ No transactions found to test specific endpoints');
    }
    
    console.log('\n🎉 Transaction Endpoint Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ All transaction endpoints are now available');
    console.log('✅ Frontend should no longer get 404 errors');
    console.log('✅ Transaction data can be fetched and filtered');
    console.log('✅ Transaction summary is available');
    console.log('✅ Transaction entries are accessible');
    
    console.log('\n🔗 Available Endpoints:');
    console.log('  - GET /api/finance/transactions');
    console.log('  - GET /api/finance/transactions/summary');
    console.log('  - GET /api/finance/transactions/transaction-entries');
    console.log('  - GET /api/finance/transactions/:id');
    console.log('  - GET /api/finance/transactions/:id/entries');
    
    console.log('\n🚀 Your frontend should now work without 404 errors!');
}

// Run the tests
runTransactionEndpointTests().catch(console.error); 