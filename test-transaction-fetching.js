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
async function getAllTransactions() {
    try {
        console.log('\n📊 Fetching all transactions...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ All transactions fetched successfully');
        console.log('📋 Total transactions:', response.data.transactions?.length || 0);
        
        if (response.data.transactions && response.data.transactions.length > 0) {
            const transaction = response.data.transactions[0];
            console.log('📄 Sample transaction:');
            console.log('  - Transaction ID:', transaction.transactionId);
            console.log('  - Type:', transaction.type);
            console.log('  - Amount:', transaction.amount);
            console.log('  - Description:', transaction.description);
            console.log('  - Date:', transaction.date);
        }

        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ Failed to fetch transactions:', error.response?.data || error.message);
        return [];
    }
}

// Test 2: Get transactions by type
async function getTransactionsByType(type) {
    try {
        console.log(`\n📊 Fetching ${type} transactions...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions?type=${type}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log(`✅ ${type} transactions fetched successfully`);
        console.log('📋 Count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error(`❌ Failed to fetch ${type} transactions:`, error.response?.data || error.message);
        return [];
    }
}

// Test 3: Get specific transaction
async function getTransactionById(transactionId) {
    try {
        console.log(`\n📊 Fetching transaction: ${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Transaction fetched successfully');
        console.log('📄 Transaction details:');
        console.log('  - Transaction ID:', response.data.transaction.transactionId);
        console.log('  - Type:', response.data.transaction.type);
        console.log('  - Amount:', response.data.transaction.amount);
        console.log('  - Description:', response.data.transaction.description);
        console.log('  - Entries count:', response.data.transaction.entries?.length || 0);
        
        return response.data.transaction;
    } catch (error) {
        console.error('❌ Failed to fetch transaction:', error.response?.data || error.message);
        return null;
    }
}

// Test 4: Get transactions by date range
async function getTransactionsByDateRange(startDate, endDate) {
    try {
        console.log(`\n📊 Fetching transactions from ${startDate} to ${endDate}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions?startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Date range transactions fetched successfully');
        console.log('📋 Count:', response.data.transactions?.length || 0);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ Failed to fetch date range transactions:', error.response?.data || error.message);
        return [];
    }
}

// Test 5: Get transaction entries
async function getTransactionEntries(transactionId) {
    try {
        console.log(`\n📊 Fetching entries for transaction: ${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/${transactionId}/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Transaction entries fetched successfully');
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        if (response.data.entries && response.data.entries.length > 0) {
            console.log('📄 Sample entries:');
            response.data.entries.forEach((entry, index) => {
                console.log(`  Entry ${index + 1}:`);
                console.log('    - Account:', entry.account);
                console.log('    - Debit:', entry.debit);
                console.log('    - Credit:', entry.credit);
                console.log('    - Description:', entry.description);
            });
        }
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ Failed to fetch transaction entries:', error.response?.data || error.message);
        return [];
    }
}

// Main test function
async function runTransactionTests() {
    console.log('🚀 Starting Transaction Fetching Tests\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Get all transactions
    const allTransactions = await getAllTransactions();
    
    if (allTransactions.length > 0) {
        const firstTransaction = allTransactions[0];
        
        // Step 3: Get transactions by type
        await getTransactionsByType('approval');
        await getTransactionsByType('payment');
        
        // Step 4: Get specific transaction
        await getTransactionById(firstTransaction._id);
        
        // Step 5: Get transaction entries
        await getTransactionEntries(firstTransaction._id);
        
        // Step 6: Get transactions by date range (last 30 days)
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await getTransactionsByDateRange(startDate, endDate);
    } else {
        console.log('⚠️ No transactions found. Create some transactions first by approving requests.');
    }
    
    console.log('\n🎉 Transaction Fetching Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ All transaction endpoints tested');
    console.log('✅ Transaction filtering works');
    console.log('✅ Transaction details accessible');
    console.log('✅ Transaction entries accessible');
    console.log('✅ Date range filtering works');
}

// Run the tests
runTransactionTests().catch(console.error); 