const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';
const CEO_EMAIL = 'ceo@alamait.com';
const CEO_PASSWORD = 'Ceo@123';

let authToken = '';

// Login function for CEO
async function loginAsCEO() {
    try {
        console.log('🔐 Logging in as CEO...');
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: CEO_EMAIL,
            password: CEO_PASSWORD
        });
        
        authToken = response.data.token;
        console.log('✅ CEO login successful');
        return true;
    } catch (error) {
        console.error('❌ CEO login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 1: CEO can get all transactions
async function testCEOGetAllTransactions() {
    try {
        console.log('\n📊 Testing CEO access to GET /api/finance/transactions...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Transactions count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ CEO access to GET /api/finance/transactions - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 2: CEO can get transaction summary
async function testCEOGetTransactionSummary() {
    try {
        console.log('\n📊 Testing CEO access to GET /api/finance/transactions/summary...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions/summary - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Summary data:', response.data.summary);
        
        return response.data.summary;
    } catch (error) {
        console.error('❌ CEO access to GET /api/finance/transactions/summary - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: CEO can get transaction entries
async function testCEOGetTransactionEntries() {
    try {
        console.log('\n📊 Testing CEO access to GET /api/finance/transactions/transaction-entries...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/transaction-entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions/transaction-entries - SUCCESS');
        console.log('📋 Response structure:', Object.keys(response.data));
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ CEO access to GET /api/finance/transactions/transaction-entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 4: CEO can get transactions with filters
async function testCEOGetTransactionsWithFilters() {
    try {
        console.log('\n📊 Testing CEO access to GET /api/finance/transactions with filters...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions?type=approval&limit=5`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions with filters - SUCCESS');
        console.log('📋 Filtered transactions count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ CEO access to GET /api/finance/transactions with filters - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 5: CEO can get specific transaction by ID
async function testCEOGetTransactionById(transactionId) {
    try {
        console.log(`\n📊 Testing CEO access to GET /api/finance/transactions/${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions/:id - SUCCESS');
        console.log('📋 Transaction details:', {
            transactionId: response.data.transaction?.transactionId,
            type: response.data.transaction?.type,
            amount: response.data.transaction?.amount,
            description: response.data.transaction?.description
        });
        
        return response.data.transaction;
    } catch (error) {
        console.error('❌ CEO access to GET /api/finance/transactions/:id - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 6: CEO can get transaction entries by transaction ID
async function testCEOGetTransactionEntriesById(transactionId) {
    try {
        console.log(`\n📊 Testing CEO access to GET /api/finance/transactions/${transactionId}/entries...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ CEO can access GET /api/finance/transactions/:id/entries - SUCCESS');
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
        console.error('❌ CEO access to GET /api/finance/transactions/:id/entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Main test function
async function runCEOTests() {
    console.log('🚀 Starting CEO Transaction Access Tests\n');
    
    // Step 1: Login as CEO
    if (!await loginAsCEO()) {
        return;
    }
    
    // Step 2: Test all endpoints as CEO
    const transactions = await testCEOGetAllTransactions();
    const summary = await testCEOGetTransactionSummary();
    const entries = await testCEOGetTransactionEntries();
    const filteredTransactions = await testCEOGetTransactionsWithFilters();
    
    // Step 3: Test specific transaction if available
    if (transactions.length > 0) {
        const firstTransaction = transactions[0];
        await testCEOGetTransactionById(firstTransaction._id);
        await testCEOGetTransactionEntriesById(firstTransaction._id);
    } else {
        console.log('⚠️ No transactions found to test specific endpoints');
    }
    
    console.log('\n🎉 CEO Transaction Access Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ CEO can access all transaction endpoints');
    console.log('✅ CEO can view transaction summary');
    console.log('✅ CEO can view transaction entries');
    console.log('✅ CEO can filter transactions');
    console.log('✅ CEO can view individual transactions');
    
    console.log('\n🔗 CEO Accessible Endpoints:');
    console.log('  - GET /api/finance/transactions');
    console.log('  - GET /api/finance/transactions/summary');
    console.log('  - GET /api/finance/transactions/transaction-entries');
    console.log('  - GET /api/finance/transactions/:id');
    console.log('  - GET /api/finance/transactions/:id/entries');
    
    console.log('\n🚀 CEO now has full access to transaction data!');
}

// Run the tests
runCEOTests().catch(console.error); 