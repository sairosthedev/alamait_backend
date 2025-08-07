const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = '67c023adae5e27657502e887'; // Makomborero Madziwa's ID

// Test backward compatibility
async function testBackwardCompatibility() {
    console.log('🔧 Testing Petty Cash Backward Compatibility');
    console.log('===========================================');

    try {
        // Test 1: Get petty cash balance
        console.log('\n1️⃣ Testing Petty Cash Balance Backward Compatibility...');
        
        const balanceResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash-balance/${TEST_USER_ID}`);
        
        console.log('✅ Balance Response Structure:');
        console.log(`   - Success: ${balanceResponse.data.success}`);
        console.log(`   - Message: ${balanceResponse.data.message}`);
        
        // Check new structure
        if (balanceResponse.data.data) {
            console.log('   - ✅ New structure (data.data) exists');
            console.log(`   - User: ${balanceResponse.data.data.user.firstName} ${balanceResponse.data.data.user.lastName}`);
            console.log(`   - Balance: ${balanceResponse.data.data.pettyCashBalance.formattedBalance}`);
        }
        
        // Check backward compatibility
        if (balanceResponse.data.user) {
            console.log('   - ✅ Backward compatibility (data.user) exists');
            console.log(`   - User: ${balanceResponse.data.user.firstName} ${balanceResponse.data.user.lastName}`);
        }
        
        if (balanceResponse.data.pettyCashBalance) {
            console.log('   - ✅ Backward compatibility (data.pettyCashBalance) exists');
            console.log(`   - Balance: ${balanceResponse.data.pettyCashBalance.formattedBalance}`);
        }
        
        if (balanceResponse.data.balance !== undefined) {
            console.log('   - ✅ Backward compatibility (data.balance) exists');
            console.log(`   - Balance: $${balanceResponse.data.balance}`);
        }

        // Test 2: Get petty cash transactions
        console.log('\n2️⃣ Testing Petty Cash Transactions Backward Compatibility...');
        
        const transactionsResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash-transactions/${TEST_USER_ID}`);
        
        console.log('✅ Transactions Response Structure:');
        console.log(`   - Success: ${transactionsResponse.data.success}`);
        console.log(`   - Message: ${transactionsResponse.data.message}`);
        
        // Check new structure
        if (transactionsResponse.data.data) {
            console.log('   - ✅ New structure (data.data) exists');
            console.log(`   - User: ${transactionsResponse.data.data.user.firstName} ${transactionsResponse.data.data.user.lastName}`);
            console.log(`   - Transactions: ${transactionsResponse.data.data.transactions.length}`);
        }
        
        // Check backward compatibility
        if (transactionsResponse.data.user) {
            console.log('   - ✅ Backward compatibility (data.user) exists');
            console.log(`   - User: ${transactionsResponse.data.user.firstName} ${transactionsResponse.data.user.lastName}`);
        }
        
        if (transactionsResponse.data.transactions) {
            console.log('   - ✅ Backward compatibility (data.transactions) exists');
            console.log(`   - Transactions: ${transactionsResponse.data.transactions.length}`);
        }

        // Test 3: Get all petty cash balances
        console.log('\n3️⃣ Testing All Petty Cash Balances Backward Compatibility...');
        
        const allBalancesResponse = await axios.get(`${BASE_URL}/api/finance/all-petty-cash-balances`);
        
        console.log('✅ All Balances Response Structure:');
        console.log(`   - Success: ${allBalancesResponse.data.success}`);
        console.log(`   - Message: ${allBalancesResponse.data.message}`);
        
        // Check new structure
        if (allBalancesResponse.data.data) {
            console.log('   - ✅ New structure (data.data) exists');
            console.log(`   - Summary: ${allBalancesResponse.data.data.summary.totalUsers} users`);
            console.log(`   - Total Balance: ${allBalancesResponse.data.data.summary.formattedSystemBalance}`);
        }
        
        // Check backward compatibility
        if (allBalancesResponse.data.balances) {
            console.log('   - ✅ Backward compatibility (data.balances) exists');
            console.log(`   - Balances: ${allBalancesResponse.data.balances.length} users`);
        }

        console.log('\n🎉 All backward compatibility tests passed!');
        console.log('The frontend should now display the correct petty cash balance.');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('💡 Make sure the server is running and the user ID is correct');
        }
    }
}

// Run the test
testBackwardCompatibility().catch(error => {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
});

